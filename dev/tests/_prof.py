import os, sys, json, time; os.environ['E2E_PORT'] = '8843'; sys.path.insert(0, 'dev/tests')
exec(open('dev/tests/perf_year.py').read().split("def t(pg, js):")[0].replace("os.environ['E2E_PORT'] = '8842'", ""))
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=20000)
    pg.evaluate(GEN, [u[0] for u in U]); pg.wait_for_timeout(1500)
    cdp = ctx.new_cdp_session(pg); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 200}); cdp.send('Profiler.start')
    t0 = time.time(); pg.reload(); pg.wait_for_function('() => !!window._cloudSyncDone && document.querySelector("#content") && document.querySelector("#content").children.length', timeout=60000)
    print('boot ms', round((time.time() - t0) * 1000))
    cdp2 = ctx.new_cdp_session(pg)
    prof = cdp.send('Profiler.stop')['profile']
    nodes = {n['id']: n for n in prof['nodes']}; self_t = {}
    dt = prof['timeDeltas']; samples = prof['samples']
    for s, d in zip(samples, dt):
        n = nodes[s]; k = n['callFrame']['functionName'] or '(anon)'; self_t[k] = self_t.get(k, 0) + d
    tot = sum(self_t.values())
    for k, v in sorted(self_t.items(), key=lambda x: -x[1])[:22]: print(f'{v/1000:8.0f} ms  {k}')
    # inclusive time for named app functions
    parent = {}
    for n in prof['nodes']:
        for c in n.get('children', []): parent[c] = n['id']
    incl = {}
    for s, d in zip(samples, dt):
        seen = set(); x = s
        while x in nodes:
            k = nodes[x]['callFrame']['functionName']
            if k and k not in seen: incl[k] = incl.get(k, 0) + d; seen.add(k)
            x = parent.get(x)
    print('--- inclusive (app functions)')
    for k, v in sorted(incl.items(), key=lambda x: -x[1])[:30]:
        if v > 150000: print(f'{v/1000:8.0f} ms  {k}')
