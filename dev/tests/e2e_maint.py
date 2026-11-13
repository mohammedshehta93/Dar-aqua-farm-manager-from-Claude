# Maintenance (the old tool's table) + purchase requests + "today" on the dashboard.
import os, json, re, time, urllib.parse; os.environ['E2E_PORT'] = '8885'
import harness
harness.DEFAULT_UNITS[:] = [(f'F2.S01T{t:02d}', 500, 100) for t in range(1, 4)]
from harness import *
DB = [{'id': 1, 'ref': 'AQUA-26-0001', 'requested_by': 'old tool', 'area': 'FH1', 'summary': 'Pipe leak', 'details': '', 'priority': 'medium', 'type': 'corrective', 'status': 'open', 'target_date': '2026-01-01', 'photo_urls': [], 'created_at': '2026-01-01T08:00:00Z', 'farm_id': None}]
NOTIFY, UPLOADS = [], []
def maint_route(route):
    req = route.request; u = req.url; m = req.method
    if m == 'GET': return route.fulfill(status=200, body=json.dumps(sorted(DB, key=lambda r: r['created_at'], reverse=True)), headers={'Content-Type': 'application/json'})
    body = json.loads(req.post_data or '{}')
    if m == 'POST':
        row = dict(body, id=len(DB) + 1, created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())); DB.append(row); return route.fulfill(status=201, body=json.dumps([row]), headers={'Content-Type': 'application/json'})
    if m == 'PATCH':
        q = urllib.parse.unquote(u.split('?', 1)[1])
        for r in DB:
            if ('farm_id=is.null' in q and r.get('farm_id') is None) or ('id=eq.' + str(r['id'])) in q: r.update(body)
        return route.fulfill(status=200, body='[]', headers={'Content-Type': 'application/json'})
    route.fallback()
