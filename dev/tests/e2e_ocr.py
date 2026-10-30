# On-device photo reading of printed sheets, end to end, on synthetic phone photos (see ocr_synth.py).
import os, sys, json, time, numpy as np; os.environ['E2E_PORT'] = '8804'
sys.path.insert(0, os.path.dirname(__file__))
import harness
units = [(f'F2.S{s:02d}T{t:02d}', 800, 30) for s in range(1, 4) for t in range(1, 15)] + [(f'F2.S{s:02d}T{t:02d}', 600, 120) for s in (4, 5) for t in range(1, 15)] \
      + [(f'F2.S{s:02d}T{t:02d}', 5000, 300) for s in range(6, 16) for t in (1, 2)] + [(f'F2.S16T{t:02d}', 3000, 400) for t in range(1, 8)]
harness.DEFAULT_UNITS[:] = units
from harness import *
from ocr_synth import *
GROUPS = "[{from:1,to:3,meals:['8','10','12','2','4'],unit:'g'},{from:4,to:5,meals:['7','11','3']},{from:6,to:999,meals:['6:30','9:30','12:30','3:30']}]"
INKS = [(20, 30, 120), (15, 15, 25), (30, 40, 90)]

def render_pages(pg2, svgs):
    out = []
    for s in svgs:
        pg2.set_content('<html><body style="margin:0">' + s.replace('width="210mm" height="297mm"', 'width="1260" height="1782"') + '</body></html>')
        out.append(Image.open(io.BytesIO(pg2.screenshot(clip={'x': 0, 'y': 0, 'width': 1260, 'height': 1782}))).convert('RGB'))
    return out

def make_truth(rng, L):
    T = {}
    for pi, P in enumerate(L['pages']):
        for l in P['lines']:
            if l['kind'] != 'tank': continue
            g = l['g']; grams = g.get('unit') == 'g'; t = {'meals': [], 'size': None, 'fast': False, 'dead': [None, None], 'page': pi}
            if rng.random() < 0.04: t['fast'] = True; t['meals'] = [None] * len(g['meals'])
            else:
                # like the farm's real sheets: one amount per tank for most meals, sometimes a different one or a skipped meal
                pick = (lambda: str(int(rng.choice([150, 200, 250, 300, 450, 500, 600, 700, 800])))) if grams else \
                       (lambda: str(rng.choice(['1', '0.5', '.8', '1.2', '0.7', '1.5']))) if l['unit'] < 'F2.S06' else (lambda: str(rng.choice(['6', '8', '10', '9.5', '12', '7', '3', '4.5'])))
                base = pick()
                for k in range(len(g['meals'])):
                    if rng.random() < 0.15: t['meals'].append(None); continue
                    t['meals'].append(base if rng.random() < 0.85 else pick())
                if any(t['meals']): t['size'] = str(int(rng.integers(1, 4)))
            if rng.random() < 0.35: t['dead'][0] = str(int(rng.choice([1, 2, 3, 4, 6, 7, 12])))
            if t['dead'][0] and rng.random() < 0.3: t['dead'][1] = str(int(rng.integers(1, 4)))
            T[l['unit']] = t
    return T

def draw(page_img, rng, L, pi, T, date):
    ink = INKS[pi % len(INKS)]
    for ch, b in zip(date, L['date']): write_digit(page_img, rng, ch, b, ink)
    for l in L['pages'][pi]['lines']:
        if l['kind'] != 'tank': continue
        t = T[l['unit']]; c = l['cols']; grams = l['g'].get('unit') == 'g'
        for v, m in zip(t['meals'], c['meals']):
            if v: put(page_img, rng, m['boxes'], v, ink, None if grams else 1)
        if t['size']: fill_bubble(page_img, rng, c['size'][int(t['size']) - 1], ink)
        if t['fast']: fill_bubble(page_img, rng, c['fast'], ink)
        for v, d in zip(t['dead'], c['dead']):
            if v: put(page_img, rng, d['boxes'], v, ink)

