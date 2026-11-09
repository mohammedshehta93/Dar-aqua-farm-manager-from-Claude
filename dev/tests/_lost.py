import os, sys; os.environ['E2E_PORT'] = '8859'; sys.path.insert(0, 'dev/tests')
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('sajed@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'farm:F3'])
    c1, pc = new_page(p, sb); login(pc, 'admin@example.com', 'admin123'); pc.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    # the cloud refuses the tank upload this once (a bad connection at that moment)
    state = {'fail': True}
    def handler(route):
        if state['fail'] and route.request.method == 'POST': state['fail'] = False; route.fulfill(status=503, body='{"message":"timeout"}')
        else: route.fallback()
    pc.route('**/rest/v1/farm_units*', handler)
    pc.evaluate("show('farm-setup')"); pc.wait_for_timeout(300)
    pc.select_option('#ta-farm', '__new'); pc.fill('#ta-newcode', 'F3'); pc.fill('#ta-newname', 'Nursery'); pc.fill('#ta-n', '3'); pc.click('#ta-save'); pc.wait_for_timeout(800)
    for k in range(3): pc.evaluate("daRealtimePull()"); pc.wait_for_timeout(600)
    print('computer RAW F3:', pc.evaluate("RAW.filter(u=>u.farm==='F3').length"), '| in the cloud:', sum(1 for k in getattr(sb, 'upserts', {}).get('farm_units', {}) if 'F3' in str(k)))
    c2, ph = new_page(p, sb); ph.set_viewport_size({'width': 390, 'height': 844}); login(ph, 'sajed@workers.dar-aqua.app', 'work123'); ph.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); ph.wait_for_timeout(600)
    print('phone RAW F3:', ph.evaluate("RAW.filter(u=>u.farm==='F3').length"), '| phone says no tanks:', 'No tanks' in ph.inner_text('#content') or 'مفيش تانكات' in ph.inner_text('#content'))
