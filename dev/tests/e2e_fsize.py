# Feed size per tank: no formula; the size the tank is on; a supervisor pins sizes (synced); a worker's change becomes the normal.
import os; os.environ['E2E_PORT'] = '8876'
import harness
harness.DEFAULT_UNITS[:] = [(f'F1.S01T{t:02d}', 500, 30) for t in range(1, 5)] + [(f'F1.S02T{t:02d}', 500, 300) for t in range(1, 5)]
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality'])
    c1, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.on('dialog', lambda d: d.accept())
    T = pg.evaluate("daToday()"); Y = pg.evaluate("daAddDays(daToday(),-1)")
    pg.evaluate(f"window._fs={{farm:'F1',date:'{Y}'}}; show('feed-sheet')"); pg.wait_for_timeout(400)
    szs = pg.evaluate("window._fs.rows.filter(r=>r.i!==undefined).map(r=>{ const e=document.getElementById('fs-'+r.i+'-sz'); return e ? e.value : 'NOEL:'+r.unit; })")
    check('Z1 no formula: a tank never fed and never pinned has no size yet', all(z == '' for z in szs), szs)
    check('Z2 supervisors get "size of the section" and "📌 pin"', pg.evaluate("!!document.getElementById('fs-pin') && document.querySelectorAll('.fs-gsz').length >= 1"))
    pg.evaluate("document.querySelectorAll('.fs-group')[0].querySelector('.fs-gsz button:nth-of-type(2)').click()"); pg.wait_for_timeout(100)
    szs = pg.evaluate("window._fs.rows.filter(r=>r.i!==undefined).map(r=>{ const e=document.getElementById('fs-'+r.i+'-sz'); return e ? e.value : 'NOEL:'+r.unit; })")
    check('Z3 one tap fills the section\'s size', szs[:4] == ['2', '2', '2', '2'], szs)
    pg.click('#fs-pin'); pg.wait_for_timeout(400)
    check('Z4 pinned per tank from that day, in a synced key', pg.evaluate("daFsStd()['F1.S01T03']") == {'size': '2', 'from': Y} and pg.evaluate("daIsSyncedKey(DA_FSIZE_KEY)"))
    c2, pw = new_page(p, sb); login(pw, 'w@workers.dar-aqua.app', 'work123'); pw.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pw.wait_for_timeout(500)
    pw.evaluate("daTabRefresh()"); pw.wait_for_timeout(1200)
    pw.evaluate("window._fs={farm:'F1'}; show('feed-sheet',true)"); pw.wait_for_timeout(400)
    sz = lambda pgx, u: pgx.evaluate(f"(r => r ? document.getElementById('fs-'+r.i+'-sz').value : null)(window._fs.rows.find(r=>r.unit==='{u}'))")
    check('Z5 the worker\'s phone shows the pinned size by itself', sz(pw, 'F1.S01T03') == '2' and sz(pw, 'F1.S01T01') == '2', (sz(pw, 'F1.S01T03'), sz(pw, 'F1.S02T01')))
    check('Z6 workers have no pin buttons', not pw.evaluate("!!document.getElementById('fs-pin') || !!document.querySelector('.fs-gsz')"))
    i = pw.evaluate("window._fs.rows.find(r=>r.unit==='F1.S01T03').i"); pw.fill(f'#fs-{i}-m0', '3'); pw.fill(f'#fs-{i}-sz', '3')
    for u in ['F1.S01T01', 'F1.S01T02', 'F1.S01T04']:
        k = pw.evaluate(f"window._fs.rows.find(r=>r.unit==='{u}').i"); pw.fill(f'#fs-{k}-m0', '3')
    pw.click('#fs-save'); pw.wait_for_timeout(600)
    pw.evaluate(f"window._fs={{farm:'F1',date:daAddDays(daToday(),1)}}; show('feed-sheet',true)"); pw.wait_for_timeout(300)
    check('Z7 the worker changed one tank to 3 → that is its normal from the next day; the others stay 2', sz(pw, 'F1.S01T03') == '3' and sz(pw, 'F1.S01T01') == '2', (sz(pw, 'F1.S01T03'), sz(pw, 'F1.S01T01')))
    # the supervisor pins a newer size later → it wins
    pg.evaluate(f"window._fs={{farm:'F1',date:daAddDays(daToday(),1)}}; show('feed-sheet',true)"); pg.wait_for_timeout(300)
    pg.evaluate("daRealtimePull()"); pg.wait_for_timeout(800); pg.evaluate("show('feed-sheet',true)"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelectorAll('.fs-group')[0].querySelector('.fs-gsz button:nth-of-type(1)').click()"); pg.click('#fs-pin'); pg.wait_for_timeout(400)
    check('Z8 a newer pin wins over the last fed size', pg.evaluate("daFsDefSize('F1.S01T03', daAddDays(daToday(),1)).size") == '1')
    check('Z9 no page errors', not pg._errs and not pw._errs, pg._errs + pw._errs)
    c1.close(); c2.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
