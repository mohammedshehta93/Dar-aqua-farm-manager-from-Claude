# "Install the app": Android → the phone's own install prompt; iPhone → three steps; hidden once installed; in each language.
import os; os.environ['E2E_PORT'] = '8875'
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding'])
    ctx, pg = new_page(p, sb); pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(500)
    check('I1 the login page has "📲 نزّل التطبيق"', pg.evaluate("!!document.getElementById('inst-login')") and 'نزّل التطبيق' in pg.inner_text('#inst-login'))
    # Android: the browser offers installing → the button opens the phone's own prompt
    pg.evaluate("window.__prompted=0; const e=new Event('beforeinstallprompt'); e.prompt=()=>{window.__prompted++}; e.userChoice=Promise.resolve({outcome:'accepted'}); window.dispatchEvent(e)")
    pg.click('#inst-login'); pg.wait_for_timeout(300)
    check('I2 Android: the button opens the phone\'s install prompt', pg.evaluate("window.__prompted") == 1)
    login(pg, 'w@workers.dar-aqua.app', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(400)
    check('I3 the worker\'s bar has the button too', pg.evaluate("!!document.getElementById('inst-bar')"))
    pg.click('#inst-bar'); pg.wait_for_timeout(300)
    help_ = pg.inner_text('#da-install-help') if pg.query_selector('#da-install-help') else ''
    check('I4 no prompt available (e.g. iPhone / other browser) → clear steps instead', 'قايمة المتصفح' in help_ or 'المشاركة' in help_, help_[:120])
    pg.click('#da-install-help button'); pg.wait_for_timeout(200)
    pg.click('#lang-btn'); pg.wait_for_timeout(150); pg.click('#da-langmenu button[data-l="ur"]'); pg.wait_for_timeout(500)
    check('I5 in Urdu', 'ایپ انسٹال کریں' in pg.inner_text('#inst-bar'))
    pg.click('#inst-bar'); pg.wait_for_timeout(300)
    check('I6 the steps in Urdu', 'ہوم اسکرین' in pg.inner_text('#da-install-help') or 'آئیکن' in pg.inner_text('#da-install-help'))
    pg.evaluate("document.getElementById('da-install-help').remove()")
    c2, pi = new_page(p, sb); pi.set_viewport_size({'width': 390, 'height': 844})
    pi.evaluate("Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'}); localStorage.setItem('da_lang','ar')"); pi.reload(); pi.wait_for_timeout(500)
    pi.evaluate("Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'})"); pi.click('#inst-login'); pi.wait_for_timeout(300)
    check('I7 iPhone: Share → Add to Home Screen → Add', 'المشاركة' in pi.inner_text('#da-install-help') and 'إضافة إلى الشاشة الرئيسية' in pi.inner_text('#da-install-help'))
    c3, ps = new_page(p, sb)
    ps.evaluate("window.matchMedia = q => ({matches: /standalone/.test(q), addEventListener(){}, removeEventListener(){}}); daInstallPlace(); show(currentView,true)"); ps.wait_for_timeout(300)
    check('I8 running as the installed app: no install button', not ps.evaluate("!!document.querySelector('.da-install')"))
    check('I9 the service worker touches no request (no fetch handler)', 'fetch' not in open('sw.js').read().split('no fetch handler')[1])
    check('I10 no page errors', not pg._errs and not pi._errs and not ps._errs, pg._errs + pi._errs + ps._errs)
    for c in (ctx, c2, c3): c.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
