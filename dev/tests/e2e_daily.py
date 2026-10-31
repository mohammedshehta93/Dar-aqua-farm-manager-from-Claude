# Daily overview computed from the records (late entries land in their day; no frozen snapshots).
import os; os.environ['E2E_PORT'] = '8817'
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    d5 = pg.evaluate("daAddDays(daToday(),-5)")
    pg.evaluate("window._do={}; show('daily-overview')"); pg.wait_for_timeout(300)
    before = pg.evaluate(f"daDailyStats(daToday(),14,'all').find(r=>r.date==='{d5}')")
    # entered LATER for a day five days ago (end-of-week habit)
    pg.evaluate(f"""() => {{ const A=o=>addTX(Object.assign({{_skipValidation:true,source:'sheet'}},o));
      A({{id:'lf1',type:'feeding',unit:'F1.S01T01',date:'{d5}',kg:12.5}}); A({{id:'lf2',type:'feeding',unit:'F1.S01T02',date:'{d5}',kg:7.5}});
      A({{id:'lm1',type:'mortality',unit:'F1.S01T01',date:'{d5}',count:4}}); A({{id:'lh1',type:'harvesting',unit:'F1.S02T02',date:'{d5}',fishNo:704,kg:280}}); }}""")
    pg.evaluate(f"window._do={{date:'{d5}'}}; show('daily-overview',true)"); pg.wait_for_timeout(300)
    R = pg.evaluate(f"daDailyStats('{d5}',14,'all').find(r=>r.date==='{d5}')")
    check('D1 feed entered later shows in ITS day (20 kg, 2 of N tanks)', R['feed'] == 20 and R['fedTanks'] == 2, R)
    check('D2 mortality and harvest of that day', R['dead'] == 4 and R['harvKg'] == 280 and R['harvFish'] == 704, R)
    check('D3 harvested-out tank leaves the stocked count from that day', R['tanks'] == before['tanks'] - 1 and R['fish'] == before['fish'] - 704 - 4, (before['tanks'], R['tanks'], before['fish'], R['fish']))
    ov = pg.evaluate(f"(() => {{ const rows=daOverviewRows('{d5}','all'); return {{fish:rows.reduce((s,r)=>s+r.fish,0), tanks:rows.length}}; }})()")
    check('D4 same day: totals equal the Site Overview for that date', ov['fish'] == R['fish'] and ov['tanks'] == R['tanks'], (ov, R['fish'], R['tanks']))
    check('D5 page shows the day selected, with its numbers', '20.0' in content(pg) and pg.evaluate("d => !!document.querySelector(`#do-t tr[data-d='${d}']`)", d5))
    check('D6 no snapshot needed (works on a fresh device)', pg.evaluate("localStorage.removeItem('daracqua_snapshots_v1'); show('daily-overview',true); !!document.getElementById('do-t')"))
    pg.evaluate("show('all-units')"); pg.wait_for_timeout(200)
    check('D7 old "all units" link opens the dated Site Overview', pg.evaluate("!!document.getElementById('ov-t')"))
    t0 = pg.evaluate("(() => { const t=performance.now(); _dataVer++; daDailyStats(daToday(),30,'all'); return performance.now()-t; })()")
    check(f'D8 30 days computed in {t0:.0f} ms', t0 < 2000, t0)
    check('D9 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
