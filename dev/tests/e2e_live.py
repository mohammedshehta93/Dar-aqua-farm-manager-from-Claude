# Settings take effect at once, saving clears the unsaved mark (no false "reload?" warning), 🔄 refresh button.
import os; os.environ['E2E_PORT'] = '8811'
from harness import *

def unload_blocked(pg): return pg.evaluate("(() => { const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented; })()")
def dens_alerts(pg): return pg.evaluate("generateAlerts().filter(a=>/كثافة وزن/.test(a.title||'')).length")

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("show('smart')"); pg.wait_for_timeout(300); before = dens_alerts(pg); txt0 = content(pg)
    pg.evaluate("show('alert-settings')"); pg.wait_for_timeout(300)
    pg.fill('#st-alert-dens', '999'); pg.fill('#st-warn-dens', '998'); pg.wait_for_timeout(100)
    check('L1 typing in the alert settings marks the tab unsaved', pg.evaluate("_daActiveTab.dirty") and unload_blocked(pg))
    pg.evaluate("saveAlertSettings()"); pg.wait_for_timeout(300)
    check('L2 after saving: no unsaved mark, reload does not warn', not pg.evaluate("_daActiveTab.dirty") and not unload_blocked(pg))
    pg.click('#da-tabbar .dt[data-tab="smart"]'); pg.wait_for_timeout(300)
    check('L3 the open alerts tab shows the new limit at once (density alerts gone)', before > 0 and dens_alerts(pg) == 0 and content(pg) != txt0, (before, dens_alerts(pg)))
    pg.evaluate("show('alert-settings',true)"); pg.wait_for_timeout(200)
    check('L3 the settings page shows what the alerts actually use', pg.input_value('#st-alert-dens') == '999' and pg.evaluate("getSettings().densAlarm") == 999)
    check('L4 🔄 refresh button in the tab bar', pg.evaluate("!!document.getElementById('dt-refresh')"))
    n0 = sum(1 for m, pp, _ in sb.log if 'transactions' in pp and m == 'GET')
    pg.click('#dt-refresh'); pg.wait_for_timeout(800)
    n1 = sum(1 for m, pp, _ in sb.log if 'transactions' in pp and m == 'GET')
    check('L5 refresh pulls the latest from the cloud and redraws', n1 > n0 and 'اتحدثت' in pg.evaluate("(window.__toasts||[]).slice(-1)[0]||''"), (n0, n1))
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet')"); pg.wait_for_timeout(300)
    i = pg.evaluate("window._fs.rows[0].i"); pg.fill(f'#fs-{i}-m0', '3')
    pg.once('dialog', lambda d: d.dismiss()); pg.click('#dt-refresh'); pg.wait_for_timeout(300)
    check('L6 refresh on a page with unsaved input asks first; cancel keeps it', pg.input_value(f'#fs-{i}-m0') == '3')
    pg.once('dialog', lambda d: d.accept()); pg.click('#dt-refresh'); pg.wait_for_timeout(600)
    check('L6 …ok → page redrawn, unsaved mark cleared', pg.input_value(f'#fs-{pg.evaluate("window._fs.rows[0].i")}-m0') == '' and not pg.evaluate("_daActiveTab.dirty"))
    check('L7 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
