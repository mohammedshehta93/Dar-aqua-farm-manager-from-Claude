# Phone: clean header before login, one compact row after; updates apply themselves when nothing is at risk.
import os; os.environ['E2E_PORT'] = '8828'
from harness import *
def rows(pg): return pg.evaluate("(() => { const els=[...document.querySelectorAll('header.top .top-right > *')].filter(e=>getComputedStyle(e).display!=='none'); return [...new Set(els.map(e=>Math.round(e.getBoundingClientRect().top)))]; })()")
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('worker@example.com', 'work123', role='worker')
    ctx, pg = new_page(p, sb); pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(400)
    vis = pg.evaluate("['user-badge','back-btn','farm-dd-wrap','offline-status','lang-btn'].map(id=>{const e=document.getElementById(id); return e && getComputedStyle(e).display!=='none';})")
    check('M1 before login the phone header shows only the brand and EN (no farm picker / back / login chip)', vis == [False, False, False, False, True], vis)
    check('M2 the app version is shown on the login card', 'v 20' in content(pg))
    pg.screenshot(path='/tmp/m_before.png', clip={'x':0,'y':0,'width':390,'height':520})
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(300)
    hh = pg.evaluate("document.querySelector('header.top').getBoundingClientRect().height")
    check(f'M3 after login on a 390 px phone the header is ONE row ({hh:.0f} px)', max(rows(pg)) - min(rows(pg)) < 8 and hh < 70, (rows(pg), hh))
    pg.screenshot(path='/tmp/m_after.png', clip={'x':0,'y':0,'width':390,'height':300})
    check('M4 nothing sticks out sideways', pg.evaluate("document.documentElement.scrollWidth <= 392"))
    # update with nothing at risk → applies itself
    pg.evaluate("window.__marker = 1")
    with pg.expect_navigation(timeout=6000): pg.evaluate("daShowUpdateBanner()")
    pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    check('M5 a new version with nothing at risk applies itself (page reloaded)', pg.evaluate("window.__marker === undefined"))
    # unsaved input → banner asks to save first, no reload
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet')"); pg.wait_for_timeout(300)
    i = pg.evaluate("window._fs.rows.find(r=>r.i!==undefined).i"); pg.fill(f'#fs-{i}-m0', '3'); pg.evaluate("document.activeElement.blur()")
    pg.evaluate("window.__marker2 = 1; daShowUpdateBanner()"); pg.wait_for_timeout(1800)
    check('M6 with unsaved input: no reload, the banner says save first', pg.evaluate("window.__marker2 === 1") and 'احفظ شغلك' in pg.inner_text('#upd-banner'))
    check('M7 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
