# One entry screen per kind: mortality counts from the feed sheet, causes screen, daily sheet retired, sampling sheet photo.
import os, sys, io, numpy as np; os.environ['E2E_PORT'] = '8810'
sys.path.insert(0, os.path.dirname(__file__))
from harness import *
from ocr_synth import *

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    sb.add_user('morter@example.com', 'mort1234', role='engineer', perms=['view_dashboard', 'input_mortality'])
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    items = pg.evaluate("() => DA_NAV.reduce((a,g)=>a.concat(g.items.map(i=>[i[0],i[2]])),[])")
    check('E1 daily sheet gone from the menu; mortality screen is now "أسباب النفوق"', not any(i[0] == 'daily' for i in items) and ['tx-mortality', 'أسباب النفوق'] in items, items)
    pg.evaluate("show('daily')"); pg.wait_for_timeout(200)
    check('E2 old daily sheet → explains where each thing is entered now', 'شيت العلف اليومي' in content(pg) and 'شيت القياسات اليومي' in content(pg) and 'أسباب النفوق' in content(pg))
    n0 = pg.evaluate("getTX().length")
    pg.evaluate("addTX({type:'mortality',date:daToday(),unit:'F1.S01T01',count:3})"); pg.wait_for_timeout(200)
    check('E3 mortality counts from anywhere else are refused', pg.evaluate("getTX().length") == n0 and 'عمود dead' in pg.evaluate("(window.__toasts||[]).slice(-1)[0]||''"))
    # feed sheet dead → causes screen
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet')"); pg.wait_for_timeout(300)
    i = pg.evaluate("window._fs.rows.find(r=>r.no.label==='1.1').i"); pg.fill(f'#fs-{i}-d', '2+1'); pg.click('#fs-save'); pg.wait_for_timeout(500)
    pg.evaluate("window._mc={farm:'F1'}; show('tx-mortality')"); pg.wait_for_timeout(300)
    check('E4 causes screen lists the mortality recorded on the sheet (as written)', '2+1' in content(pg) and pg.evaluate("!!document.getElementById('mc-cause-0')"))
    pg.select_option('#mc-cause-0', 'مرض'); pg.click('#mc-save'); pg.wait_for_timeout(300)
    m = pg.evaluate("getTX().find(t=>t.id==='fsm-F1.S01T01-'+daToday())")
    check('E5 cause added to the same record (count unchanged)', m and m['cause'] == 'مرض' and m['count'] == 3, m)
    # earlier mortality from the old screen → move into the sheet
    pg.evaluate("""() => { const d=daAddDays(daToday(),-3);
      addTX({id:'om1',type:'mortality',unit:'F1.S01T02',date:d,count:4,cause:'إجهاد',_skipValidation:true});
      addTX({id:'om2',type:'mortality',unit:'F1.S01T02',date:d,count:2,cause:'إجهاد',_skipValidation:true});
      window._fs={farm:'F1',date:d}; show('feed-sheet'); }"""); pg.wait_for_timeout(300)
    check('E6 earlier mortality from other screens: warning offers to move it', pg.evaluate("!!document.getElementById('fs-adopt')") and '6 نافق' in content(pg))
    pg.once('dialog', lambda d: d.accept()); pg.click('#fs-adopt'); pg.wait_for_timeout(600)
    a = pg.evaluate("getTX().find(t=>t.id==='fsm-F1.S01T02-'+window._fs.date)")
    check('E7 moved: one record, 4+2 kept, cause kept, old records gone', a and a['count'] == 6 and a['countRaw'] == '4+2' and a['cause'] == 'إجهاد' and not pg.evaluate("getTX().some(t=>(t.id==='om1'||t.id==='om2')&&!t.deleted)"), a)
    # dashboard reads real records
    pg.evaluate("window._fs={farm:'F1',date:daToday()}; show('feed-sheet')"); pg.wait_for_timeout(300)
    i = pg.evaluate("window._fs.rows.find(r=>r.no.label==='1.2').i"); pg.fill(f'#fs-{i}-m0', '12.5'); pg.fill(f'#fs-{i}-sz', '2'); pg.click('#fs-save'); pg.wait_for_timeout(500)
    pg.evaluate("show('dashboard')"); pg.wait_for_timeout(300)
    check('E8 dashboard feed/mortality charts read the real records', pg.evaluate("daDashLogs().some(l=>l.type==='feed'&&l.kg===12.5) && daDashLogs().some(l=>l.type==='mortality'&&l.count===3)") and not pg._errs, pg._errs)
    # sampling: one screen + printed sheet + photo
    pg.evaluate("farmFilter='F1'; show('tx-sampling')"); pg.wait_for_timeout(300)
    check('E9 sampling screen has print + photo', pg.evaluate("!!document.getElementById('sp-print') && !!document.getElementById('sp-photo')"))
    L = pg.evaluate("(() => { const L=daOcrSampLayout('F1'); L.date=daOcrDateBoxes(); L.svg=daOcrSVG(L,0); return L; })()")
    pg2 = ctx.new_page(); pg2.set_viewport_size({'width': 1260, 'height': 1782})
    pg2.set_content('<html><body style="margin:0">' + L['svg'].replace('width="210mm" height="297mm"', 'width="1260" height="1782"') + '</body></html>')
    img = Image.open(io.BytesIO(pg2.screenshot(clip={'x': 0, 'y': 0, 'width': 1260, 'height': 1782}))).convert('RGB')
    rng = np.random.default_rng(5); truth = {}
    for ch, b in zip(pg.evaluate("daToday().split('-').reverse().join('')"), L['date']): write_digit(img, rng, ch, b, (20, 30, 120))
    for l in L['pages'][0]['lines']:
        wt, n = str(int(rng.choice([95, 160, 275, 410, 1250]))), str(int(rng.choice([20, 25, 30])))
        truth[l['unit']] = (wt, n); put(img, rng, l['wt']['boxes'], wt, (20, 30, 120)); put(img, rng, l['n']['boxes'], n, (20, 30, 120))
    open('/tmp/samp.jpg', 'wb').write(photo(img, rng, 0.8))
    pg.evaluate("() => { const i=document.createElement('input'); i.type='file'; i.id='t-ocr'; document.body.appendChild(i); }")
    pg.set_input_files('#t-ocr', ['/tmp/samp.jpg'])
    pg.evaluate("async () => await daOcrRun(Array.from(document.getElementById('t-ocr').files),'samp')"); pg.wait_for_timeout(600)
    got = pg.evaluate("() => Object.fromEntries(" + str(list(truth.keys())) + ".map(u=>[u,[(document.getElementById('sp-wt-'+u)||{}).value,(document.getElementById('sp-n-'+u)||{}).value]]))")
    ok = sum(1 for u in truth if got.get(u) == list(truth[u]))
    check(f'E10 sampling sheet read from a photo: {ok}/{len(truth)} tanks exact', ok >= len(truth) - 1, (truth, got))
    pg.evaluate("document.querySelectorAll('input.ocr-low').forEach(x=>{x.value='';})")
    kept = pg.evaluate("[...document.querySelectorAll('[id^=sp-wt-]')].filter(x=>x.value).length")
    pg.evaluate("sampSaveAll()"); pg.wait_for_timeout(500)
    if pg.evaluate("!!document.getElementById('txr-save')"): pg.click('#txr-save'); pg.wait_for_timeout(400)   # unusual-value review: user confirms
    if pg.evaluate("!!document.getElementById('txr-cancel')"): pg.click('#txr-cancel'); pg.wait_for_timeout(200)
    check('E11 reviewed values then saved through the sampling screen as usual', kept >= 1 and pg.evaluate("getTX().filter(t=>t.type==='sampling'&&t.date===daToday()).length") == kept, kept)
    check('E12 no page errors (admin)', not pg._errs, pg._errs)
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(600)
    # mortality-only user
    login(pg, 'morter@example.com', 'mort1234'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    check('E13 mortality-only user can open the feed sheet', pg.evaluate("canAccessView('feed-sheet')"))
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet')"); pg.wait_for_timeout(300)
    i = pg.evaluate("window._fs.rows.find(r=>r.no.label==='1.2').i")
    check('E13 …but meals/size are locked, dead is open', pg.evaluate(f"document.getElementById('fs-{i}-m0').disabled && document.getElementById('fs-{i}-sz').disabled && !document.getElementById('fs-{i}-d').disabled"))
    pg.fill(f'#fs-{i}-d', '5'); pg.click('#fs-save'); pg.wait_for_timeout(500)
    f = pg.evaluate("getTX().find(t=>t.id==='fs-F1.S01T02-'+daToday())"); d = pg.evaluate("getTX().find(t=>t.id==='fsm-F1.S01T02-'+daToday())")
    check('E14 saves the dead count and leaves the feed record untouched', d and d['count'] == 5 and f and f['kg'] == 12.5, (d, f))
    check('E15 no page errors (mortality-only)', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok_, dt in RESULTS: print(('✅ ' if ok_ else '❌ ') + nm + ('' if ok_ else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
