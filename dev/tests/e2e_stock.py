# Weekly stock count add-on: items + minimum + count day; counters reminded on the day; counts → weekly use, days
# left, red when low; "🛒 order" fills a purchase request; managers notified; off = hidden.
import os, json; os.environ['E2E_PORT'] = '8886'
import harness
harness.DEFAULT_UNITS[:] = [(f'F2.S01T{t:02d}', 500, 100) for t in range(1, 3)]
from harness import *
NOTIFY = []
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'stock_count', 'farm:F2'])
    hook = lambda pg: pg.route('**/farm-push.mohammedshehta86.workers.dev/**', lambda r: (NOTIFY.append(json.loads(r.request.post_data or '{}')), r.fulfill(status=200, body='{"sent":1}', headers={'Access-Control-Allow-Origin': '*'})))
    c1, pa = new_page(p, sb); hook(pa); login(pa, 'admin@example.com', 'admin123'); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    check('S0 off by default', not pa.evaluate("canAccessView('stock')"))
    pa.evaluate("show('settings')"); pa.wait_for_timeout(300); pa.click('#feat-stock'); pa.wait_for_timeout(200); pa.click('#feat-purchases'); pa.wait_for_timeout(300)
    check('S1 turned on from 🧩 add-ons', pa.evaluate("daFeat('stock') && canAccessView('stock')"))
    pa.evaluate("show('stock'); window._sc.tab='items'; show('stock',true)"); pa.wait_for_timeout(300)
    names = pa.evaluate("[...document.querySelectorAll('.sc-name')].map(e=>e.value)")
    check('S2 items ready: the feed sizes + calcium carbonate + sodium bicarbonate', any('كربونات الكالسيوم' in n for n in names) and any('بيكربونات' in n for n in names) and any('1mm' in n for n in names), names)
    pa.fill('.sc-min >> nth=3', '3'); pa.evaluate("window._scEdit.day = new Date(daToday()+'T12:00:00').getDay()"); pa.click('#sc-cfg-save'); pa.wait_for_timeout(1500)
    check('S3 minimum and count day saved (synced)', pa.evaluate("daScCfg().items.find(i=>i.id==='c1').min") == 3 and pa.evaluate("daIsSyncedKey(DA_STOCK_KEY)"))
    c2, pw = new_page(p, sb); pw.set_viewport_size({'width': 390, 'height': 844}); hook(pw); login(pw, 'w@workers.dar-aqua.app', 'work123'); pw.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pw.wait_for_timeout(400); pw.evaluate('daTabRefresh()'); pw.wait_for_timeout(1500)
    check('S4 the counter has 📦, and on count day the bell + "count of the week"', pw.evaluate("!!document.getElementById('wb-stock')") and pw.evaluate("daScDue()") and pw.evaluate("daWoPending()") >= 1)
    pw.evaluate("show('wo-mine',true)"); pw.wait_for_timeout(300)
    check('S5 the orders page shows the count reminder', pw.evaluate("!!document.getElementById('sc-due')"))
    pw.evaluate("addTX({id:'sc-F2-old',type:'stock_count',unit:'',farm:'F2',date:daAddDays(daToday(),-7),items:{c1:10,c2:6,f0:20},status:'ok',_skipValidation:true})")
    pw.evaluate("show('stock',true)"); pw.wait_for_timeout(300)
    pw.fill('.sc-q[data-id="c1"]', '2'); pw.fill('.sc-q[data-id="c2"]', '5'); pw.fill('.sc-q[data-id="f0"]', '14'); NOTIFY.clear(); pw.click('#sc-save'); pw.wait_for_timeout(500)
    check('S6 the count is saved (one per site and day) and those who manage stock are notified', pw.evaluate("!!daScAll().find(t=>t.id==='sc-F2-'+daToday() && t.items.c1===2)") and any(n.get('perm') == 'manage_inventory' for n in NOTIFY), NOTIFY)
    check('S7 the count of the week is done → no more reminder', not pw.evaluate("daScDue()"))
    B = pw.evaluate("(b => ({use:b.c1.use, left:b.c1.left, low:b.c1.low, low2:b.c2.low, use0:b.f0.use}))(daScBalance('F2'))")
    check('S8 weekly use from the drop (10 → 2 = 8/week), days left 1.75 → low; bicarbonate 6 → 5 lasts 35 days → fine', abs(B['use'] - 8) < 0.01 and abs(B['left'] - 1.75) < 0.01 and B['low'] and not B['low2'], B)
    check('S9 workers do not see the balance / items tabs', not pw.evaluate("!!document.querySelector('.sc-tab[data-t=\"bal\"]')"))
    pa.evaluate("daRealtimePull()"); pa.wait_for_timeout(1500); pa.evaluate("window._sc={tab:'bal'}; show('stock',true)"); pa.wait_for_timeout(300)
    check('S10 the balance shows it red with "🛒 order"', pa.evaluate("!!document.querySelector('.sc-order')"))
    pa.click('.sc-order'); pa.wait_for_timeout(300)
    f = pa.evaluate("window._pr.form")
    check('S11 the purchase request is filled: the item, enough for ~2 weeks (14), urgent (≤ 3 days left), the reason with the count', pa.evaluate("currentView") == 'purchases' and 'كربونات الكالسيوم' in f['item'] and f['qty'] == '14' and f['urg'] == 'high' and 'جرد' in f['reason'], f)
    pa.evaluate("show('dashboard')"); pa.wait_for_timeout(800)
    check('S12 the dashboard\'s "today" shows the count and what is running low', 'جرد المخزن' in pa.inner_text('#da-today') and 'قرب يخلص' in pa.inner_text('#da-today'))
    pw.click('#lang-btn'); pw.wait_for_timeout(150); pw.click('#da-langmenu button[data-l="ur"]'); pw.wait_for_timeout(300); pw.evaluate("window._sc.tab='count'; show('stock',true)"); pw.wait_for_timeout(300)
    check('S13 in Urdu for the worker', 'گنتی' in pw.inner_text('#content'))
    pa.evaluate("show('settings',true)"); pa.wait_for_timeout(200); pa.click('#feat-stock'); pa.wait_for_timeout(300)
    check('S14 turned off → hidden', not pa.evaluate("canAccessView('stock')"))
    check('S15 no page errors', not pa._errs and not pw._errs, pa._errs + pw._errs)
    c1.close(); c2.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
