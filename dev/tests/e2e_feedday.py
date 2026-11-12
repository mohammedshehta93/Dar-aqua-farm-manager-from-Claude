# "Was all the feed given?" — Full fills each tank's daily ration (pinned or from a "new feed sheet" order, the newest
# wins); a tank under a "don't feed" order stays X; Less needs a reason before saving; shown on the entry status board.
import os; os.environ['E2E_PORT'] = '8884'
import harness
harness.DEFAULT_UNITS[:] = [(f'F1.S01T{t:02d}', 500, 100) for t in range(1, 5)]
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'farm:F1'])
    c1, pa = new_page(p, sb); login(pa, 'admin@example.com', 'admin123'); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pa.on('dialog', lambda d: d.accept())
    Y = pa.evaluate("daAddDays(daToday(),-1)")
    pa.evaluate(f"window._fs={{farm:'F1',date:'{Y}'}}; show('feed-sheet')"); pa.wait_for_timeout(400)
    ids = pa.evaluate("window._fs.rows.filter(r=>r.i!==undefined).map(r=>r.i)")
    for k, i in enumerate(ids): pa.fill(f'#fs-{i}-m0', ['2', '2.5', '3', '1'][k])
    check('D1 supervisors have "📌 pin these amounts as the daily ration"', pa.evaluate("!!document.getElementById('fd-pin')"))
    pa.click('#fd-pin'); pa.wait_for_timeout(300)
    check('D2 pinned per tank from that day (synced)', pa.evaluate("daFration()['F1.S01T02'].kg") == 2.5 and pa.evaluate("daIsSyncedKey(DA_FRATION_KEY)"))
    pa.evaluate("addTX({id:'wo-f',type:'work_order',date:daToday(),unit:'',farm:'F1',kind:'feed',tanks:['F1.S01T03'],kgs:{'F1.S01T03':3.6},status:'open',_skipValidation:true}); addTX({id:'wo-x',type:'work_order',date:daToday(),unit:'',farm:'F1',kind:'nofeed',tanks:['F1.S01T04'],status:'open',_skipValidation:true})")
    c2, pw = new_page(p, sb); pw.set_viewport_size({'width': 390, 'height': 844}); login(pw, 'w@workers.dar-aqua.app', 'work123'); pw.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pw.wait_for_timeout(500)
    pw.evaluate("daTabRefresh()"); pw.wait_for_timeout(1500); pw.evaluate("window._fs={farm:'F1'}; show('feed-sheet',true)"); pw.wait_for_timeout(400)
    check('D3 the worker\'s sheet asks "was all the feed given?" (no pin button for workers)', pw.evaluate("!!document.getElementById('fd-full') && !!document.getElementById('fd-less') && !document.getElementById('fd-pin')"))
    pw.click('#fd-full'); pw.wait_for_timeout(300)
    v = lambda u: pw.evaluate(f"(r => document.getElementById('fs-'+r.i+'-m0').value)(window._fs.rows.find(r=>r.unit==='{u}'))")
    check('D4 "Full" fills each tank\'s ration: pinned 2 / 2.5, the newer order 3.6 wins over the pin 3, the "don\'t feed" tank stays X', [v('F1.S01T01'), v('F1.S01T02'), v('F1.S01T03'), v('F1.S01T04')] == ['2', '2.5', '3.6', 'X'], [v(f'F1.S01T0{k}') for k in range(1, 5)])
    for u in ['F1.S01T01', 'F1.S01T02', 'F1.S01T03']:
        i = pw.evaluate(f"window._fs.rows.find(r=>r.unit==='{u}').i"); pw.fill(f'#fs-{i}-sz', '2')
    pw.click('#fd-less'); pw.wait_for_timeout(200); i1 = pw.evaluate("window._fs.rows.find(r=>r.unit==='F1.S01T01').i"); pw.fill(f'#fs-{i1}-m0', '1.2')
    pw.click('#fs-save'); pw.wait_for_timeout(500)
    check('D5 "Less" without a reason: not saved', not pw.evaluate("getTX().some(t=>t.type==='feeding' && t.unit==='F1.S01T01' && t.date===daToday())"))
    pw.fill('#fd-reason', 'الأكسجين كان واطي الصبح'); pw.click('#fs-save'); pw.wait_for_timeout(700)
    check('D6 with the reason it saves (1.2 kg) and the day is kept as "less" with its reason', pw.evaluate("getTX().some(t=>t.type==='feeding' && t.unit==='F1.S01T01' && t.date===daToday() && t.kg===1.2)") and pw.evaluate("(r => r && !r.full && r.reason)(daFdRec('F1', daToday()))") == 'الأكسجين كان واطي الصبح')
    check('D7 the day record is not sent for review', not pw.evaluate("getTX().some(t=>t.type==='feed_day' && t.status==='pending')"))
    pa.evaluate("daRealtimePull()"); pa.wait_for_timeout(1500); pa.evaluate("show('entry-status',true)"); pa.wait_for_timeout(400)
    check('D8 the entry status board shows the site whose feed was less, with the reason', pa.evaluate("!!document.getElementById('es-fd')") and 'الأكسجين' in pa.inner_text('#es-fd'))
    pw.click('#lang-btn'); pw.wait_for_timeout(150); pw.click('#da-langmenu button[data-l="ur"]'); pw.wait_for_timeout(300); pw.evaluate("window._fs={farm:'F1'}; show('feed-sheet',true)"); pw.wait_for_timeout(300)
    check('D9 in Urdu for the worker', 'پوری فیڈ' in pw.inner_text('#fd-card'))
    check('D10 no page errors', not pa._errs and not pw._errs, pa._errs + pw._errs)
    c1.close(); c2.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
