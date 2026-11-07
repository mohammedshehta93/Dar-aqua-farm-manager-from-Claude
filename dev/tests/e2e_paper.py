# The farm's OWN paper (FH1 feed log, no marks) read from a real photo through the feed sheet's 📷 button.
# Needs the owner's photo in /mnt/user-data/uploads (like the 2510.xls suites).
import os, sys; os.environ['E2E_PORT'] = '8823'
sys.path.insert(0, os.path.dirname(__file__))
import harness
harness.DEFAULT_UNITS[:] = [(f'F1.S{s:02d}T{t:02d}', 500, 100) for s in range(1, 13) for t in range(1, (7 if s == 6 else 5))]
from harness import *
from paper_truth import FH1_2026_10_31 as GT
PHOTO = '/mnt/user-data/uploads/a49abf5f-98f1-4336-8d01-4837049e4404.jpg'
if not os.path.exists(PHOTO): print('SKIP: photo not available'); sys.exit()
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    # the day before is on record, like on the farm: same pellet size; the same amount for about 3 tanks in 4, more for the rest
    Y = {k: [v[1], round(sum(m for m in v[0] if m) + (0 if i % 4 else 0.4), 3)] for i, (k, v) in enumerate(GT.items())}
    pg.evaluate("Y => Object.keys(Y).forEach(l => { const [s,t]=l.split('.'); const u='F1.S'+s.padStart(2,'0')+'T'+t.padStart(2,'0'); addTX({id:'y-'+u,type:'feeding',unit:u,date:'2026-10-30',kg:Y[l][1],size:Y[l][0],source:'sheet',_skipValidation:true}); })", Y)
    pg.evaluate("window._fs={farm:'F1',date:'2026-10-31'}; show('feed-sheet')"); pg.wait_for_timeout(400)
    pg.evaluate("() => { const i=document.createElement('input'); i.type='file'; i.id='t-ocr'; document.body.appendChild(i); }"); pg.set_input_files('#t-ocr', [PHOTO])
    msgs = []; pg.on('dialog', lambda d: (msgs.append(d.message), d.accept()))
    n0 = pg.evaluate("getTX().length")
    pg.evaluate("async () => await daOcrRun(Array.from(document.getElementById('t-ocr').files),'feed')"); pg.wait_for_timeout(800)
    S = pg.evaluate("Object.fromEntries(window._fs.rows.filter(r=>r.i!==undefined).map(r=>{ const g=id=>document.getElementById('fs-'+r.i+'-'+id); return [r.no.label,{v:g('m0').value, low:g('m0').classList.contains('ocr-low'), sz:g('sz').value, szlow:g('sz').classList.contains('ocr-low'), d:g('d').value, dlow:g('d').classList.contains('ocr-low')}]; }))")
    ok = tot = bad = flagged = 0
    for lab, (meals, size, dead) in GT.items():
        if None in meals: continue
        tot += 1; x = S[lab]; right = x['v'] != '' and abs(float(x['v']) - sum(meals)) < 1e-6
        ok += right; flagged += x['low']; bad += (not right and not x['low'])
    print(f'   daily totals: {ok}/{tot} exact · {flagged} yellow · {bad} wrong without yellow')
    check('P1 the farm\'s own paper is recognised (no printed marks needed) and fills the sheet', ok > 0 and any('الورقة العادية' in m for m in msgs), msgs[:1])
    check('P2 most daily totals read right (≥ 55 %)', ok >= tot * 0.55, (ok, tot))
    check('P3 wrong totals almost always yellow (≤ 2 unflagged)', bad <= 2, bad)
    check('P4 pellet size from the day before when the paper is unclear: all sizes right', all(S[l]['sz'] == v[1] for l, v in GT.items()), [(l, S[l]['sz'], v[1]) for l, v in GT.items() if S[l]['sz'] != v[1]][:5])
    dd = [(l, S[l]['d'], S[l]['dlow']) for l in GT if S[l]['d']]
    check('P5 every dead count read from the old paper is yellow (always confirmed by a person)', dd and all(x[2] for x in dd), dd)
    check('P6 the dead in 1.2 (2+1, shown for checking), 3.3 and 4.3 are found', S['1.2']['d'] != '' and S['1.2']['dlow'] and S['3.3']['d'] == '1' and S['4.3']['d'] == '1', (S['1.2']['d'], S['3.3']['d'], S['4.3']['d']))
    check('P7 the handwritten date is not trusted: the note names the day the values went into', any('2026-10-31' in m for m in msgs), msgs[:1])
    check('P8 nothing saved until Save', pg.evaluate("getTX().length") == n0)
    check('P9 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok_, dt in RESULTS: print(('✅ ' if ok_ else '❌ ') + nm + ('' if ok_ else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