def num(s): return None if s in (None, '') else float(s)

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=15000)
    pg.evaluate(f"localStorage.setItem(DA_SHEET_KEY, JSON.stringify({{F2:{GROUPS}}})); window._fs={{farm:'F2'}}; show('feed-sheet')"); pg.wait_for_timeout(500)
    L = pg.evaluate("(() => { const L=daOcrFeedLayout('F2'); L.date=daOcrDateBoxes(); L.svgs=L.pages.map((p,i)=>daOcrSVG(L,i)); return L; })()")
    check('R1 F2 (97 tanks) prints as ' + str(len(L['pages'])) + ' A4 pages, every tank once', len(L['pages']) >= 3 and sum(1 for P in L['pages'] for l in P['lines'] if l['kind'] == 'tank') == 97)
    check('R1 buttons in the feed sheet: print + photo', pg.evaluate("!!document.getElementById('fs-print') && !!document.getElementById('fs-photo')"))
    pg2 = ctx.new_page(); pg2.set_viewport_size({'width': 1260, 'height': 1782})
    pages = render_pages(pg2, L['svgs'])
    rng = np.random.default_rng(7); T = make_truth(rng, L); date = '27102026'
    files = []
    for pi, im in enumerate(pages):
        im = im.copy(); draw(im, rng, L, pi, T, date)
        fn = f'/tmp/ocr_p{pi}.jpg'; open(fn, 'wb').write(photo(im, rng, 1.0)); files.append(fn)
    # also: one page upside down
    up = pages[0].copy(); draw(up, np.random.default_rng(7), L, 0, T, date)
    open('/tmp/ocr_up.jpg', 'wb').write(photo(up.rotate(180), np.random.default_rng(3), 0.6))
    pg.evaluate("() => { const i=document.createElement('input'); i.type='file'; i.id='t-ocr'; i.multiple=true; document.body.appendChild(i); }")
    pg.set_input_files('#t-ocr', files)
    t0 = time.time(); R = pg.evaluate("async () => await daOcrReadFiles(Array.from(document.getElementById('t-ocr').files),'feed')"); dt = time.time() - t0
    check('R2 every page recognised (corners, code strip, page number)', len(R['pages']) == len(files) and not R['errs'], R['errs'])
    check(f'R2 speed: {dt / len(files):.1f} s per page', dt / len(files) < 8)
    ds = [p_['date'] for p_ in R['pages']]
    check('R3 date read from the boxes (never a wrong date; one page is enough)', any(ds) and all(d['v'] == '2026-10-27' for d in ds if d), ds)
    # score
    stat = {'n': 0, 'ok': 0, 'flag': 0, 'bad_unflagged': [], 'empty_ok': 0, 'empty_n': 0}
    def score(truth, got, label):
        if truth is None:
            stat['empty_n'] += 1; stat['empty_ok'] += got is None
            if got is not None: stat['bad_unflagged'].append((label, None, got['text']))
            return
        stat['n'] += 1
        if got is None: stat['bad_unflagged'].append((label, truth, None)); return
        ok = abs(num(got['text']) - num(truth)) < 1e-6; low = got['conf'] < 0.85
        if low: stat.setdefault('why', {}).setdefault(('rule' if got['conf'] == 0.5 else 'model') + ('-right' if ok else '-wrong'), 0); stat['why'][('rule' if got['conf'] == 0.5 else 'model') + ('-right' if ok else '-wrong')] += 1
        stat['ok'] += ok; stat['flag'] += low
        if ok and got['conf'] == 0.5 and len(stat.setdefault('rr', [])) < 14: stat['rr'].append((label, truth, got.get('boxes')))
        if not ok and not low: stat['bad_unflagged'].append((label, truth, got['text'], round(got['conf'], 3)))
    sz = {'n': 0, 'ok': 0}; fast = {'n': 0, 'ok': 0}
    for P in R['pages']:
        for r in P['rows']:
            t = T[r['unit']]
            for k, (tv, gv) in enumerate(zip(t['meals'], r['meals'])): score(None if t['fast'] else tv, None if r['fast'] else gv, r['unit'] + ' m' + str(k))
            for k in range(2): score(t['dead'][k], r['dead'][k], r['unit'] + ' dead' + str(k))
            sz['n'] += 1; sz['ok'] += (t['size'] == (r['size'] or {}).get('v') if t['size'] else r['size'] is None)
            fast['n'] += 1; fast['ok'] += t['fast'] == r['fast']
    acc = stat['ok'] / stat['n']; bad = stat['bad_unflagged']
    print(f"   fields {stat['n']} · exact {acc:.3f} · flagged for review {stat['flag']} · empty boxes kept empty {stat['empty_ok']}/{stat['empty_n']} · size {sz['ok']}/{sz['n']} · not-fed {fast['ok']}/{fast['n']}")
    print('   wrong AND not flagged:', bad[:12]); print('   why flagged:', stat.get('why')); print('   rule-right samples:', stat.get('rr'))
    check('R4 handwritten numbers read correctly ≥ 90% of fields (harsh synthetic photos)', acc >= 0.90, acc)
    check('R5 wrong values that are NOT flagged for review ≤ 1% of fields (the number that matters)', len(bad) <= 0.01 * (stat['n'] + stat['empty_n']), bad)
    check('R5 a digit split across two boxes never silently becomes ×10 (0.7 → 10.7)', not [b for b in bad if b[2] and b[1] and num(b[2]) >= 8 * num(b[1])], bad)
    check('R6 size circles ≥ 98%, not-fed circles ≥ 98%', sz['ok'] / sz['n'] >= 0.98 and fast['ok'] / fast['n'] >= 0.98, (sz, fast))
    pg.set_input_files('#t-ocr', ['/tmp/ocr_up.jpg'])
    U = pg.evaluate("async () => await daOcrReadFiles(Array.from(document.getElementById('t-ocr').files),'feed')")
    check('R7 page photographed upside down still recognised', len(U['pages']) == 1 and U['pages'][0]['page'] == 0, U['errs'])
    # into the sheet, then save
    pg.on('dialog', lambda d: d.accept())
    pg.set_input_files('#t-ocr', files)
    pg.evaluate("async () => await daOcrRun(Array.from(document.getElementById('t-ocr').files),'feed')"); pg.wait_for_timeout(800)
    check('R8 sheet switched to the date on the paper', pg.evaluate("window._fs.date") == '2026-10-27')
    filled = pg.evaluate("document.querySelectorAll('.fs-t input.ocr-read').length"); lowc = pg.evaluate("document.querySelectorAll('.fs-t input.ocr-low').length")
    check(f'R8 values filled into the on-screen sheet ({filled}), unsure ones highlighted ({lowc})', filled > 150)
    check('R8 nothing saved until the user presses save', not pg.evaluate("getTX().some(t=>t.source==='sheet')"))
    check('R8 tab marked unsaved', pg.evaluate("_daActiveTab.dirty"))
    pg.evaluate("document.querySelectorAll('.fs-t input.ocr-low').forEach(x => { x.value=''; x.dispatchEvent(new Event('input',{bubbles:true})); })")
    pg.click('#fs-save'); pg.wait_for_timeout(1200)
    check('R9 after review, save works as usual', pg.evaluate("getTX().filter(t=>t.source==='sheet').length") > 50, pg.evaluate("(window.__toasts||[]).slice(-2)"))
    # guards
    pg.evaluate("localStorage.setItem(DA_SHEET_KEY, JSON.stringify({F2:[{from:1,to:999,meals:['7','10','1','4']}]})); show('feed-sheet',true)"); pg.wait_for_timeout(300)
    pg.set_input_files('#t-ocr', [files[0]])
    S = pg.evaluate("async () => await daOcrReadFiles(Array.from(document.getElementById('t-ocr').files),'feed')")
    check('R10 a copy printed before the meal times changed is refused (reprint)', not S['pages'] and 'اطبع نسخة جديدة' in ' '.join(S['errs']), S['errs'])
    blank = Image.new('RGB', (1200, 1600), (235, 235, 230)); bb = io.BytesIO(); blank.save(bb, 'JPEG'); open('/tmp/ocr_blank.jpg', 'wb').write(bb.getvalue())
    pg.set_input_files('#t-ocr', ['/tmp/ocr_blank.jpg'])
    B = pg.evaluate("async () => await daOcrReadFiles(Array.from(document.getElementById('t-ocr').files),'feed')")
    check('R11 a photo that is not a sheet gives a clear message', not B['pages'] and 'المربعات السودا' in ' '.join(B['errs']), B['errs'])
    # water sheet
    pg.evaluate("window._wqs={farm:'F2'}; show('wq-sheet')"); pg.wait_for_timeout(400)
    W = pg.evaluate("(() => { const L=daOcrWqLayout('F2'); L.date=daOcrDateBoxes(); L.svg=daOcrSVG(L,0); return L; })()")
    wimg = render_pages(pg2, [W['svg']])[0]; rng2 = np.random.default_rng(11); WT = {}
    for ch, b in zip('28102026', W['date']): write_digit(wimg, rng2, ch, b, INKS[0])
    for l in W['pages'][0]['lines']:
        v = {'temp': str(rng2.choice(['27.5', '28.1', '26', '29.4'])), 'ph': str(rng2.choice(['7.2', '6.85', '7.6', '8'])), 'do': str(rng2.choice(['6.5', '5.8', '4.2', '7']))}
        WT[l['sec']] = v
        for k, dot in (('temp', 1), ('ph', 0), ('do', 1)): put(wimg, rng2, l[k]['boxes'], v[k], INKS[0], dot)
    open('/tmp/ocr_wq.jpg', 'wb').write(photo(wimg, rng2, 0.8))
    pg.set_input_files('#t-ocr', ['/tmp/ocr_wq.jpg'])
    WR = pg.evaluate("async () => await daOcrReadFiles(Array.from(document.getElementById('t-ocr').files),'wq')")
    ok = n = 0
    for r in (WR['pages'][0]['rows'] if WR['pages'] else []):
        for k in ('temp', 'ph', 'do'):
            n += 1; g = r[k]; ok += bool(g) and abs(float(g['text']) - float(WT[r['sec']][k])) < 1e-6
    check(f'R12 water sheet read: {ok}/{n} readings exact', WR['pages'] and ok / max(n, 1) >= 0.9, WR['errs'])
    pg.set_input_files('#t-ocr', ['/tmp/ocr_wq.jpg']); pg.evaluate("async () => await daOcrRun(Array.from(document.getElementById('t-ocr').files),'wq')"); pg.wait_for_timeout(600)
    check('R12 readings filled into the testing log with ✓/✗ computed', pg.evaluate("document.querySelectorAll('.wqs-t input.ocr-read').length") >= 30 and pg.evaluate("document.querySelectorAll('.wqs-t .wqs-ok.v, .wqs-t .wqs-ok.x').length") >= 10)
    check('R13 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok_, dt_ in RESULTS: print(('✅ ' if ok_ else '❌ ') + nm + ('' if ok_ else f'  → {str(dt_)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
