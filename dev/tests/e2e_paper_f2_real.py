# FH2's own feed log — REAL photos (front = sections 1–3 in grams, back = 4–16 in kg), read by eye into fh2_real_truth.json.
# The farm feeds the first and the last meal; X = not fed (empty tank or fish not fed) → the sheet's "not fed" mark.
import os, sys, json, base64; os.environ['E2E_PORT'] = os.environ.get('E2E_PORT', '8850')
sys.path.insert(0, os.path.dirname(__file__))
import harness
F2 = [(f'F2.S{s:02d}T{t:02d}', 3000, 5) for s in range(1, 4) for t in range(1, 15)] + [(f'F2.S{s:02d}T{t:02d}', 2000, 80) for s in (4, 5) for t in range(1, 15)] \
   + [(f'F2.S{s:02d}T{t:02d}', 9000, 200) for s in range(6, 16) for t in (1, 2)] + [(f'F2.S16T{t:02d}', 1500, 60) for t in range(1, 8)]
harness.DEFAULT_UNITS[:] = F2 + [('F1.S01T01', 500, 100)]
from harness import *
D = os.path.join(os.path.dirname(__file__), 'data'); T = json.load(open(os.path.join(D, 'fh2_real_truth.json')))
def score(rows, truth):
    s = {'num_ok': 0, 'num': 0, 'x_ok': 0, 'x': 0, 'empty_ok': 0, 'empty': 0, 'wrong_unflagged': 0, 'yellow': 0, 'note_flagged': 0, 'note': 0, 'bad': []}
    for r in rows:
        g = truth.get(r['label'])
        if not g: continue
        for k, t in enumerate(g['meals']):
            m = r['meals'][k] if k < len(r['meals']) else None
            got = 'X' if (m and m.get('x')) else (None if (m is None or m.get('v') is None) else m['v']); low = m is not None and m.get('conf', 1) < 0.85
            if low: s['yellow'] += 1
            if t == 'skip': continue
            if t == 'note':
                s['note'] += 1; s['note_flagged'] += 1 if (got is None and not m) or low else 0; continue
            if t == 'X': s['x'] += 1; ok = got == 'X'; s['x_ok'] += ok
            elif t is None: s['empty'] += 1; ok = got is None; s['empty_ok'] += ok
            else: s['num'] += 1; ok = got is not None and got != 'X' and abs(got - t) < 1e-6; s['num_ok'] += ok
            if not ok and not low: s['wrong_unflagged'] += 1; s['bad'].append((r['label'], k, t, got))
    return s
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    R = {}
    for k in (1, 2):
        pg.evaluate("(k) => { const i=document.createElement('input'); i.type='file'; i.id='t-p'+k; document.body.appendChild(i); }", k)
        pg.set_input_files(f'#t-p{k}', [os.path.join(D, f'fh2_page{k}_real.jpg')])
        r = pg.evaluate("""async (k) => { const I = await daOcrLoad(document.getElementById('t-p'+k).files[0]); const R = daPaperRead(I,'F2',null);
          if(R.grid && !R.err){ const cv=document.createElement('canvas'); cv.width=I.W; cv.height=I.H; const cx=cv.getContext('2d'); const id=cx.createImageData(I.W,I.H);
            for(let q=0;q<I.W*I.H;q++){ const v=I.g[q]*255; id.data[4*q]=v; id.data[4*q+1]=v; id.data[4*q+2]=v; id.data[4*q+3]=255; } cx.putImageData(id,0,0); cx.lineWidth=2;
            cx.strokeStyle='red'; R.grid.rows.forEach(f=>{ cx.beginPath(); cx.moveTo(0,f.b); cx.lineTo(I.W,f.a*I.W+f.b); cx.stroke(); });
            cx.strokeStyle='lime'; R.grid.cols.forEach(f=>{ cx.beginPath(); cx.moveTo(f.b,0); cx.lineTo(f.a*I.H+f.b,I.H); cx.stroke(); }); R.png = cv.toDataURL('image/jpeg',0.6); R.rowFit = R.grid.rowFit; R.edges = R.grid.edges; R.WH=[I.W,I.H]; }
          delete R.grid; return R; }""", k)
        if r.get('png'): open(f'/tmp/real_ov{k}.jpg', 'wb').write(base64.b64decode(r.pop('png').split(',')[1]))
        R[k] = r; s = score(r.get('rows', []), T['page%d' % k])
        print(f"   page {k}: read as page {r.get('page', -1) + 1} ({r.get('unit')}) rowFit {r.get('rowFit', 0):.2f} weak {r.get('weak')} · numbers {s['num_ok']}/{s['num']} · X {s['x_ok']}/{s['x']} · empty {s['empty_ok']}/{s['empty']} · note flagged {s['note_flagged']}/{s['note']} · {s['yellow']} yellow · WRONG unflagged {s['wrong_unflagged']}")
        if os.environ.get('SHOWBAD'): print('      bad:', s['bad'][:14]); print('      edges:', r.get('edges'), r.get('WH'))
        R[k]['s'] = s
    if not os.environ.get('NOCHECK'):
        check('R1 front → page 1 (grams), back → page 2 (kg)', R[1].get('page') == 0 and R[2].get('page') == 1)
        for k in (1, 2):
            s = R[k]['s']
            check(f'R2 page {k}: nothing wrong slips through without yellow', s['wrong_unflagged'] == 0, s['bad'][:8])
        check('R3 the grid of these photos is not certain yet → marked for checking (everything yellow, with the message)', R[1].get('weak') and R[2].get('weak'))
        check('R5 the note across row 16.3 is not taken as feed', R[2]['s']['note_flagged'] == R[2]['s']['note'])
        check('R6 no page errors', not pg._errs, pg._errs)
        for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
        print(f"\n{sum(1 for r in RESULTS if r[1])}/{len(RESULTS)} passed")
    ctx.close()
