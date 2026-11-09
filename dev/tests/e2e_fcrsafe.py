# FCR only when the weight gain is real: no astronomic numbers for tanks stocked today; the totals row = all feed / all gain.
import os; os.environ['E2E_PORT'] = '8870'
from harness import *
import re
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("""() => { const T=daToday(), D30=daAddDays(T,-30);
      RAW.push({unit:'F3.S01T01',farm:'F3',section:'F3.S01',startDate:T,fishNo:250,startWt:300,avgWt:300,volume:2});
      RAW.push({unit:'F3.S02T01',farm:'F3',section:'F3.S02',startDate:T,fishNo:250,startWt:300,avgWt:300,volume:2});
      RAW.push({unit:'F3.S03T01',farm:'F3',section:'F3.S03',startDate:D30,fishNo:1000,startWt:100,avgWt:100,volume:2});
      _valCache={t:0,map:{}}; _dataVer++;
      addTX({id:'m1',type:'mortality',unit:'F3.S01T01',date:T,count:1,source:'sheet',_skipValidation:true});
      addTX({id:'f1',type:'feeding',unit:'F3.S01T01',date:T,kg:0.9,source:'sheet',_skipValidation:true});
      addTX({id:'f2',type:'feeding',unit:'F3.S02T01',date:T,kg:0.9,source:'sheet',_skipValidation:true});
      addTX({id:'f3',type:'feeding',unit:'F3.S03T01',date:daAddDays(T,-1),kg:60,source:'sheet',_skipValidation:true});
      addTX({id:'s3',type:'sampling',unit:'F3.S03T01',date:T,avgWt:150,sampleN:30,_skipValidation:true}); }""")
    rows = pg.evaluate("Object.fromEntries(daOverviewRows(daToday()).filter(r=>r.unit.startsWith('F3.')).map(r=>[r.unit,[r.fcr,r.lfcr]]))")
    check('F1 a tank stocked today, with one dead and feed: no FCR yet (not 317,901,150,167,329)', rows['F3.S01T01'] == [None, None], rows.get('F3.S01T01'))
    check('F2 the same without dead: no FCR yet', rows['F3.S02T01'] == [None, None], rows.get('F3.S02T01'))
    f3 = rows['F3.S03T01'][0]
    check('F3 a tank with real growth: FCR = 60 kg ÷ 50 kg = 1.20', f3 is not None and abs(f3 - 1.2) < 0.01, rows.get('F3.S03T01'))
    pg.evaluate("show('site-overview')"); pg.wait_for_timeout(500)
    foot = pg.evaluate("[...document.querySelectorAll('#content tfoot td')].map(t=>t.textContent).filter(t=>/FCR=|AVG=/.test(t))")
    check('F4 the totals row: the farm\'s FCR (all feed ÷ all gain), no absurd number', foot and all(re.match(r'^FCR=\d+\.\d\d$', x) and float(x[4:]) < 50 for x in foot), foot)
    body = pg.inner_text('#content')
    check('F5 no astronomic number anywhere on the page', not re.search(r'\d{1,3}(,\d{3}){4,}', body))
    check('F6 the safe rule: tiny or negative gain → none; real gain → feed ÷ gain; absurd (> 50) → none',
          pg.evaluate("[daFcrSafe(0.9, 2.8e-12, 75), daFcrSafe(0.9, -1, 75), daFcrSafe(60, 50, 100), daFcrSafe(100, 1, 5)]") == [None, None, 1.2, None])
    check('F7 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
