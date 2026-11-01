# Feed sheet in "daily total" mode (default): one quantity per tank, copy from any day, photo of the per-meal paper → sum.
import os, sys, io, numpy as np; os.environ['E2E_PORT'] = '8820'
sys.path.insert(0, os.path.dirname(__file__))
from harness import *
from ocr_synth import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("localStorage.setItem(DA_SHEET_KEY, JSON.stringify({F1:[{from:1,to:1,meals:['7','10'],unit:'g'},{from:2,to:9,meals:['8','12']}]})); window._fs={farm:'F1'}; show('feed-sheet')"); pg.wait_for_timeout(400)
    ix = pg.evaluate("Object.fromEntries(window._fs.rows.map(r=>[r.unit,r.i]))")
    heads = pg.evaluate("[...document.querySelectorAll('.fs-t thead tr')].map(tr=>[...tr.cells].map(c=>c.textContent))")
    check('T1 default: one quantity column per tank (grams group says g)', heads[0][1] == 'Quantity (g)' and heads[1][1] == 'Quantity (kg)' and not pg.evaluate(f"!!document.getElementById('fs-{ix['F1.S01T01']}-m1')"), heads)
    pg.fill(f"#fs-{ix['F1.S01T01']}-m0", '1500'); pg.fill(f"#fs-{ix['F1.S01T01']}-sz", '1')
    pg.fill(f"#fs-{ix['F1.S02T01']}-m0", '6.5'); pg.fill(f"#fs-{ix['F1.S02T01']}-sz", '2'); pg.fill(f"#fs-{ix['F1.S02T01']}-d", '2+1')
    pg.fill(f"#fs-{ix['F1.S01T03']}-m0", 'X'); pg.click('#fs-save'); pg.wait_for_timeout(500)
    a = pg.evaluate("getTX().find(t=>t.id==='fs-F1.S01T01-'+daToday())"); b = pg.evaluate("getTX().find(t=>t.id==='fs-F1.S02T01-'+daToday())"); x = pg.evaluate("getTX().find(t=>t.id==='fs-F1.S01T03-'+daToday())")
    check('T2 saved as daily totals (1500 g → 1.5 kg), no meal breakdown', a['kg'] == 1.5 and a['meals'] == {} and b['kg'] == 6.5 and b['size'] == '2', (a, b))
    check('T2 X = not fed still works; dead 2+1 = 3', x['fasted'] and pg.evaluate("getTX().find(t=>t.id==='fsm-F1.S02T01-'+daToday()).count") == 3)
    # an older per-meal record shows as its total, and editing keeps one total
    y = pg.evaluate("daAddDays(daToday(),-1)")
    pg.evaluate(f"addTX({{id:'fs-F1.S02T02-{y}',type:'feeding',unit:'F1.S02T02',date:'{y}',kg:5,meals:{{'8':2,'12':3}},size:'2',source:'sheet',_skipValidation:true}})")
    pg.evaluate(f"window._fs.date='{y}'; show('feed-sheet',true)"); pg.wait_for_timeout(300)
    check('T3 a day entered by meals shows its total (2 + 3 = 5)', pg.input_value(f"#fs-{ix['F1.S02T02']}-m0") == '5')
    # copy from a day
    pg.evaluate("window._fs.date=daToday(); show('feed-sheet',true)"); pg.wait_for_timeout(300)
    pg.evaluate(f"addTX({{id:'fs-F1.S01T02-{y}',type:'feeding',unit:'F1.S01T02',date:'{y}',kg:4.25,size:'3',source:'sheet',_skipValidation:true}}); addTX({{id:'fsm-F1.S01T02-{y}',type:'mortality',unit:'F1.S01T02',date:'{y}',count:7,source:'sheet',_skipValidation:true}})")
    pg.evaluate(f"window._fs.date=daAddDays(daToday(),0); show('feed-sheet',true)"); pg.wait_for_timeout(300)
    pg.click('#fs-copy'); pg.fill('#fs-copy-date', y)
    msg = []; pg.once('dialog', lambda d: (msg.append(d.message), d.accept())); pg.click('#fs-copy-go'); pg.wait_for_timeout(300)
    check('T4 copying over typed values asks first', msg and 'هتتبدل' in msg[0], msg)
    got = [pg.input_value(f"#fs-{ix[u]}-m0") for u in ('F1.S02T02', 'F1.S01T02')]; sz = pg.input_value(f"#fs-{ix['F1.S01T02']}-sz"); dead = pg.input_value(f"#fs-{ix['F1.S01T02']}-d")
    check('T5 copy from yesterday: quantities (4.25 kg shown as 4250 g in a grams group) and sizes filled, dead NOT copied', got == ['5', '4250'] and sz == '3' and dead == '', (got, sz, dead))
    check('T5 copy only fills the screen (unsaved, tab marked)', pg.evaluate("_daActiveTab.dirty") and not pg.evaluate("getTX().some(t=>t.id==='fs-F1.S01T02-'+daToday())"))
    pg.fill(f"#fs-{ix['F1.S01T02']}-m0", '4500'); pg.click('#fs-save'); pg.wait_for_timeout(500)
    check('T6 edit after copy, then save → today recorded, yesterday untouched', pg.evaluate("getTX().find(t=>t.id==='fs-F1.S01T02-'+daToday()).kg") == 4.5 and pg.evaluate(f"getTX().find(t=>t.id==='fs-F1.S01T02-{y}').kg") == 4.25)
    # photo of the per-meal paper fills the daily total
    pg.evaluate("window._fs.date=daAddDays(daToday(),-2); show('feed-sheet',true)"); pg.wait_for_timeout(300)
    L = pg.evaluate("(() => { const L=daOcrFeedLayout('F1'); L.date=daOcrDateBoxes(); L.svg=daOcrSVG(L,0); return L; })()")
    pg2 = ctx.new_page(); pg2.set_viewport_size({'width': 1260, 'height': 1782})
    pg2.set_content('<html><body style="margin:0">' + L['svg'].replace('width="210mm" height="297mm"', 'width="1260" height="1782"') + '</body></html>')
    img = Image.open(io.BytesIO(pg2.screenshot(clip={'x': 0, 'y': 0, 'width': 1260, 'height': 1782}))).convert('RGB'); rng = np.random.default_rng(3)
    for ch, bx in zip(pg.evaluate("daAddDays(daToday(),-2).split('-').reverse().join('')"), L['date']): write_digit(img, rng, ch, bx, (20, 30, 120))
    line = [l for l in L['pages'][0]['lines'] if l.get('unit') == 'F1.S02T01'][0]   # (group header lines have no unit)
    for k, v in enumerate(['2.5', '3.5']): put(img, rng, line['cols']['meals'][k]['boxes'], v, (20, 30, 120), dot=1)   # kg boxes [ ][ ].[ ]
    open('/tmp/fst.jpg', 'wb').write(photo(img, rng, 0.6))
    pg.evaluate("() => { const i=document.createElement('input'); i.type='file'; i.id='t-ocr'; document.body.appendChild(i); }")
    pg.set_input_files('#t-ocr', ['/tmp/fst.jpg']); pg.evaluate("async () => await daOcrRun(Array.from(document.getElementById('t-ocr').files),'feed')"); pg.wait_for_timeout(500)
    check('T7 photo of the per-meal paper → the meals are summed into the daily total (2.5 + 3.5 = 6)', pg.input_value(f"#fs-{ix['F1.S02T01']}-m0") == '6', pg.input_value(f"#fs-{ix['F1.S02T01']}-m0"))
    pg.click('#fs-mode'); pg.wait_for_timeout(300)
    check('T8 one click switches to per-meal entry (and remembers it)', pg.evaluate(f"!!document.getElementById('fs-{ix['F1.S02T01']}-m1')") and pg.evaluate("JSON.parse(localStorage.getItem(DA_FS_MODE_KEY)).F1") == 'meals')
    check('T9 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
