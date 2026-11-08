# FH2's own two-page feed log read from photos (synthetic: the farm's Word form filled in and photographed-like —
# tests the page detection, both halves per page, grams on page 1, per-half meal counts / limits on page 2).
import os, sys, json; os.environ['E2E_PORT'] = '8847'
sys.path.insert(0, os.path.dirname(__file__))
import harness
F2 = [(f'F2.S{s:02d}T{t:02d}', 3000, 5) for s in range(1, 4) for t in range(1, 15)] + [(f'F2.S{s:02d}T{t:02d}', 2000, 80) for s in (4, 5) for t in range(1, 15)] \
   + [(f'F2.S{s:02d}T{t:02d}', 9000, 200) for s in range(6, 16) for t in (1, 2)] + [(f'F2.S16T{t:02d}', 1500, 60) for t in range(1, 8)]
harness.DEFAULT_UNITS[:] = F2 + [('F1.S01T01', 500, 100)]
from harness import *
D = os.path.join(os.path.dirname(__file__), 'data'); GT = json.load(open(os.path.join(D, 'fh2_synthetic_truth.json')))
def score(rows):
    ok = tot = wrong_unflagged = yel = 0
    for r in rows:
        g = GT.get(r['label']); 
        if not g: continue
        for k, t in enumerate(g['meals']):
            m = r['meals'][k] if k < len(r['meals']) else None; tot += 1
            got = None if (m is None or m['v'] is None) else m['v']; low = m is not None and m['conf'] < 0.85
            if (t is None and got is None) or (t is not None and got is not None and abs(got - t) < 1e-6): ok += 1
            elif not low: wrong_unflagged += 1
            yel += 1 if low else 0
    return ok, tot, wrong_unflagged, yel
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    res = {}
    for k in (1, 2):
        pg.evaluate("() => { const i=document.createElement('input'); i.type='file'; i.id='t-p" + str(k) + "'; document.body.appendChild(i); }")
        pg.set_input_files(f'#t-p{k}', [os.path.join(D, f'fh2_page{k}_synthetic.jpg')])
        res[k] = pg.evaluate("async (k) => { const I = await daOcrLoad(document.getElementById('t-p'+k).files[0]); const R = daPaperRead(I,'F2',null); delete R.grid; return R; }", k)
        if res[k].get('err'): print('ERR', k, res[k]['err'])
        ok, tot, wu, yel = score(res[k].get('rows', []))
        print(f'   page {k}: identified as page {res[k].get("page", "?") + 1 if "page" in res[k] else "?"} ({res[k].get("unit")}) · meals {ok}/{tot} exact · {yel} yellow · {wu} wrong without yellow · tanks {len(res[k].get("rows", []))}')
        res[k]['score'] = (ok, tot, wu)
    check('F1 page 1 (sections 1–3) is recognised as page 1, in grams', res[1].get('page') == 0 and res[1].get('unit') == 'g')
    check('F2 page 2 (sections 4–16) is recognised as page 2, in kg', res[2].get('page') == 1 and res[2].get('unit') == 'kg')
    labs1 = sorted({r['label'] for r in res[1]['rows']}, key=lambda s: tuple(map(int, s.split('.')))); labs2 = {r['label'] for r in res[2]['rows']}
    check('F3 page 1: the 42 tanks of sections 1–3, from both halves', len(labs1) == 42 and '1.1' in labs1 and '3.14' in labs1 and '2.8' in labs1, labs1[:5])
    check('F4 page 2: the 55 tanks of sections 4–16 (3 meals left, 4 right)', len(labs2) == 55 and '16.7' in labs2 and all(len(r['meals']) == (3 if int(r['label'].split('.')[0]) <= 5 else 4) for r in res[2]['rows']))
    P = "[{d:1,p:0.99,P:[]},{d:2,p:0.99,P:[]},{d:0,p:0.99,P:[]}]"; P2 = "[{d:1,p:0.99,P:[]},{d:2,p:0.99,P:[]}]"
    check('F5 grams page: "120" is 120 g (no kg decimal rule)', pg.evaluate(f"daPaperMeal({P}, 3000, 'g').v") == 120)
    check('F6 limits per half: "12" on the small fiber tanks = 1.2 kg (point missed), on the big concrete tanks = 12 kg',
          pg.evaluate(f"daPaperMeal({P2}, 8, 'kg').v") == 1.2 and pg.evaluate(f"daPaperMeal({P2}, 40, 'kg').v") == 12)
    for k in (1, 2):
        ok, tot, wu = res[k]['score']
        check(f'F7 page {k}: nothing wrong slips through without yellow', wu == 0, (ok, tot, wu))
    check('F7b page 2 (faint lines, printed digits): most values already read right', res[2]['score'][0] >= res[2]['score'][1] * 0.6, res[2]['score'])
    check('F7c faint grid lines → the reading says so and marks everything for checking', res[1].get('weak') is True)
    check('F8 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
