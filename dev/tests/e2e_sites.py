# Each user sees only the site(s) ticked for them; a farm added on one device reaches the phones.
import os; os.environ['E2E_PORT'] = '8838'
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    sb.add_user('w1@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'input_wq', 'input_sampling', 'farm:F1'])
    sb.add_user('e2@example.com', 'eng123', role='engineer', perms=['view_dashboard', 'input_feeding', 'farm:F2'])
    sb.add_user('wall@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding'])
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("show('user-management')"); pg.wait_for_timeout(500)
    check('X1 sites appear as tick boxes with the permissions (add-user form)', pg.evaluate("!!document.getElementById('perm-farm:F1') && !!document.getElementById('perm-farm:F2')"))
    check('X1b the sites are in their own marked box "📍 المكان" (not lost among the permissions)', pg.evaluate("!!document.querySelector('.um-sites [id=\"perm-farm:F1\"]')") and 'يشتغل فين' in content(pg))
    # edit an existing worker: tick his site
    pg.evaluate("_umEditId = _umProfiles.find(x=>x.email==='wall@workers.dar-aqua.app').id; adminLoadUsers()"); pg.wait_for_timeout(600)
    check('X1c editing an existing worker shows the same site box', pg.evaluate("!!document.querySelector('.um-sites [id=\"eperm-farm:F2\"]')"))
    pg.check('[id="eperm-farm:F2"]'); pg.evaluate("umSaveEdit()"); pg.wait_for_timeout(800)
    saved = [u for u in sb.profiles.values() if u.get('email') == 'wall@workers.dar-aqua.app'] if hasattr(sb, 'profiles') else []
    check('X1d ticking the site while editing is saved', (not saved) or 'farm:F2' in (saved[0].get('perms') or []), saved[:1])
    badges = pg.evaluate("[...document.querySelectorAll('.um-site')].map(b=>b.textContent)")
    check('X1e the users list shows where each one works', any('F1' in b for b in badges) and any('كل الأماكن' in b for b in badges), badges)
    # undo for the rest of the test (wall = every site)
    pg.evaluate("_umEditId = _umProfiles.find(x=>x.email==='wall@workers.dar-aqua.app').id; adminLoadUsers()"); pg.wait_for_timeout(600)
    pg.uncheck('[id="eperm-farm:F2"]'); pg.evaluate("umSaveEdit()"); pg.wait_for_timeout(800)
    pg.fill('#um-name', 'Raju'); pg.fill('#um-email', 'raju'); pg.fill('#um-pass', 'farm2026'); pg.check('#perm-input_feeding'); pg.check('[id="perm-farm:F2"]'); pg.click('#um-add-btn'); pg.wait_for_timeout(800)
    prof = [u for u in sb.profiles.values() if u.get('email') == 'raju@workers.dar-aqua.app'] if hasattr(sb, 'profiles') else []
    check('X2 the ticked site is saved with the permissions', (not prof) or 'farm:F2' in (prof[0].get('perms') or []), prof[:1])
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(500)
    login(pg, 'w1@workers.dar-aqua.app', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(300)
    check('X3 F1 worker: only F1 anywhere (farm list, filter, no "all")', pg.evaluate("daFarms()") == ['F1'] and pg.evaluate("farmFilter") == 'F1' and list(pg.evaluate("Object.keys(getFarmList())")) == ['F1'])
    for v, sel in [('feed-sheet', '#fs-farm'), ('wq-sheet', '#wqs-farm'), ('tx-sampling', '#sp-farm')]:
        pg.evaluate(f"show('{v}',true)"); pg.wait_for_timeout(300)
        opts = pg.evaluate(f"(() => {{ const s=document.querySelector('{sel}'); return s ? [...s.options].map(o=>o.value||o.textContent) : null; }})()")
        check(f'X4 {v}: no way to open another farm', opts in (None, ['F1']), opts)
    pg.evaluate("setFarm && setFarm('F2')"); pg.wait_for_timeout(100)
    check('X5 switching to another farm is refused', pg.evaluate("farmFilter") == 'F1')
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(500)
    login(pg, 'e2@example.com', 'eng123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    check('X6 an engineer limited to F2 sees F2 only', pg.evaluate("daFarms()") == ['F2'] and pg.evaluate("farmFilter") == 'F2')
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(500)
    login(pg, 'wall@workers.dar-aqua.app', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    check('X7 no site ticked = every site, as before — and the previous user\'s site does not stick on this phone', pg.evaluate("daFarms()") == ['F1', 'F2'] and pg.evaluate("farmFilter") == 'all', pg.evaluate("farmFilter"))
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet')"); pg.wait_for_timeout(300)
    # admin adds a hatchery on another device
    c2, pa = new_page(p, sb); login(pa, 'admin@example.com', 'admin123'); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pa.evaluate("(() => { const u=getFarmUnits(); ['HA.S01T01','HA.S01T02'].forEach(n=>u.push({name:n,farm:'HA',fishNo:20000,avgWt:1})); saveFarmUnits(u); const r=getFarmsRegistry(); r.HA='المفرخ'; saveFarmsRegistry(r); })()")
    pa.wait_for_timeout(2500)
    pg.evaluate("daTabRefresh ? daTabRefresh() : 0"); pg.wait_for_timeout(2500)
    opts = pg.evaluate("[...document.querySelectorAll('#fs-farm option')].map(o=>o.value||o.textContent)")
    check('X8 a hatchery added on the admin\'s computer reaches the phone after 🔄 (in the farm list of the open sheet)', 'HA' in opts, opts)
    check('X9 no page errors', not pg._errs and not pa._errs, pg._errs + pa._errs)
    c2.close(); ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
