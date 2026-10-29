import os; os.environ['E2E_PORT'] = '8791'
from harness import *

NON_NAV_OK = {'المعايير', '⬇️ نسخة احتياطية Excel', 'نسخة احتياطية Excel'}   # tabs/buttons inside pages
def guide_paths_ok(pg):
    return pg.evaluate("""(extra) => {
      const labels = new Set(extra); DA_NAV.forEach(g => { labels.add(g.label); g.items.forEach(i => labels.add(i[2])); });
      const bad = []; document.querySelectorAll('.da-doc .path').forEach(p => p.textContent.split(' ← ').forEach(s => { if(!labels.has(s.trim())) bad.push(s.trim()); }));
      return bad; }""", list(NON_NAV_OK))

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB()
    sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.platform.add('u-admin')
    sb.add_user('eng@example.com', 'eng12345', role='engineer')
    sb.add_user('worker@example.com', 'work123', role='worker')

    # ── logged out: legal page reachable, nothing else ──
    ctx, pg = new_page(p, sb)
    check('L1 login page links to terms & privacy', pg.evaluate("!!document.getElementById('login-legal')"))
    pg.click('#login-legal'); pg.wait_for_timeout(300)
    txt = content(pg)
    check('L2 privacy readable before login', 'سياسة الخصوصية' in txt and 'Supabase' in txt and 'Cloudflare Workers AI' in txt, txt[:200])
    check('L2 states 90-day error deletion and the Bahrain PDPL', '90 يوم' in txt and '30 لسنة 2018' in txt)
    check('L3 no placeholder / undefined leaks', not any(x in txt for x in ['undefined', 'null', '[[', 'TODO']), txt[:300])
    pg.evaluate("window._legalTab='terms'; show('legal',true)"); pg.wait_for_timeout(200)
    t2 = content(pg)
    check('L4 terms tab: guidance-only + backup responsibility', 'استرشادية' in t2 and 'نسخ احتياطية' in t2, t2[:200])
    pg.evaluate("show('dashboard')"); pg.wait_for_timeout(200)
    check('L5 other pages still blocked when logged out', 'تسجيل الدخول' in content(pg))
    pg.evaluate("show('legal')"); pg.wait_for_timeout(200)
    pg.click('text=← الدخول'); pg.wait_for_timeout(200)
    check('L5 back to login from legal page', 'تسجيل الدخول' in content(pg))
    check('L6 no page errors (logged out)', not pg._errs, pg._errs)
    ctx.close()

    # ── each role lands on its own guide tab; every menu path in the guide exists ──
    for email, pw, tab, must in [('worker@example.com', 'work123', 'worker', 'شيت العلف اليومي'),
                                 ('eng@example.com', 'eng12345', 'engineer', 'مراجعة البيانات'),
                                 ('admin@example.com', 'admin123', 'admin', 'نسخة احتياطية')]:
        ctx, pg = new_page(p, sb)
        login(pg, email, pw); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
        items = pg.evaluate("() => daNavGroups().reduce((a,g)=>a.concat(g.items.map(i=>i[0])),[])")
        check(f'G1 {tab}: guide in the menu', 'help' in items, items)
        pg.evaluate("window._helpTab=null; show('help')"); pg.wait_for_timeout(300)
        check(f'G2 {tab}: opens on own tab', pg.evaluate(f"!!document.getElementById('help-{tab}')") and must in content(pg))
        bad = []
        for tb in ['worker', 'engineer', 'admin']:
            pg.evaluate(f"window._helpTab='{tb}'; show('help',true)"); pg.wait_for_timeout(150); bad += guide_paths_ok(pg)
        check(f'G3 {tab}: every menu path in the guide exists', not bad, bad)
        check(f'G4 {tab}: no page errors', not pg._errs, pg._errs)
        if tab == 'admin':
            check('A1 AI advisor uses the signed-in farm name, not a hard-coded one', pg.evaluate("aiSendQuestion.toString().indexOf('دار أكوا') < 0 && aiSendQuestion.toString().indexOf('daFarmName()') > 0"))
            n0 = sum(1 for m, pp, _ in sb.log if 'platform_prune_errors' in pp)
            pg.evaluate("localStorage.removeItem('daracqua_prune_day'); show('platform')"); pg.wait_for_timeout(1200)
            n1 = sum(1 for m, pp, _ in sb.log if 'platform_prune_errors' in pp)
            pg.evaluate("platformLoadErrors()"); pg.wait_for_timeout(600)
            n2 = sum(1 for m, pp, _ in sb.log if 'platform_prune_errors' in pp)
            check('A2 old error reports pruned automatically, once a day', n1 == n0 + 1 and n2 == n1, (n0, n1, n2))
        ctx.close()

    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
