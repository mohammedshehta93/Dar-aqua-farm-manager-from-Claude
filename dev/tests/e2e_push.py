# Phone notifications (app side): a worker turns them on (subscription kept with his sites and language); a work order
# calls the farm-push Worker for that site; tapping a notification opens the orders page; sw.js shows them.
import os, json; os.environ['E2E_PORT'] = '8882'
import harness
harness.DEFAULT_UNITS[:] = [(f'F3.S{s:02d}T01', 300, 5) for s in range(1, 3)]
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('eng@example.com', 'eng123', role='engineer'); sb.add_user('sajed@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'farm:F3'])
    saved, calls = [], []
    c2, ps = new_page(p, sb); ps.set_viewport_size({'width': 390, 'height': 844}); c2.grant_permissions(['notifications'])
    ps.route('**/rest/v1/push_subs*', lambda r: (saved.append(json.loads(r.request.post_data or '{}')), r.fulfill(status=201, body='[]')))
    login(ps, 'sajed@workers.dar-aqua.app', 'work123'); ps.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); ps.wait_for_timeout(400)
    ps.evaluate("""() => { window.__fakeSub = null; Object.defineProperty(Notification, 'permission', {get:()=>window.__perm || 'default', configurable:true}); Notification.requestPermission = async () => (window.__perm = 'granted');
      const reg = {pushManager:{getSubscription: async () => window.__fakeSub, subscribe: async (o) => (window.__fakeSub = {endpoint:'https://fcm.googleapis.com/fcm/send/abc123', key:o.applicationServerKey.length})}};
      navigator.serviceWorker.getRegistration = async () => reg; Object.defineProperty(navigator.serviceWorker, 'ready', {get:()=>Promise.resolve(reg), configurable:true}); }""")
    ps.evaluate("show('wo-mine',true)"); ps.wait_for_timeout(500)
    check('P1 the worker\'s orders page offers "🔔 فعّل الإشعارات"', ps.evaluate("!!document.getElementById('push-on')"))
    nosql = {'on': True}
    ps.unroute('**/rest/v1/push_subs*')
    ps.route('**/rest/v1/push_subs*', lambda r: r.fulfill(status=404, body='{"code":"42P01","message":"relation \\"public.push_subs\\" does not exist"}') if nosql['on'] else (saved.append(json.loads(r.request.post_data or '{}')), r.fulfill(status=201, body='[]')))
    ps.click('#push-on'); ps.wait_for_timeout(800)
    t0 = ps.evaluate("[...document.querySelectorAll('.toast,#toast')].map(e=>e.textContent).join(' ')")
    check('P1b the table not set up in Supabase yet: the message says so (and which step)', 'push_notifications.sql' in t0 and '[save]' in t0, t0)
    nosql['on'] = False
    ps.click('#push-on'); ps.wait_for_timeout(800)
    s0 = saved[-1] if saved else {}
    check('P2 turned on: the phone\'s subscription is kept with his role, sites and language (VAPID key 65 bytes)', s0.get('role') == 'worker' and s0.get('sites') == ['F3'] and s0.get('lang') == 'ar' and s0.get('endpoint', '').startswith('https://fcm') and ps.evaluate("window.__fakeSub.key") == 65, s0)
    ps.evaluate("show('account',true)"); ps.wait_for_timeout(500)
    check('P3 my account shows it is on, with a "test" button', ps.evaluate("!!document.getElementById('push-test')"))
    # Shamim's case: the phone has a subscription but it never reached the table → "test" saves it again first
    saved.clear(); tcalls = []
    ps.route('**/farm-push.mohammedshehta86.workers.dev/**', lambda r: (tcalls.append(len(saved)), r.fulfill(status=200, body='{"sent":1,"total":1,"removed":0,"codes":[201]}', headers={'Access-Control-Allow-Origin': '*'})))
    ps.click('#push-test'); ps.wait_for_timeout(800)
    check('P3b a phone subscribed before the table existed is saved again before the test (then the test is sent)', len(saved) == 1 and saved[0].get('role') == 'worker' and tcalls == [1], (len(saved), tcalls))
    saved.clear(); ps.evaluate("daPushResync()"); ps.wait_for_timeout(500)
    check('P3c … and quietly each time the app opens', len(saved) == 1)
    c1, pe = new_page(p, sb)
    pe.route('**/farm-push.mohammedshehta86.workers.dev/**', lambda r: (calls.append([r.request.url, r.request.headers.get('authorization', ''), r.request.post_data]), r.fulfill(status=200, body='{"sent":1}', headers={'Access-Control-Allow-Origin': '*'})))
    login(pe, 'eng@example.com', 'eng123'); pe.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pe.evaluate("window._wo={farm:'F3',kind:'text'}; show('work-orders')"); pe.wait_for_timeout(300); pe.fill('#wo-text', 'نضّف الفلاتر'); pe.click('#wo-save'); pe.wait_for_timeout(800)
    check('P4 a work order calls the notifications Worker for that site, signed in', calls and calls[-1][0].endswith('/notify') and json.loads(calls[-1][2]) == {'farm': 'F3'} and calls[-1][1].startswith('Bearer '), calls)
    c3, pw = new_page(p, sb); pw.set_viewport_size({'width': 390, 'height': 844})
    pw.goto(pw.url.split('?')[0] + '?wo=1'); pw.wait_for_timeout(500); login(pw, 'sajed@workers.dar-aqua.app', 'work123'); pw.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pw.wait_for_timeout(1500)
    check('P5 tapping the notification (?wo=1) opens the orders page', pw.evaluate("currentView") == 'wo-mine')
    sw = open('sw.js').read()
    check('P6 sw.js shows the notification in the worker\'s language and opens the app; keeps "da-meta"; still no fetch handler', "addEventListener('push'" in sw and "notificationclick" in sw and "k !== 'da-meta'" in sw and "addEventListener('fetch'" not in sw)
    check('P7 no page errors', not ps._errs and not pe._errs and not pw._errs, ps._errs + pe._errs + pw._errs)
    for c in (c1, c2, c3): c.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
