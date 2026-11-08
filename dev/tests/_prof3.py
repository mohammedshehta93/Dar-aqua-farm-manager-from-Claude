import os, sys, time; os.environ['E2E_PORT'] = '8846'; sys.path.insert(0, 'dev/tests')
exec(open('dev/tests/perf_year.py').read().split("def t(pg, js):")[0].replace("os.environ['E2E_PORT'] = '8842'", ""))
def prof(ctx, pg, js, label):
    cdp = ctx.new_cdp_session(pg); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 100}); cdp.send('Profiler.start')
    ms = pg.evaluate("(() => { const t0=performance.now(); " + js + "; return Math.round(performance.now()-t0); })()")
    pr = cdp.send('Profiler.stop')['profile']; nodes = {n['id']: n for n in pr['nodes']}; parent = {}
    for n in pr['nodes']:
        for c in n.get('children', []): parent[c] = n['id']
    incl = {}
    for s, d in zip(pr['samples'], pr['timeDeltas']):
        seen = set(); x = s
        while x in nodes:
            k = nodes[x]['callFrame']['functionName']
            if k and k not in seen: incl[k] = incl.get(k, 0) + d; seen.add(k)
            x = parent.get(x)
    print(f'=== {label}: {ms} ms'); [print(f'{v/1000:6.0f}  {k}') for k, v in sorted(incl.items(), key=lambda x: -x[1])[:22] if v > 8000]
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=20000)
    pg.evaluate(GEN, [u[0] for u in U]); pg.wait_for_timeout(4000)
    pg.evaluate("window._fs={farm:'F2'}; show('feed-sheet',true)")
    prof(ctx, pg, "window._fs={farm:'F2'}; show('feed-sheet',true)", 'open feed sheet')
    prof(ctx, pg, "window._fs.rows.forEach(r=>{ const e=document.getElementById('fs-'+r.i+'-m0'); if(e && !e.disabled) e.value='3'; }); daFsSave()", 'save feed sheet')
