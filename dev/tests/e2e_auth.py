import os; os.environ['E2E_PORT'] = '8771'
from harness import *

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    # T1-T2: logged out
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    check('T1 login page on fresh load', 'تسجيل الدخول' in content(pg))
    check('T1 no skip-login button', 'استمر بدون تسجيل' not in pg.content())
    check('T1 sidebar hidden when logged out', visible_views(pg) == [], visible_views(pg))
    pg.evaluate("show('dashboard')"); check('T1 show(dashboard) blocked while logged out', 'تسجيل الدخول' in content(pg))
    login(pg, 'admin@example.com', 'wrong')
    check('T2 wrong password rejected', 'غلط' in toasts(pg), toasts(pg))
    check('T2 no session stored', pg.evaluate("() => localStorage.getItem('daracqua_session_v1')") is None)
    ctx.close()

    # T3-T4: worker perms + single upsert + boot sync
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    sb.add_user('worker@example.com', 'work123', role='worker')
    ctx, pg = new_page(p, sb)
    login(pg, 'worker@example.com', 'work123')
    pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    vv = visible_views(pg)
    check('T3 worker sees feeding', 'tx-feeding' in vv and 'quick-feed' in vv, vv)
    check('T3 worker cannot see finance/settings/users', not any(x in vv for x in ['cost-dashboard', 'settings', 'user-management', 'feed-inventory']), vv)
    pg.evaluate("show('cost-dashboard')"); check('T3 direct URL to finance blocked', 'مش مسموحلك' in content(pg))
    pg.evaluate("show('user-management')"); check('T3 user-management blocked', 'مش مسموحلك' in content(pg))
    check('T4 boot loaded TX from cloud', any(mm == 'GET' and pp.startswith('/rest/v1/transactions?farm_id=eq.farm-main') for mm, pp, _ in sb.log))
    check('T4 realtime + dashboard refresh started', pg.evaluate('() => !!_realtimeInterval && !!_dashRefreshInterval'))
    pg.evaluate("addTX({id:'tx-w1',type:'feeding',date:'2026-10-25',unit:'F1.S01T01',kg:4.2,feed:'3mm'})"); pg.wait_for_timeout(800)
    posts = [hh for mm, pp, hh in sb.log if mm == 'POST' and pp.startswith('/rest/v1/transactions')]
    check('T4 TX uploaded exactly once', sb.upserts.get('tx-w1') == 1, sb.upserts)
    check('T4 upload carried apikey + user token', posts and posts[-1].get('apikey') and posts[-1].get('authorization', '').startswith('Bearer at-u-worker'))
    check('T4 upload stored in shared farm', sb.tx.get('tx-w1', {}).get('farm_id') == 'farm-main')
    ctx.close()

    # T5-T6: no profile / inactive
    sb = MockSB(); sb.add_user('ghost@x.com', 'ghost123', profile=False); sb.add_user('off@x.com', 'off12345', role='worker', active=False)
    ctx, pg = new_page(p, sb)
    login(pg, 'ghost@x.com', 'ghost123')
    check('T5 user without profile refused', 'مش مفعّل' in toasts(pg) and 'تسجيل الدخول' in content(pg), toasts(pg))
    check('T5 no session kept', pg.evaluate("() => localStorage.getItem('daracqua_session_v1')") is None)
    login(pg, 'off@x.com', 'off12345')
    check('T6 deactivated user refused', 'موقوف' in toasts(pg), toasts(pg))
    ctx.close()

    # T7-T8: admin creates user, new user logs in, no passwords stored
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    pg.evaluate("localStorage.setItem('daracqua_local_users_v1', JSON.stringify([{email:'old@x.com',password:'plain999',role:'worker'}]))")
    pg.reload(); pg.wait_for_timeout(600); hook_toasts(pg)
    login(pg, 'admin@example.com', 'admin123')
    pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    check('T7 admin sees user-management', 'user-management' in visible_views(pg))
    pg.evaluate("show('user-management')"); pg.wait_for_timeout(500)
    pg.fill('#um-name', 'Ali'); pg.fill('#um-email', 'ali@example.com'); pg.fill('#um-pass', 'ali12345')
    pg.select_option('#um-role', 'engineer'); pg.click('#um-add-btn'); pg.wait_for_timeout(1000)
    newp = [r for r in sb.profiles.values() if r['email'] == 'ali@example.com']
    check('T7 auth account + profile created', 'ali@example.com' in sb.users and len(newp) == 1, toasts(pg))
    check('T7 profile has role, perms, shared farm', newp and newp[0]['role'] == 'engineer' and newp[0]['farm_id'] == 'farm-main' and 'manage_inventory' in newp[0]['perms'])
    check('T7 list shows new user', 'ali@example.com' in content(pg))
    store = pg.evaluate("() => JSON.stringify(Object.assign({}, localStorage))")
    check('T7 no plaintext passwords anywhere in browser storage', 'ali12345' not in store and 'plain999' not in store and 'admin123' not in store)
    check('T7 user table has no password column', 'كلمة السر' not in pg.inner_text('#um-users-list'))
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(400)
    check('T12 logout → login page, intervals cleared, session gone',
          'تسجيل الدخول' in content(pg) and pg.evaluate("() => !_realtimeInterval && !_dashRefreshInterval && !localStorage.getItem('daracqua_session_v1')"))
    login(pg, 'ali@example.com', 'ali12345')
    vv = visible_views(pg)
    check('T8 new engineer can log in with his perms', 'feed-inventory' in vv and 'cost-dashboard' not in vv, vv)
    ctx.close()

    # T9: legacy mode (SQL not run yet) — no lockout, banner
    sb = MockSB(profiles_table=False); sb.add_user('admin@example.com', 'admin123', profile=False, uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123')
    check('T9 legacy: admin not locked out', 'تسجيل الدخول' not in content(pg) and pg.evaluate('() => currentUserRole') == 'admin')
    pg.evaluate("show('user-management')"); check('T9 legacy: security warning shown', 'إعداد الأمان لسه مكتملش' in content(pg))
    ctx.close()

    # T10, T11, T18: token refresh, reload persistence + theme, offline restore
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    tok = pg.evaluate('() => SB_TOKEN'); sb.expired.add(tok)
    ok = pg.evaluate("async () => { try{ await sbFetch('transactions?farm_id=eq.farm-main'); return true; }catch(e){ return e.message; } }")
    check('T10 expired token auto-refreshed & request retried', ok is True and pg.evaluate('() => SB_TOKEN') != tok, ok)
    check('T10 still logged in after refresh', pg.evaluate('() => !!currentUser'))
    pg.evaluate("applyTheme('blue')")
    pg.reload(); pg.wait_for_timeout(900)
    check('T11 session survives reload', 'تسجيل الدخول' not in content(pg) and pg.evaluate('() => !!currentUser'))
    teal = pg.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--teal').trim()")
    check('T11 theme survives reload', teal.lower() == '#2563eb', teal)
    sb.offline = True
    pg.reload(); pg.wait_for_timeout(900)
    check('T18 offline: cached session still works', pg.evaluate('() => !!currentUser') and 'تسجيل الدخول' not in content(pg))
    sb.offline = False
    ctx.close()

    # T13: password recovery link
    sb = MockSB()
    ctx, pg = new_page(p, sb, BASE + '#access_token=rec-token&type=recovery&expires_in=3600')
    check('T13 recovery link opens reset screen', 'كلمة سر جديدة' in content(pg))
    pg.fill('#rp-pass1', 'newpass1'); pg.fill('#rp-pass2', 'newpass1'); pg.click('#rp-btn'); pg.wait_for_timeout(700)
    check('T13 new password saved → back to login', getattr(sb, 'last_password_set', None) == 'newpass1' and 'تسجيل الدخول' in content(pg))
    check('T13 token removed from URL', '#' not in pg.url)
    ctx.close()

    # T14: old-format session → forced fresh login
    sb = MockSB()
    ctx, pg = new_page(p, sb)
    pg.evaluate("localStorage.setItem('daracqua_session_v1', JSON.stringify({access_token:'x',user:{id:'u1',email:'a@b.c'},role:'admin',exp:Date.now()+9e7}))")
    pg.reload(); pg.wait_for_timeout(600)
    check('T14 old session (auto-admin) no longer accepted', 'تسجيل الدخول' in content(pg))
    ctx.close()

    # T15-T17: every view renders for admin without JS errors; data preserved; revoked user kicked
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('worker@example.com', 'work123', role='worker')
    ctx, pg = new_page(p, sb)
    txkey = pg.evaluate('() => TX_KEY')
    pg.evaluate("localStorage.setItem('daracqua_tenant','farm-main')"); pg.evaluate(f"localStorage.setItem('{txkey}', JSON.stringify([{{id:'local-old-1',type:'feeding',date:'2026-10-20',unit:'F1.S01T01',kg:3}}]))")
    pg.reload(); pg.wait_for_timeout(600); hook_toasts(pg)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(800)
    check('T16 pre-existing local data kept', pg.evaluate("() => getTX().some(t => t.id==='local-old-1')"))
    check('T16 pre-existing local data uploaded to cloud', 'local-old-1' in sb.tx)
    pg._errs.clear()
    bad = pg.evaluate("""() => { const out=[]; Object.keys(VIEWS).forEach(v => { try{ show(v); }catch(e){ out.push(v+': '+e.message); } }); return out; }""")
    pg.wait_for_timeout(500)
    check('T15 all views render for admin', not bad, bad[:5])
    check('T15 no uncaught JS errors', not pg._errs, pg._errs[:5])
    sb.profiles['u-worker']['active'] = False
    ctx2, pg2 = new_page(p, sb)
    login(pg2, 'worker@example.com', 'work123')
    check('T17 deactivated user cannot log in', 'موقوف' in toasts(pg2), toasts(pg2))
    ctx2.close(); ctx.close()

srv.shutdown()
passed = sum(1 for _, ok, _ in RESULTS if ok)
for n, ok, d in RESULTS:
    print(('✅ ' if ok else '❌ ') + n + ('' if ok or not d else f'   → {d}'))
print(f'\n{passed}/{len(RESULTS)} passed')
