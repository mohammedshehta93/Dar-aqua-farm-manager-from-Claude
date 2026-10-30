# Feeding is recorded from ONE screen only (owner decision 2026-10-29).
import os; os.environ['E2E_PORT'] = '8802'
from harness import *

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('worker@example.com', 'work123', role='worker')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    items = pg.evaluate("() => DA_NAV.reduce((a,g)=>a.concat(g.items.map(i=>i[0])),[])")
    check('O1 old feeding screens removed from the menu', not any(v in items for v in ['quick-feed', 'tx-feeding', 'feed-week', 'photo-entry']) and 'feed-sheet' in items, items)
    for v in ['quick-feed', 'tx-feeding', 'feed-week', 'photo-entry']:
        pg.evaluate(f"show('{v}')"); pg.wait_for_timeout(200)
        check(f'O2 opening {v} (old tab / link) points to the feed sheet', 'شيت العلف اليومي' in content(pg) and 'اتقفلت' in content(pg))
    pg.click('text=افتح شيت العلف اليومي'); pg.wait_for_timeout(300)
    check('O2 button opens the sheet', pg.evaluate("currentView") == 'feed-sheet')
    pg.evaluate("sheetTab='feed'; show('daily')"); pg.wait_for_timeout(300)
    check('O3 daily sheet no longer takes entries (points to the sheets)', 'شيت العلف اليومي' in content(pg) and not pg.evaluate("[...document.querySelectorAll('#content .tab')].some(b=>/sheetTab='feed'/.test(b.getAttribute('onclick')||''))"))
    n0 = pg.evaluate("getTX().length")
    pg.evaluate("addTX({type:'feeding',date:daToday(),unit:'F1.S01T01',kg:5,feed:'Grower 2mm',meal:'صباح'})"); pg.wait_for_timeout(200)
    check('O4 feeding from anywhere else is refused (with a message)', pg.evaluate("getTX().length") == n0 and 'شيت العلف' in pg.evaluate("(window.__toasts||[]).slice(-1)[0]||''"))
    pg.evaluate("addTX({type:'water_quality',date:daToday(),unit:'F1.S01T01',temp:27,ph:7.2,do:6})"); pg.wait_for_timeout(200)
    check('O4 other record types unaffected', pg.evaluate("getTX().length") == n0 + 1)
    pg.evaluate("addTX({type:'feeding',date:daAddDays(daToday(),-40),unit:'F1.S01T01',kg:3,feed:'Grower 2mm',source:'import'})"); pg.wait_for_timeout(200)
    check('O5 Excel import of history still allowed', pg.evaluate("getTX().some(t=>t.source==='import'&&t.kg===3)"))
    # records made earlier on other screens → move them into the sheet
    pg.evaluate("""() => { const d=daAddDays(daToday(),-2); localStorage.setItem(DA_SHEET_KEY, JSON.stringify({F1:[{from:1,to:999,meals:['7','9:30','12:30','3:30']}]}));
      addTX({id:'wk-a',type:'feeding',unit:'F1.S01T01',date:d,kg:3.9,feed:'Grower 3mm',meal:'يومي',source:'weekly',byName:'محمد',_skipValidation:true});
      addTX({id:'qf-a',type:'feeding',unit:'F1.S01T02',date:d,kg:1.5,feed:'Grower 2mm',meal:'7',_skipValidation:true});
      addTX({id:'qf-b',type:'feeding',unit:'F1.S01T02',date:d,kg:1.0,feed:'Grower 2mm',meal:'9:30',_skipValidation:true});
      window._fs={farm:'F1',date:d}; show('feed-sheet'); }"""); pg.wait_for_timeout(400)
    check('O6 earlier entries: warning offers to move them into the sheet', pg.evaluate("!!document.getElementById('fs-adopt')"))
    pg.evaluate("() => { const r=window._fs.rows.find(x=>x.no.label==='1.1'); document.getElementById('fs-'+r.i+'-d').value='1'; }")
    inv0 = pg.evaluate("getTX().filter(t=>t.type==='feeding'&&!t.deleted).reduce((s,t)=>s+(+t.kg||0),0)")
    msg = []; pg.once('dialog', lambda d: (msg.append(d.message), d.accept())); pg.click('#fs-adopt'); pg.wait_for_timeout(700)
    a = pg.evaluate("() => getTX().find(t=>t.id==='fs-F1.S01T01-'+window._fs.date)"); b = pg.evaluate("() => getTX().find(t=>t.id==='fs-F1.S01T02-'+window._fs.date)")
    check('O7 moved: one sheet record per tank, same kg/product, original author kept', a and a['kg'] == 3.9 and a['feed'] == 'Grower 3mm' and a['byName'] == 'محمد' and b and b['kg'] == 2.5, (a, b))
    check('O7 meal times kept when they match the sheet (7 / 9:30)', b and b['meals'] == {'7': 1.5, '9:30': 1.0}, b)
    check('O7 old records removed → nothing counted twice', not pg.evaluate("getTX().some(t=>['wk-a','qf-a','qf-b'].indexOf(t.id)>=0&&!t.deleted)") and abs(pg.evaluate("getTX().filter(t=>t.type==='feeding'&&!t.deleted).reduce((s,t)=>s+(+t.kg||0),0)") - inv0) < 0.001)
    check('O7 warning gone, values now in the sheet', not pg.evaluate("!!document.getElementById('fs-adopt')") and 'متسجل بالفعل' not in content(pg) and pg.evaluate("() => { const r=window._fs.rows.find(x=>x.no.label==='1.1'); return document.getElementById('fs-'+r.i+'-m0').value; }") == '3.9')
    check('O8 no page errors (admin)', not pg._errs, pg._errs)
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(600)
    login(pg, 'worker@example.com', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    items = pg.evaluate("() => daNavGroups().reduce((a,g)=>a.concat(g.items.map(i=>i[0])),[])")
    check('O9 worker: only the feed sheet for feeding', 'feed-sheet' in items and not any(v in items for v in ['quick-feed', 'tx-feeding', 'feed-week']), items)
    pg.evaluate("window._fs={farm:'F1',date:daAddDays(daToday(),-2)}; show('feed-sheet')"); pg.wait_for_timeout(300)
    check('O9 worker cannot move records (engineer task)', not pg.evaluate("!!document.getElementById('fs-adopt')"))
    check('O10 no page errors (worker)', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
