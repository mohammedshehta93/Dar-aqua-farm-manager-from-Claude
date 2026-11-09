# Daily entry status: per farm what was entered today and what is missing; dashboard strip; buttons open the sheets.
import os; os.environ['E2E_PORT'] = '8862'
import harness
harness.DEFAULT_UNITS[:] = [(f'F1.S{s:02d}T{t:02d}', 500, 100) for s in (1, 2) for t in range(1, 5)] + [(f'F2.S01T{t:02d}', 800, 50) for t in range(1, 4)]
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'input_wq'])
    sb.add_user('e@example.com', 'eng123', role='engineer')
    c1, pw = new_page(p, sb); login(pw, 'w@workers.dar-aqua.app', 'work123'); pw.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    # the worker enters 6 of 8 F1 tanks (one "not fed" X, one with dead) and 1 of 2 sections
    pw.evaluate("window._fs={farm:'F1'}; show('feed-sheet',true)"); pw.wait_for_timeout(300)
    ids = pw.evaluate("window._fs.rows.filter(r=>r.i!==undefined).map(r=>r.i)")
    for k, i in enumerate(ids[:6]):
        pw.fill(f'#fs-{i}-m0', 'X' if k == 1 else '2')
        if k != 1: pw.fill(f'#fs-{i}-sz', '2')
    pw.fill(f'#fs-{ids[2]}-d', '2+1'); pw.click('#fs-save'); pw.wait_for_timeout(600)
    pw.evaluate("window._wqs={farm:'F1'}; show('wq-sheet',true)"); pw.wait_for_timeout(300)
    pw.fill('#wqs-0-temp', '29'); pw.fill('#wqs-0-ph', '7'); pw.fill('#wqs-0-do', '6'); pw.click('#wqs-save'); pw.wait_for_timeout(600)
    c2, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(500)
    check('E1 in the menu under Home', pg.evaluate("DA_NAV.find(g=>g.id==='home').items.some(i=>i[0]==='entry-status')"))
    pg.evaluate("show('entry-status')"); pg.wait_for_timeout(400)
    f1 = pg.evaluate("daEsFarm('F1', daToday())"); f2 = pg.evaluate("daEsFarm('F2', daToday())")
    check('E2 F1 feed: 6 of 8 entered ("not fed" X counts), the 2 missing named', f1['fed'] == 6 and f1['tanks'] == 8 and [r['no']['label'] for r in f1['missFeed']] == ['2.3', '2.4'], (f1['fed'], [r['no']['label'] for r in f1['missFeed']]))
    check('E3 mortality total (2+1 = 3), testing 1 of 2 sections (S-02 missing), who entered, waiting for review', f1['dead'] == 3 and f1['wq'] == 1 and f1['secs'] == 2 and f1['who'] == ['w'] and f1['pend'] > 0, f1)
    check('E4 F2: nothing entered', f2['fed'] == 0 and f2['tanks'] == 3)
    txt = pg.inner_text('#content')
    check('E5 the page shows each farm with what is missing', 'ناقص: 2.3، 2.4' in txt and 'S-02' in txt and '6 من 8 تانك' in txt and '0 من 3 تانك' in txt, txt[:400])
    late = pg.evaluate("daEsLate(daToday())")
    colF2 = pg.evaluate("daEsColor(0, 3, daToday())")
    check('E6 colours: partial = amber; nothing = red after the cut-off hour, grey before', pg.evaluate("daEsColor(6, 8, daToday())") == 'amber' and colF2 == ('red' if late else 'grey') and pg.evaluate("daEsColor(0, 3, daAddDays(daToday(),-1))") == 'red')
    check('E7 the review shortcut is there', 'مستني مراجعتك' in txt)
    pg.click('.es-farm[data-farm="F1"] .es-open-feed'); pg.wait_for_timeout(400)
    check('E8 "open the feed sheet" opens it on that farm and day', pg.evaluate("currentView") == 'feed-sheet' and pg.evaluate("window._fs.farm") == 'F1')
    pg.evaluate("show('dashboard')"); pg.wait_for_timeout(400)
    strip = pg.inner_text('#es-strip') if pg.query_selector('#es-strip') else ''
    check('E9 the dashboard says what is missing today', 'F1 ناقص 2 تانك علف' in strip and 'F1 ناقص 1 سكشن قياسات' in strip, strip)
    pg.evaluate("window._es={date:daAddDays(daToday(),-1)}; show('entry-status',true)"); pg.wait_for_timeout(300)
    check('E10 another day can be checked', pg.evaluate("daEsFarm('F1', window._es.date).fed") == 0 and '0 من 8 تانك' in pg.inner_text('#content'))
    check('E11 workers do not see it', not pw.evaluate("canAccessView('entry-status')"))
    c3, pe = new_page(p, sb); login(pe, 'e@example.com', 'eng123'); pe.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    check('E12 engineers do', pe.evaluate("canAccessView('entry-status')"))
    check('E13 no page errors', not pg._errs and not pw._errs and not pe._errs, pg._errs + pw._errs + pe._errs)
    for c in (c1, c2, c3): c.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
