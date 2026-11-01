# Partial graded transfer: remaining weight recomputed (both engines) and the feed history split by biomass share.
import os, sys; os.environ['E2E_PORT'] = '8821'
sys.path.insert(0, os.path.dirname(__file__))
import harness
harness.DEFAULT_UNITS[:] = [('F2.S04T01', 0, 0), ('F2.S06T01', 0, 0), ('F2.S06T02', 0, 0)]
from harness import *
close = lambda a, b, e=1e-6: a is not None and abs(a - b) < e
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("""() => { const A=o=>addTX(Object.assign({_skipValidation:true},o)), d=n=>daAddDays(daToday(),-n);
      A({id:'s0',type:'stocking',unit:'F2.S04T01',date:d(60),fishNo:1000,avgWt:50,batch:'B9'});
      for(let i=0;i<30;i++) A({id:'f'+i,type:'feeding',unit:'F2.S04T01',date:d(50-i),kg:5,source:'sheet'});
      A({id:'sm',type:'sampling',unit:'F2.S04T01',date:d(15),avgWt:200});
      A({id:'to',type:'transfer_out',unit:'F2.S04T01',date:d(10),fishNo:400,avgWt:260,txGroup:'G1',batch:'B9'});
      A({id:'ti',type:'transfer_in',unit:'F2.S06T01',date:d(10),fishNo:400,avgWt:260,txGroup:'G1',batch:'B9'}); }""")
    D = pg.evaluate("daAddDays(daToday(),-10)")
    live = pg.evaluate("_txLiveRows().find(r=>r.unit==='F2.S04T01').avgWt"); sim = pg.evaluate("daStateEnd('F2.S04T01', daToday()).wt")
    check('A1 grading: 400 big fish (260 g) leave a 200 g tank → the 600 that stay average (200,000 − 104,000) ÷ 600 = 160 g, in both engines', close(live, 160, 1e-3) and close(sim, 160, 1e-3), (live, sim))
    a = pg.evaluate(f"daAllocAt('F2.S04T01', '{D}')"); b = pg.evaluate(f"daAllocAt('F2.S06T01', '{D}')")
    # moved biomass 104 of 200 kg = 52 %: feed 150 → 72 stays, 78 leaves; start biomass 50 → 24 stays, 26 leaves
    check('A2 the fish that stay keep 48 % of the history: feed 72 kg, start 24 kg → FCR (72 ÷ (96 − 24)) = 1.00', close(a['feed'], 72) and close(a['stock'], 24) and close(a['fcr'], 1.0), a)
    check('A3 the fish that left carry 78 kg of feed into the new tank: UTD there starts at 0, LTD = 78 ÷ (104 − 26) = 1.00', close(b['feed'], 0) and b['fcr'] is None and close(b['lfeed'], 78) and close(b['lfcr'], 1.0), b)
    check('A4 nothing lost or counted twice: 72 + 78 = 150 kg', close(a['feed'] + b['lfeed'], 150))
    # the moved fish eat 10 kg and grow to 280 g in the new tank
    pg.evaluate("addTX({id:'nf',type:'feeding',unit:'F2.S06T01',date:daAddDays(daToday(),-5),kg:10,source:'sheet',_skipValidation:true}); addTX({id:'ns',type:'sampling',unit:'F2.S06T01',date:daAddDays(daToday(),-4),avgWt:280,_skipValidation:true})")
    b2 = pg.evaluate("daAllocAt('F2.S06T01', daToday())")
    check('A5 new tank: UTD FCR = 10 ÷ (112 − 104) = 1.25; LTD = 88 ÷ (112 − 26) = 1.023', close(b2['fcr'], 1.25) and close(b2['lfcr'], 88 / 86), b2)
    pg.evaluate("window._ov={date:daToday()}; farmFilter='F2'; show('site-overview')"); pg.wait_for_timeout(300)
    row = pg.evaluate("(() => { const tr=document.querySelector('#ov-t tr[data-u=\"F2.S04T01\"]'); return [...tr.cells].map(c=>c.textContent); })()")
    check('A6 Site Overview shows it: remaining 600 fish @160 g, UTD feed 72, FCR 1.00', row[2] == '600' and row[4] == '160.00' and row[8] == '72.00' and row[9] == '1.00', row)
    # a partial graded harvest records no sample of the tank; a full one does
    pg.evaluate("window._rgharv={}; show('tx-harvesting')"); pg.wait_for_timeout(200)
    pg.click('#rg-new'); pg.select_option('#rf-unit', 'F2.S04T01'); pg.fill('#rf-c0-n', '100'); pg.fill('#rf-c0-kg', '20'); pg.click('#rf-save'); pg.wait_for_timeout(400)
    check('A7 partial harvest: no sample (the harvested fish are not the tank); remaining weight recomputed', not pg.evaluate("getTX().some(t=>t.type==='sampling'&&t.unit==='F2.S04T01'&&t.link&&!t.deleted)") and close(pg.evaluate("_txLiveRows().find(r=>r.unit==='F2.S04T01').avgWt"), 152, 1e-3), pg.evaluate("_txLiveRows().find(r=>r.unit==='F2.S04T01').avgWt"))
    check('A8 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
