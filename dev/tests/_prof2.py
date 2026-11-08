import os, sys, time; os.environ['E2E_PORT'] = '8845'; sys.path.insert(0, 'dev/tests')
src = open('dev/tests/perf_boot.py').read(); exec(src.split("with sync_playwright() as p:")[0].replace("os.environ['E2E_PORT'] = '8844'", ""))
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); year(sb)
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); ready(pg); pg.wait_for_timeout(3000)
    cdp = ctx.new_cdp_session(pg); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 200}); cdp.send('Profiler.start')
    t0 = time.time(); pg.reload(); ready(pg); print('reopen ms', round((time.time() - t0) * 1000))
    prof = cdp.send('Profiler.stop')['profile']
    nodes = {n['id']: n for n in prof['nodes']}; parent = {}
    for n in prof['nodes']:
        for c in n.get('children', []): parent[c] = n['id']
    incl, selft = {}, {}
    for s, d in zip(prof['samples'], prof['timeDeltas']):
        k0 = nodes[s]['callFrame']['functionName'] or '(anon)'; selft[k0] = selft.get(k0, 0) + d
        seen = set(); x = s
        while x in nodes:
            k = nodes[x]['callFrame']['functionName']
            if k and k not in seen: incl[k] = incl.get(k, 0) + d; seen.add(k)
            x = parent.get(x)
    print('--- self'); [print(f'{v/1000:7.0f} ms  {k}') for k, v in sorted(selft.items(), key=lambda x: -x[1])[:14]]
    print('--- inclusive'); [print(f'{v/1000:7.0f} ms  {k}') for k, v in sorted(incl.items(), key=lambda x: -x[1])[:26] if v > 25000]
