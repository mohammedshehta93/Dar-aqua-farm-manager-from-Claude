# A worker given two sites (F1 and F2) can switch between them on his entry pages; one site = no switch.
import os; os.environ['E2E_PORT'] = '8902'
import harness
harness.DEFAULT_UNITS[:] = [('F1.S01T01', 500, 100), ('F1.S01T02', 500, 100), ('F2.S01T01', 500, 100), ('F2.S04T01', 500, 100)]
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'input_wq', 'farm:F1', 'farm:F2'])
    sb.add_user('one@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'farm:F2'])
    ctx, pg = new_page(p, sb); pg.set_viewport_size({'width': 390, 'height': 844}); login(pg, 'w@workers.dar-aqua.app', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(600)
    pg.evaluate("show('feed-sheet',true)"); pg.wait_for_timeout(400)
    check('T1 a worker with F1 and F2 sees "📍 F1 | F2" on the feed sheet', pg.evaluate("[...document.querySelectorAll('.da-site')].map(b=>b.dataset.f)") == ['F1', 'F2'])
    pg.click('.da-site[data-f="F2"]'); pg.wait_for_timeout(500)
    rows = pg.evaluate("(window._fs.rows||[]).filter(r=>r.unit).map(r=>r.unit)")
    check('T2 a tap on F2 → the feed sheet shows F2\'s tanks', pg.evaluate("window._fs.farm") == 'F2' and rows == ['F2.S01T01', 'F2.S04T01'], rows)
    i = pg.evaluate("window._fs.rows.find(r=>r.unit==='F2.S01T01').i"); pg.fill(f'#fs-{i}-m0', '3'); pg.fill(f'#fs-{i}-sz', '2'); pg.click('#fs-save'); pg.wait_for_timeout(800)
    check('T3 F2 feed saved', pg.evaluate("getTX().some(t=>t.type==='feeding' && t.unit==='F2.S01T01' && t.kg===3)"))
    pg.evaluate("show('wq-sheet',true)"); pg.wait_for_timeout(400)
    check('T4 the readings sheet follows (F2), with the switch there too', pg.evaluate("(window._wqs||{}).farm") == 'F2' and pg.evaluate("!!document.getElementById('da-site-sw')"))
    pg.click('.da-site[data-f="F1"]'); pg.wait_for_timeout(400); pg.evaluate("show('feed-sheet',true)"); pg.wait_for_timeout(400)
    check('T5 back to F1 on every page', pg.evaluate("window._fs.farm") == 'F1' and pg.evaluate("(window._fs.rows||[]).filter(r=>r.unit).every(r=>r.unit.indexOf('F1.')===0)"))
    pg.reload(); pg.wait_for_timeout(1500); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.evaluate("show('feed-sheet',true)"); pg.wait_for_timeout(400)
    check('T6 after reopening the app the switch is still there', pg.evaluate("document.querySelectorAll('.da-site').length") == 2)
    c2, p2 = new_page(p, sb); p2.set_viewport_size({'width': 390, 'height': 844}); login(p2, 'one@workers.dar-aqua.app', 'work123'); p2.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); p2.wait_for_timeout(500)
    p2.evaluate("show('feed-sheet',true)"); p2.wait_for_timeout(400)
    check('T7 a worker with one site: no switch, his site only', not p2.evaluate("!!document.getElementById('da-site-sw')") and p2.evaluate("window._fs.farm") == 'F2')
    # the other places a second site must count: work orders, the notification subscription, an office account with two sites
    pg.evaluate("addTX({id:'wo-a',type:'work_order',date:daToday(),unit:'',farm:'F1',kind:'text',text:'a',tanks:[],status:'open',_skipValidation:true}); addTX({id:'wo-b',type:'work_order',date:daToday(),unit:'',farm:'F2',kind:'text',text:'b',tanks:[],status:'open',_skipValidation:true}); addTX({id:'wo-c',type:'work_order',date:daToday(),unit:'',farm:'F3',kind:'text',text:'c',tanks:[],status:'open',_skipValidation:true})")
    check('T9 his work orders come from BOTH his sites (not a third)', sorted(pg.evaluate("daWoMine().map(o=>o.farm)")) == ['F1', 'F2'], pg.evaluate("daWoMine().map(o=>o.farm)"))
    check('T10 his phone notifications are kept for both sites', pg.evaluate("daUserFarms()") == ['F1', 'F2'])
    sb.add_user('eng2@example.com', 'eng123', role='engineer', perms=['view_dashboard', 'input_feeding', 'farm:F1', 'farm:F2'])
    c3, pe = new_page(p, sb); login(pe, 'eng2@example.com', 'eng123'); pe.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pe.wait_for_timeout(500)
    pe.evaluate("show('feed-sheet',true)"); pe.wait_for_timeout(400)
    can = pe.evaluate("(() => { setFarm('F2'); show('feed-sheet',true); return window._fs.farm; })()")
    check('T11 an office account with two sites can open each (the farm menu); a site not given is refused', can == 'F2' and pe.evaluate("(() => { setFarm('F3'); daEnforceSite && daEnforceSite(); return farmFilter; })()") in ('F1', 'F2'))
    c3.close()
    check('T8 no page errors', not pg._errs and not p2._errs, pg._errs + p2._errs)
    ctx.close(); c2.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
