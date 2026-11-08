# Opening the app with a year of data ON THE SERVER: (A) first login on a new phone (downloads everything),
# (B) opening it again the next time (local data + what changed). PHONE=1 → 4× slower CPU.
import os, sys, json, time; os.environ['E2E_PORT'] = '8844'
sys.path.insert(0, os.path.dirname(__file__))
import harness
U = [(f'F1.S{s:02d}T{t:02d}', 1500, 50) for s in range(1, 13) for t in range(1, 5)] + [(f'F2.S{s:02d}T{t:02d}', 1500, 50) for s in range(1, 6) for t in range(1, 15)] + [(f'F2.S{s:02d}T{t:02d}', 9000, 50) for s in range(6, 17) for t in range(1, 3)]
harness.DEFAULT_UNITS[:] = U
from harness import *
import datetime
def year(sb):
    today = datetime.date.today(); start = today - datetime.timedelta(days=365); n = 0
    for d in range(365):
        date = (start + datetime.timedelta(days=d)).isoformat()
        for i, (u, _, _) in enumerate(U):
            recs = [{'id': f'f{i}-{d}', 'type': 'feeding', 'unit': u, 'date': date, 'kg': round(1 + d / 120, 2), 'size': str(1 + min(2, d // 120)), 'source': 'sheet'}]
            if (d + i) % 9 == 0: recs.append({'id': f'm{i}-{d}', 'type': 'mortality', 'unit': u, 'date': date, 'count': 2, 'source': 'sheet'})
            if d % 14 == 0: recs.append({'id': f's{i}-{d}', 'type': 'sampling', 'unit': u, 'date': date, 'avgWt': 50 + d * 1.4, 'sampleN': 30})
            for r in recs:
                n += 1; r['at'] = r['ts'] = date + 'T08:00:00Z'
                sb.tx[r['id']] = {'id': r['id'], 'farm_id': 'farm-main', 'data': r, 'synced_at': date + 'T09:%02d:%02d.%06dZ' % ((n // 60) % 60, n % 60, n)}   # uploaded on its day, like reality
    return n
def ready(pg): pg.wait_for_function('() => !!window._cloudSyncDone && document.querySelector("#content") && document.querySelector("#content").children.length && getTX().length > 60000', timeout=280000)
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); n = year(sb); print('records on the server:', n)
    ctx, pg = new_page(p, sb)
    if os.environ.get('PHONE'): ctx.new_cdp_session(pg).send('Emulation.setCPUThrottlingRate', {'rate': 4})
    t0 = time.time(); login(pg, 'admin@example.com', 'admin123'); ready(pg); a = round((time.time() - t0) * 1000)
    pg.wait_for_timeout(3000)
    t0 = time.time(); pg.reload()
    if os.environ.get('PHONE'): ctx.new_cdp_session(pg).send('Emulation.setCPUThrottlingRate', {'rate': 4})
    ready(pg); b = round((time.time() - t0) * 1000)
    res = {'A first login on a new phone (download a year)': a, 'B open again (daily)': b, 'local records': pg.evaluate('getTX().length'), 'rows served': getattr(sb, 'sync_rows_served', 0)}
    print(json.dumps(res, ensure_ascii=False, indent=1)); json.dump(res, open('/tmp/boot_' + os.environ.get('TAG', 'before') + '.json', 'w'))
    print('errors:', pg._errs[:3])
