# "Please record this day": from the entry status board to the right workers (names), their 🔔 with "open the sheet"
# on that site and day, closed by itself once complete; automatic reminders (made by the server at 16:30) reach the
# site's workers allowed to record; the admin's on / off and time.
import os, json; os.environ['E2E_PORT'] = '8898'
import harness
harness.DEFAULT_UNITS[:] = [(f'F2.S01T{t:02d}', 500, 100) for t in range(1, 4)] + [('F1.S01T01', 500, 100)]
from harness import *
NOTIFY = []
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    sb.add_user('shamim@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'farm:F2'], uid='u-shamim')
    sb.add_user('sajed@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'farm:F2'], uid='u-sajed')
    sb.add_user('irfan@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'farm:F1'], uid='u-irfan')
    hook = lambda pg: pg.route('**/farm-push.mohammedshehta86.workers.dev/**', lambda r: (NOTIFY.append(json.loads(r.request.post_data or '{}')), r.fulfill(status=200, body='{"sent":1}', headers={'Access-Control-Allow-Origin': '*'})))
    c1, pa = new_page(p, sb); hook(pa); login(pa, 'admin@example.com', 'admin123'); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    Y = pa.evaluate("daAddDays(daToday(),-1)")
    pa.evaluate(f"addTX({{id:'f0',type:'feeding',unit:'F2.S01T01',date:'{Y}',kg:2,size:'2',source:'sheet',_skipValidation:true}})")
    pa.evaluate(f"window._es={{date:'{Y}'}}; show('entry-status')"); pa.wait_for_timeout(500)
    check('R1 the admin sees "⏰ automatic reminder" on, at 16:30', pa.evaluate("!!document.getElementById('rm-cfg')") and pa.input_value('#rm-time') == '16:30' and '✅' in pa.inner_text('#rm-auto'))
    check('R2 "📨 remind" next to F2\'s missing feed', pa.evaluate("!!document.querySelector('.es-farm[data-farm=\"F2\"] .rm-btn[data-w=\"feed\"]')"))
    pa.click('.es-farm[data-farm="F2"] .rm-btn[data-w="feed"]'); pa.wait_for_timeout(800)
    names = pa.evaluate("[...document.querySelectorAll('.rm-who')].map(e=>e.parentElement.textContent.trim())")
    check('R3 it lists F2\'s workers who record feed (not F1\'s)', sorted(names) == ['sajed', 'shamim'], names)
    pa.uncheck('.rm-who[value="u-sajed"]'); pa.fill('#rm-note', 'ناقص سكشن 1'); NOTIFY.clear(); pa.click('#rm-send'); pa.wait_for_timeout(500)
    o = pa.evaluate("daWoAll().find(o=>o.kind==='remind')")
    check('R4 sent to Shamim only: a reminder for F2 feed of that day, his phone notified', o['targets'] == ['u-shamim'] and o['date'] == Y and o['what'] == 'feed' and any(n.get('audience') == 'users' and n.get('uids') == ['u-shamim'] for n in NOTIFY), (o, NOTIFY))
    check('R5 the board says it was sent and to whom', 'shamim' in pa.inner_text('.es-farm[data-farm="F2"]') and '📨 اتبعت' in pa.inner_text('.es-farm[data-farm="F2"]'))
    c2, ps = new_page(p, sb); ps.set_viewport_size({'width': 390, 'height': 844}); login(ps, 'shamim@workers.dar-aqua.app', 'work123'); ps.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); ps.wait_for_timeout(500); ps.evaluate('daTabRefresh()'); ps.wait_for_timeout(1500)
    c3, pj = new_page(p, sb); login(pj, 'sajed@workers.dar-aqua.app', 'work123'); pj.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pj.wait_for_timeout(500); pj.evaluate('daTabRefresh()'); pj.wait_for_timeout(1500)
    check('R6 Shamim has it in 🔔; Sajed (unticked) does not', ps.evaluate("daWoDue().some(o=>o.kind==='remind')") and not pj.evaluate("daWoDue().some(o=>o.kind==='remind')"))
    ps.evaluate("show('wo-mine',true)"); ps.wait_for_timeout(300)
    check('R7 his card: "📝 record feed F2 for <day>" with "📋 open the sheet"', 'F2' in ps.inner_text('#content') and ps.evaluate("!!document.querySelector('.rm-open')"))
    ps.click('.rm-open'); ps.wait_for_timeout(400)
    check('R8 the sheet opens on F2 and that day', ps.evaluate("currentView") == 'feed-sheet' and ps.evaluate("window._fs.farm") == 'F2' and ps.evaluate("window._fs.date") == Y)
    for u in ['F2.S01T02', 'F2.S01T03']:
        i = ps.evaluate(f"window._fs.rows.find(r=>r.unit==='{u}').i"); ps.fill(f'#fs-{i}-m0', '2'); ps.fill(f'#fs-{i}-sz', '2')
    ps.click('#fs-save'); ps.wait_for_timeout(1000)
    check('R9 the day complete → the reminder closes by itself', ps.evaluate("daWoAll().find(o=>o.kind==='remind').status") == 'done')
    pa.evaluate("daRealtimePull()"); pa.wait_for_timeout(1500); pa.evaluate("show('entry-status',true)"); pa.wait_for_timeout(400)
    check('R10 the board shows "✅ recorded"', '✅ اتسجل' in pa.inner_text('.es-farm[data-farm="F2"]'))
    # an automatic reminder (as the server writes it at 16:30): no names → the site's feed workers
    pa.evaluate("addTX({id:'rm-auto-F2-'+daToday()+'-feed',type:'work_order',date:daToday(),unit:'',farm:'F2',kind:'remind',what:'feed',tanks:[],text:'3 تانك ناقصين',status:'open',auto:true,byName:'⏰',_skipValidation:true})"); pa.wait_for_timeout(800)
    for pg in (ps, pj): pg.evaluate('daTabRefresh()')
    ps.wait_for_timeout(1500)
    c4, pi = new_page(p, sb); login(pi, 'irfan@workers.dar-aqua.app', 'work123'); pi.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pi.wait_for_timeout(500); pi.evaluate('daTabRefresh()'); pi.wait_for_timeout(1500)
    check('R11 the automatic reminder reaches F2\'s workers (both), not F1\'s', ps.evaluate("daWoDue().some(o=>o.auto)") and pj.evaluate("daWoDue().some(o=>o.auto)") and not pi.evaluate("daWoDue().some(o=>o.auto)"))
    # a missed day (3 days ago), as the server writes it: on the bell and in 🔔, closes once that day is complete
    D3 = pa.evaluate("daAddDays(daToday(),-3)")
    pa.evaluate(f"addTX({{id:'rm-auto-F2-{D3}-feed',type:'work_order',date:'{D3}',unit:'',farm:'F2',kind:'remind',what:'feed',tanks:[],text:'3 تانك ناقصين',status:'open',auto:true,byName:'⏰',_skipValidation:true}})"); pa.wait_for_timeout(800)
    ps.evaluate('daTabRefresh()'); ps.wait_for_timeout(1500)
    check('R11b a missed day (3 days back) is on Shamim\'s bell and in his orders', ps.evaluate(f"daWoDue().some(o=>o.id==='rm-auto-F2-{D3}-feed')") and ps.evaluate("daWoPending()") >= 1)
    ps.evaluate(f"window._fs={{farm:'F2',date:'{D3}'}}; show('feed-sheet',true)"); ps.wait_for_timeout(400)
    for u in ['F2.S01T01', 'F2.S01T02', 'F2.S01T03']:
        i = ps.evaluate(f"window._fs.rows.find(r=>r.unit==='{u}').i"); ps.fill(f'#fs-{i}-m0', '2'); ps.fill(f'#fs-{i}-sz', '2')
    ps.click('#fs-save'); ps.wait_for_timeout(1000)
    check('R11c … recorded → it closes by itself', ps.evaluate(f"daWoAll().find(o=>o.id==='rm-auto-F2-{D3}-feed').status") == 'done')
    pa.click('#rm-auto'); pa.wait_for_timeout(300)
    check('R12 the admin can turn the automatic reminder off (synced setting)', not pa.evaluate("daRmCfg().on") and pa.evaluate("daIsSyncedKey(DA_REMIND_KEY)"))
    ps.click('#lang-btn'); ps.wait_for_timeout(150); ps.click('#da-langmenu button[data-l="ur"]'); ps.wait_for_timeout(300); ps.evaluate("show('wo-mine',true)"); ps.wait_for_timeout(300)
    check('R13 in Urdu for the worker', 'درج کریں' in ps.inner_text('#content') and 'شیٹ کھولیں' in ps.inner_text('#content'))
    check('R14 no page errors', not pa._errs and not ps._errs and not pj._errs and not pi._errs, pa._errs + ps._errs + pj._errs + pi._errs)
    for c in (c1, c2, c3, c4): c.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