def hook(pg):
    pg.route('**/rest/v1/maintenance_requests*', maint_route)
    pg.route('**/storage/v1/object/maintenance-images/**', lambda r: (UPLOADS.append(r.request.url), r.fulfill(status=200, body='{}')))
    pg.route('**/farm-push.mohammedshehta86.workers.dev/**', lambda r: (NOTIFY.append(json.loads(r.request.post_data or '{}')), r.fulfill(status=200, body='{"sent":1}', headers={'Access-Control-Allow-Origin': '*'})))
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('mgr@example.com', 'mgr123', role='manager', perms=['view_dashboard', 'approve_purchase'])
    sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'report_fault', 'farm:F2'])
    sb.add_user('plain@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'farm:F2'])
    sb.add_user('tech@workers.dar-aqua.app', 'tech123', role='worker', perms=['fix_maint'])
    # the add-ons are OFF until the admin turns them on
    c0, pa = new_page(p, sb); hook(pa); login(pa, 'admin@example.com', 'admin123'); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    check('M0a off by default: nobody sees maintenance or purchases, not even the admin', not pa.evaluate("canAccessView('maint') || canAccessView('purchases')"))
    pa.evaluate("show('settings')"); pa.wait_for_timeout(400)
    check('M0b Settings has "🧩 add-ons" with both switches (admin)', pa.evaluate("!!document.getElementById('feat-maint') && !!document.getElementById('feat-purchases')"))
    pa.click('#feat-maint'); pa.wait_for_timeout(300); pa.click('#feat-purchases'); pa.wait_for_timeout(1500)
    check('M0c turned on (synced to every device)', pa.evaluate("daFeat('maint') && daFeat('purchases') && daIsSyncedKey(DA_FEATURES_KEY)"))
    c9, pp = new_page(p, sb); pp.set_viewport_size({'width': 390, 'height': 844}); hook(pp); login(pp, 'plain@workers.dar-aqua.app', 'work123'); pp.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pp.wait_for_timeout(400); pp.evaluate('daTabRefresh()'); pp.wait_for_timeout(1500)
    check('M0d on, but a worker without the permission sees nothing of it', not pp.evaluate("!!document.getElementById('wb-maint') || canAccessView('maint') || canAccessView('purchases')"))
    c1, pw = new_page(p, sb); pw.set_viewport_size({'width': 390, 'height': 844}); hook(pw); login(pw, 'w@workers.dar-aqua.app', 'work123'); pw.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pw.wait_for_timeout(400); pw.evaluate('daTabRefresh()'); pw.wait_for_timeout(1500)
    check('M1 a worker with "report faults" has 🔧; no 🛒 (no purchase permission)', pw.evaluate("!!document.getElementById('wb-maint') && !document.getElementById('wb-pr')"))
    pw.click('#wb-maint'); pw.wait_for_timeout(600); pw.click('#mt-new'); pw.wait_for_timeout(200)
    pw.select_option('#mt-area', 'FH2'); pw.wait_for_timeout(150); pw.select_option('#mt-fault', 'Blower stopped'); pw.wait_for_timeout(150); pw.select_option('#mt-prio', 'high')
    open('/tmp/p.jpg', 'wb').write(b'\xff\xd8\xff' + b'0' * 100); pw.set_input_files('#mt-photos', ['/tmp/p.jpg']); pw.click('#mt-send'); pw.wait_for_timeout(1200)
    new = DB[-1]
    check('M2 the fault is saved in the shared table with this farm, the site F2, urgent, by the worker; the photo uploaded and linked', new.get('summary') == 'Blower stopped' and new.get('farm_id') and new.get('site') == 'F2' and new.get('priority') == 'high' and new.get('requested_by') and UPLOADS and len(new.get('photo_urls') or []) == 1, {k: new.get(k) for k in ['summary', 'site', 'priority', 'photo_urls']})
    check('M3 an urgent fault notifies only those who fix (permission)', any(n.get('audience') == 'perm' and n.get('perm') == 'fix_maint' for n in NOTIFY), NOTIFY)
    pw.evaluate("window._mt.open=String(" + str(new['id']) + "); show('maint',true)"); pw.wait_for_timeout(300)
    check('M4 a worker without the fix permission sees the fault but cannot change it', not pw.evaluate("!!document.getElementById('mtd-close')"))
    c2, pt = new_page(p, sb); pt.set_viewport_size({'width': 390, 'height': 844}); hook(pt); login(pt, 'tech@workers.dar-aqua.app', 'tech123'); pt.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pt.wait_for_timeout(400); pt.evaluate('daTabRefresh()'); pt.wait_for_timeout(1500)
    check('M5 the technician (worker + "fix faults") gets 🔧 and 🛒', pt.evaluate("!!document.getElementById('wb-maint') && !!document.getElementById('wb-pr')"))
    pt.click('#wb-maint'); pt.wait_for_timeout(800)
    check('M6 the old tool\'s requests show and join this farm', 'Pipe leak' in pt.inner_text('#content') and DB[0].get('farm_id'))
    pt.evaluate("window._mt.open=String(" + str(new['id']) + "); show('maint',true)"); pt.wait_for_timeout(300)
    pt.click('#mtd-start'); pt.wait_for_timeout(600)
    check('M7 started → in progress', DB[-1]['status'] == 'in_progress')
    pt.evaluate("window._mt.open=String(" + str(new['id']) + "); show('maint',true)"); pt.wait_for_timeout(300)
    pt.fill('#mtd-root_cause', 'Burnt capacitor'); pt.fill('#mtd-parts', 'Capacitor 40uF'); pt.click('#mtd-buy'); pt.wait_for_timeout(400)
    check('M8 "request parts" opens a purchase request filled from the fault', pt.evaluate("currentView") == 'purchases' and 'AQUA-' in pt.evaluate("window._pr.form.maint"))
    pt.fill('#pr-item', 'Capacitor 40uF'); pt.fill('#pr-qty', '2'); pt.click('#pr-send'); pt.wait_for_timeout(500)
    pr = pt.evaluate("daPrAll()[0]")
    check('M9 the purchase request is saved (requested, linked to the fault) and notifies only the approvers', pr['status'] == 'requested' and pr['maint'].startswith('AQUA-') and pr['qty'] == 2 and any(n.get('perm') == 'approve_purchase' for n in NOTIFY), pr)
    check('M10 … and the fault keeps the link', (DB[-1].get('purchase_refs') or [None])[0] == pr['ref'])
    check('M11 a technician cannot approve', not pt.evaluate("!!document.querySelector('.pr-ok')"))
    pt.evaluate("window._mt.open=String(" + str(new['id']) + "); show('maint',true)"); pt.wait_for_timeout(300); pt.fill('#mtd-corrective_action', 'Replaced capacitor'); pt.click('#mtd-close'); pt.wait_for_timeout(600)
    check('M12 fixed → closed, with the date and the technician', DB[-1]['status'] == 'closed' and DB[-1].get('closed_at') and DB[-1].get('technician') and DB[-1].get('corrective_action') == 'Replaced capacitor')
    c3, pm = new_page(p, sb); hook(pm); pm.on('dialog', lambda d: d.accept('موجود في المخزن')); login(pm, 'mgr@example.com', 'mgr123'); pm.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pm.wait_for_timeout(400); pm.evaluate('daTabRefresh()'); pm.wait_for_timeout(1500)
    pm.evaluate("daRealtimePull()"); pm.wait_for_timeout(1500); pm.evaluate("show('purchases')"); pm.wait_for_timeout(400)
    check('M13 the manager sees it waiting, with approve / reject', pm.evaluate("!!document.querySelector('.pr-ok')"))
    NOTIFY.clear(); pm.click('.pr-ok'); pm.wait_for_timeout(400)
    check('M14 approved → the requester is notified', pm.evaluate("daPrAll()[0].status") == 'approved' and any(n.get('audience') == 'user' for n in NOTIFY), NOTIFY)
    pm.evaluate("window._pr.filter='approved'; show('purchases',true)"); pm.wait_for_timeout(200); pm.click('.pr-ord'); pm.wait_for_timeout(300)
    pm.evaluate("window._pr.filter='ordered'; show('purchases',true)"); pm.wait_for_timeout(200); pm.click('.pr-rcv'); pm.wait_for_timeout(300)
    check('M15 ordered → received', pm.evaluate("daPrAll()[0].status") == 'received')
    pm.evaluate("addTX({id:'pr-x',type:'purchase',unit:'',date:daToday(),ref:'PR-X',item:'Net',qty:1,unitName:'pcs',status:'requested',_skipValidation:true}); window._pr.filter='waiting'; show('purchases',true)"); pm.wait_for_timeout(200)
    pm.click('.pr-no'); pm.wait_for_timeout(300)
    check('M16 rejected with the reason', pm.evaluate("(r => r.status + '|' + r.rejectReason)(daPrAll().find(r=>r.ref==='PR-X'))") == 'rejected|موجود في المخزن')
    pm.evaluate("show('dashboard')"); pm.wait_for_timeout(1200)
    td = pm.inner_text('#da-today') if pm.query_selector('#da-today') else ''
    check('M17 the dashboard shows "today on the farm": the fault, its fix, the purchases', 'Blower stopped' in td and 'اتصلح' in td and 'Capacitor' in td and 'أعطال مفتوحة' in td, td[:300])
    check('M18 four permissions to tick per account (report / fix / request / approve)', pm.evaluate("['report_fault','fix_maint','request_purchase','approve_purchase'].every(id => getPermsList().some(p=>p.id===id))"))
    pa.click('#feat-maint'); pa.wait_for_timeout(300)
    check('M18b turned off again: hidden at once', not pa.evaluate("canAccessView('maint')"))
    pw.click('#lang-btn'); pw.wait_for_timeout(150); pw.click('#da-langmenu button[data-l="ur"]'); pw.wait_for_timeout(300); pw.evaluate("window._mt.open=null; show('maint',true)"); pw.wait_for_timeout(300)
    check('M19 in Urdu for the worker', 'خرابی کی اطلاع' in pw.inner_text('#content'))
    check('M20 no page errors', not pw._errs and not pt._errs and not pm._errs, pw._errs + pt._errs + pm._errs)
    for c in (c0, c9, c1, c2, c3): c.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
