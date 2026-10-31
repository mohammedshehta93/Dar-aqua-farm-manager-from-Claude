# Tank cycles derived from the records, the farm on any past date, and closing a cycle with an adjustment.
import os; os.environ['E2E_PORT'] = '8816'
from harness import *

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("""() => { const A=o=>addTX(Object.assign({_skipValidation:true},o)), d=n=>daAddDays(daToday(),-n);
      A({id:'h1',type:'harvesting',unit:'F1.S01T01',date:d(40),fishNo:791,kg:300});
      A({id:'st2',type:'stocking',unit:'F1.S01T01',date:d(20),fishNo:1000,avgWt:50,batch:'B2'});
      A({id:'f2',type:'feeding',unit:'F1.S01T01',date:d(15),kg:20,source:'sheet'});
      A({id:'m2',type:'mortality',unit:'F1.S01T01',date:d(10),count:10,source:'sheet'});
      A({id:'s2',type:'sampling',unit:'F1.S01T01',date:d(5),avgWt:80});
      A({id:'h2',type:'harvesting',unit:'F1.S01T02',date:d(30),fishNo:835,kg:130});
      A({id:'h3',type:'harvesting',unit:'F1.S01T03',date:d(2),fishNo:980,kg:110}); }""")
    pg.wait_for_timeout(300)
    items = pg.evaluate("() => DA_NAV.find(g=>g.id==='home').items.map(i=>i[0])")
    check('C1 no separate page: the dated view lives in Site Overview', 'site-overview' in items and 'tank-cycles' not in items, items)
    cs = pg.evaluate("daUnitCycles('F1.S01T01')")
    check('C2 cycles derived from the records: harvest closed #1, stocking opened #2', len(cs) == 2 and cs[0]['end'] == pg.evaluate("daAddDays(daToday(),-40)") and cs[0]['endBy'] == 'حصاد' and cs[0]['fish0'] == 791
          and cs[1]['how'] == 'تخزين' and cs[1]['batch'] == 'B2' and cs[1]['end'] is None and cs[1]['fish1'] == 990 and cs[1]['feed'] == 20, cs)
    d50 = pg.evaluate("daAddDays(daToday(),-50)")
    row_of = lambda u: pg.evaluate(f"(() => {{ const tr=document.querySelector('#ov-t tr[data-u=\"{u}\"]'); return tr && [...tr.cells].map(c=>c.textContent); }})()")
    pg.evaluate(f"window._ov={{date:'{d50}'}}; farmFilter='F1'; show('site-overview')"); pg.wait_for_timeout(300)
    row = row_of('F1.S01T02')
    check('C3 Site Overview back 50 days: a tank that is empty today is listed with the fish it had then', row and row[2] == '835', row)
    check('C3 the page says it is showing a past day', 'المزرعة يوم' in content(pg))
    pg.evaluate("window._ov={date:daToday()}; show('site-overview',true)"); pg.wait_for_timeout(300)
    check('C4 today the same tank is not listed (empty), like AquaManager', row_of('F1.S01T02') is None)
    pg.evaluate("(() => { var c=getSettings('F1')||{}; c.harvestTargetWt=70; saveSettings(c,'F1'); })(); show('site-overview',true)"); pg.wait_for_timeout(300)
    r1 = row_of('F1.S01T01'); gain = 990 * 0.08 - 1000 * 0.05 + 10 * 0.065
    exp = ['F1.S01T01', pg.evaluate("daAddDays(daToday(),-20)"), '990', '50.00', '80.00', '79.20', '7.92', '10', '20.00', f'{20 / gain:.2f}', f'{20 / gain:.2f}', '1.500', '50.00', '20', '20', 'B2']
    check('C4b AquaManager columns for a known tank (cycle start, fish, start/now weight, biomass, density, dead, feed, UTD/LTD FCR, growth/day, stocking biomass, days, batch)', r1 == exp, (r1, exp))
    check('C4b at/above harvest weight → green row', pg.evaluate("document.querySelector('#ov-t tr[data-u=\"F1.S01T01\"]').style.background").replace(' ', '') in ('rgb(134,239,172)', '#86efac'))
    tt = pg.evaluate("(() => { const s=[...document.querySelectorAll('#ov-t tbody tr')].reduce((a,tr)=>a+(+tr.cells[2].textContent.replace(/,/g,'')||0),0); return [s, document.querySelector('#ov-t tfoot').rows[0].cells[2].textContent.replace(/,/g,'')]; })()")
    check('C4b totals row = sum of the Fish No column', tt[0] > 0 and str(tt[0]) == tt[1], tt)
    # close a cycle with fish left on paper
    pg.evaluate("window._tc={unit:'F1.S01T03'}; show('site-overview',true)"); pg.wait_for_timeout(300)
    check('C5 open cycle with 7 fish left on paper offers "close cycle"', pg.evaluate("!!document.getElementById('tc-close')") and 'فيها 7 سمكة' in content(pg).replace('\u00a0', ' '), content(pg)[:200])
    dead0 = pg.evaluate("getTX().filter(t=>t.type==='mortality').reduce((s,t)=>s+(+t.count||0),0)")
    pg.once('dialog', lambda d: d.accept()); pg.click('#tc-close'); pg.wait_for_timeout(500)
    live = pg.evaluate("(_txLiveRows().find(r=>r.unit==='F1.S01T03')||{}).fishNo"); sim = pg.evaluate("daStateAt('F1.S01T03', daAddDays(daToday(),1)).fish")   # end of the closing day
    check('C6 closed: recorded as an ADJUSTMENT, both engines agree the tank is empty', live == 0 and sim == 0 and pg.evaluate("getTX().some(t=>t.type==='adjustment'&&t.unit==='F1.S01T03'&&t.count===7)"), (live, sim))
    check('C6 mortality totals unchanged (adjustment is not mortality)', pg.evaluate("getTX().filter(t=>t.type==='mortality').reduce((s,t)=>s+(+t.count||0),0)") == dead0)
    c3 = pg.evaluate("daUnitCycles('F1.S01T03')")
    check('C6 cycle shown closed "قفل يدوي" with the adjustment', c3[-1]['end'] and c3[-1]['endBy'] == 'قفل يدوي' and c3[-1]['adj'] == 7, c3[-1])
    pg.evaluate("addTX({id:'st3',type:'stocking',unit:'F1.S01T03',date:daToday(),fishNo:500,avgWt:30,batch:'B3',_skipValidation:true})")
    c3 = pg.evaluate("daUnitCycles('F1.S01T03')")
    check('C7 stocking after the close opens a new cycle', len(c3) == 2 and c3[1]['batch'] == 'B3' and not c3[1]['end'], c3)
    pg.evaluate("addTX({id:'h9',type:'harvesting',unit:'F1.S01T01',date:daToday(),fishNo:990,kg:80,_skipValidation:true}); addTX({id:'st9',type:'stocking',unit:'F1.S01T01',date:daToday(),fishNo:2000,avgWt:5,batch:'B4',_skipValidation:true})")
    c1 = pg.evaluate("daUnitCycles('F1.S01T01')")
    check('C7 harvested out and restocked the SAME day → old cycle closed, new one opened (not merged)', len(c1) == 3 and c1[1]['end'] and c1[1]['endBy'] == 'حصاد' and c1[2]['batch'] == 'B4' and c1[2]['fish0'] == 2000, c1[1:])
    # entry sheets follow the date too
    pg.evaluate(f"window._fs={{farm:'F1',date:'{d50}'}}; show('feed-sheet')"); pg.wait_for_timeout(300)
    off_then = pg.evaluate("(() => { const r=window._fs.rows.find(x=>x.unit==='F1.S01T02'); return document.getElementById('fs-'+r.i+'-m0').disabled; })()")
    pg.evaluate("window._fs.date=daToday(); show('feed-sheet',true)"); pg.wait_for_timeout(300)
    off_now = pg.evaluate("(() => { const r=window._fs.rows.find(x=>x.unit==='F1.S01T02'); return document.getElementById('fs-'+r.i+'-m0').disabled; })()")
    check('C8 feed sheet on a past date opens the tanks that had fish then (closed today)', off_then is False and off_now is True, (off_then, off_now))
    check('C9 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
