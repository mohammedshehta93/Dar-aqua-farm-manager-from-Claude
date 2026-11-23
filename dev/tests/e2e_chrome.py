# A worker in an Android browser that can neither install nor notify gets "open in Google Chrome" (intent + copy link),
# on the install button and the notifications card; Chrome itself keeps the normal install / notifications.
import os; os.environ['E2E_PORT'] = '8903'
import harness
harness.DEFAULT_UNITS[:] = [('F1.S01T01', 500, 100)]
from harness import *
OTHER = 'Mozilla/5.0 (Linux; Android 12; RMX3085) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36 PHX/11.9'
CHROME = 'Mozilla/5.0 (Linux; Android 12; RMX3085) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
def as_phone(pg, ua, no_push):
    cdp = pg.context.new_cdp_session(pg); cdp.send('Network.setUserAgentOverride', {'userAgent': ua})
    if no_push: pg.add_init_script("delete window.PushManager;")
    pg.reload(); pg.wait_for_timeout(1500)
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('sajed@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'farm:F1'])
    ctx, pg = new_page(p, sb); pg.set_viewport_size({'width': 390, 'height': 844}); as_phone(pg, OTHER, True)
    login(pg, 'sajed@workers.dar-aqua.app', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(500)
    check('C1 the other browser is recognised as one that cannot install / notify', pg.evaluate("daWeakBrowser()"))
    pg.evaluate("show('wo-mine',true)"); pg.wait_for_timeout(600)
    href = pg.evaluate("(document.getElementById('da-chrome-open')||{}).getAttribute && document.getElementById('da-chrome-open').getAttribute('href')") or ''
    check('C2 the notifications card offers "🌐 Open in Chrome" (an Android intent to the same page) and "📋 Copy the link"', href.startswith('intent://') and 'package=com.android.chrome' in href and pg.evaluate("!!document.getElementById('da-chrome-copy')"), href[:120])
    pg.evaluate("daInstallApp()"); pg.wait_for_timeout(300)
    check('C3 "📲 Install the app" there opens the Chrome sheet, not the menu steps it cannot follow', 'Chrome' in pg.inner_text('#da-install-help') and pg.evaluate("!!document.querySelector('#da-install-help #da-chrome-open')"))
    pg.evaluate("document.getElementById('da-install-help').remove()"); pg.click('#lang-btn'); pg.wait_for_timeout(150); pg.click('#da-langmenu button[data-l="ur"]'); pg.wait_for_timeout(300); pg.evaluate("daInstallApp()"); pg.wait_for_timeout(300)
    check('C4 in Urdu too', 'Chrome میں کھولیں' in pg.inner_text('#da-install-help'))
    c2, pc = new_page(p, sb); pc.set_viewport_size({'width': 390, 'height': 844}); as_phone(pc, CHROME, False)
    login(pc, 'sajed@workers.dar-aqua.app', 'work123'); pc.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pc.wait_for_timeout(500)
    pc.evaluate("show('wo-mine',true)"); pc.wait_for_timeout(600)
    check('C5 in Chrome itself: no "open in Chrome", the normal notifications button and install steps', not pc.evaluate("daWeakBrowser()") and not pc.evaluate("!!document.getElementById('da-chrome-open')"))
    check('C6 no page errors', not pg._errs and not pc._errs, pg._errs + pc._errs)
    ctx.close(); c2.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
