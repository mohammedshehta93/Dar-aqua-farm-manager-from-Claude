# Data management: full backup / restore, archive (private cloud folder) + fresh start, reset levels 1-3 with
# safeguards (backup downloaded first, farm name typed, password), other devices wipe their old copy; admin only.
import os, json, gzip; os.environ['E2E_PORT'] = '8904'
import harness
harness.DEFAULT_UNITS[:] = [('F1.S01T01', 500, 100), ('F1.S01T02', 500, 100), ('F2.S01T01', 500, 100)]
from harness import *
STORE = {}
def storage(route):
    r = route.request; u = r.url
    if '/object/list/farm-archives' in u: return route.fulfill(status=200, body=json.dumps([{'name': k.split('/', 2)[2]} for k in sorted(STORE, reverse=True)]), headers={'Content-Type': 'application/json'})
    path = u.split('/storage/v1/object/')[1]
    if r.method == 'POST': STORE[path] = r.post_data_buffer; return route.fulfill(status=200, body='{}')
    return route.fulfill(status=200, body=STORE.get(path, b''), headers={'Content-Type': 'application/gzip'})
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('eng@example.com', 'eng123', role='engineer', uid='u-eng')
    sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'farm:F1'], uid='u-w')
    c1, pa = new_page(p, sb); pa.route('**/storage/v1/object/**', storage); pa.route('**/rest/v1/maintenance_requests*', lambda r: r.fulfill(status=200, body='[]', headers={'Content-Type': 'application/json'}))
    login(pa, 'admin@example.com', 'admin123'); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    answers = []
    pa.on('dialog', lambda d: d.accept(answers.pop(0)) if answers else d.accept())
    Y = pa.evaluate("daAddDays(daToday(),-1)")
    pa.evaluate(f"['F1.S01T01','F1.S01T02','F2.S01T01'].forEach((u,i)=>{{ addTX({{id:'f'+i,type:'feeding',unit:u,date:'{Y}',kg:2,size:'2',source:'sheet',_skipValidation:true}}); addTX({{id:'m'+i,type:'mortality',unit:u,date:'{Y}',count:1,source:'sheet',_skipValidation:true}}); }}); localStorage.setItem('daracqua_settings_v2_remind', JSON.stringify({{on:true,time:'16:30'}}))")
    pa.wait_for_timeout(2500); NAME = pa.evaluate("daDaFarmName()")
    n_cloud = lambda: sum(1 for r in sb.tx.values() if r['farm_id'] == 'farm-main')
    check('D1 the records reached the cloud (6)', n_cloud() == 6, n_cloud())
    pa.evaluate("show('data-admin')"); pa.wait_for_timeout(400)
    check('D2 the admin has 🧰 data management: backup, restore, archive, 3 reset levels, handover and new-farm steps', all(pa.evaluate(f"!!document.getElementById('{i}')") for i in ['da-backup', 'da-restore', 'da-archive', 'da-reset-1', 'da-reset-2', 'da-reset-3', 'da-handover', 'da-newfarm']))
    with pa.expect_download() as dl: pa.click('#da-backup')
    bk = json.loads(open(dl.value.path(), encoding='utf-8').read())
    check('D3 the full backup holds the tanks, every record, the settings and the users', len(bk['units']) == 3 and len(bk['tx']) >= 6 and 'daracqua_settings_v2_remind' in bk['settings'] and len(bk['users']) == 3 and bk['meta']['farm_name'] == NAME)
    # wrong name, then wrong password → nothing deleted
    answers[:] = [None, 'غلط']
    with pa.expect_download(): pa.click('#da-reset-1')
    pa.wait_for_timeout(600)
    answers[:] = [None, NAME, 'wrong-pass']
    with pa.expect_download(): pa.click('#da-reset-1')
    pa.wait_for_timeout(900)
    check('D4 a wrong farm name or a wrong password cancels — nothing deleted', n_cloud() == 6)
    # the worker's phone holds the old data
    c2, pw = new_page(p, sb); login(pw, 'w@workers.dar-aqua.app', 'work123'); pw.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pw.wait_for_timeout(800)
    old_w = pw.evaluate("getTX().filter(t=>t.type==='feeding').length")
    # level 1 for real
    answers[:] = [None, NAME, 'admin123']
    with pa.expect_download() as dl1: pa.click('#da-reset-1')
    pa.wait_for_timeout(2500)
    check('D5 level 1: a backup downloaded first, the cloud records gone, the tanks and settings kept', dl1.value.path() and n_cloud() == 0 and sum(1 for r in sb.units.values() if r['farm_id'] == 'farm-main') == 3 and 'daracqua_settings_v2_remind' in (sb.settings.get('farm-main') or {}), (n_cloud(), len(sb.units)))
    pa.wait_for_function('() => !!window._cloudSyncDone', timeout=15000); pa.wait_for_timeout(800)
    check('D6 the admin\'s device reloaded empty of records', pa.evaluate("getTX().filter(t=>t.type==='feeding').length") == 0)
    pw.evaluate("daPullSettings().then(()=>daDaCheckReset())"); pw.wait_for_timeout(3500); pw.wait_for_function('() => !!window._cloudSyncDone', timeout=15000); pw.wait_for_timeout(800)
    check('D7 the worker\'s phone (had ' + str(old_w) + ' feed records) wiped its old copy by itself', old_w > 0 and pw.evaluate("getTX().filter(t=>t.type==='feeding').length") == 0)
    # restore from the backup file
    pa.evaluate("show('data-admin')"); pa.wait_for_timeout(300)
    with pa.expect_file_chooser() as fc: pa.click('#da-restore')
    fc.value.set_files(dl.value.path()); pa.wait_for_timeout(3500); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=15000); pa.wait_for_timeout(800)
    check('D8 restore from the file: the records are back in the cloud and on the device', n_cloud() >= 6 and pa.evaluate("getTX().filter(t=>t.type==='feeding').length") == 3, n_cloud())
    # archive: kept in the farm's private folder, then a fresh start
    pa.evaluate("show('data-admin')"); pa.wait_for_timeout(300)
    answers[:] = ['موسم تجربة', None, NAME, 'admin123']
    pa.click('#da-archive'); pa.wait_for_timeout(3500)
    keys = list(STORE)
    check('D9 archive: saved in the farm\'s own folder (farm-archives/<farm>/…), then the records cleared', keys and keys[0].startswith('farm-archives/farm-main/') and n_cloud() == 0, keys)
    pa.wait_for_function('() => !!window._cloudSyncDone', timeout=15000); pa.evaluate("show('data-admin')"); pa.wait_for_timeout(1200)
    check('D10 the archive is listed with its name', 'موسم تجربة' in pa.inner_text('#da-arch-list'))
    data = json.loads(gzip.decompress(STORE[keys[0]]).decode('utf-8'))
    check('D11 the archive holds the season (records + tanks)', len(data['tx']) >= 6 and len(data['units']) == 3)
    answers[:] = [None]
    pa.click('#da-arch-list button:has-text("رجّعه")'); pa.wait_for_timeout(3500); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=15000)
    check('D12 the archive can be brought back', n_cloud() >= 6)
    # a phone that was offline holds a record made BEFORE a reset: when it comes back it must see the mark first and never upload it
    c4, po = new_page(p, sb); login(po, 'w@workers.dar-aqua.app', 'work123'); po.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); po.wait_for_timeout(2500)
    po.wait_for_function('() => !!window._cloudSyncDone', timeout=15000)
    po.evaluate("Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}); addTX({id:'off-1',type:'feeding',unit:'F1.S01T01',date:daToday(),kg:3,size:'2',source:'sheet',_skipValidation:true})")
    q_before = po.evaluate("getOfflineQueue().length")
    pa.evaluate("show('data-admin')"); pa.wait_for_timeout(300); answers[:] = [None, NAME, 'admin123']
    with pa.expect_download(): pa.click('#da-reset-1')
    pa.wait_for_timeout(2500); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=15000)
    po.evaluate("Object.defineProperty(navigator,'onLine',{get:()=>true,configurable:true}); _offLast = 0; window.dispatchEvent(new Event('online'))")
    po.wait_for_timeout(4500)
    check('D17 an offline phone with a pre-reset record: back online it sees the reset first — nothing uploaded, its old copy and queue wiped', q_before >= 1 and n_cloud() == 0 and po.evaluate("getTX().filter(t=>t.id==='off-1').length") == 0 and po.evaluate("getOfflineQueue().length") == 0, (q_before, n_cloud()))
    # level 2 and 3
    pa.evaluate("show('data-admin')"); pa.wait_for_timeout(300); answers[:] = [None, NAME, 'admin123']
    with pa.expect_download(): pa.click('#da-reset-2')
    pa.wait_for_timeout(2500)
    check('D13 level 2: records and tanks gone, settings kept', n_cloud() == 0 and sum(1 for r in sb.units.values() if r['farm_id'] == 'farm-main') == 0 and 'farm-main' in sb.settings)
    pa.wait_for_function('() => !!window._cloudSyncDone', timeout=15000); pa.evaluate("show('data-admin')"); pa.wait_for_timeout(300); answers[:] = [None, NAME, 'admin123']
    with pa.expect_download(): pa.click('#da-reset-3')
    pa.wait_for_timeout(2500)
    prof = {k: v.get('active') for k, v in sb.profiles.items()}
    check('D14 level 3: everything gone, every other account switched off, the admin\'s stays', prof.get('u-admin') is not False and prof.get('u-eng') is False and prof.get('u-w') is False, prof)
    c3, pe = new_page(p, sb); login(pe, 'eng@example.com', 'eng123'); pe.wait_for_timeout(1500)
    check('D15 data management is for the admin only', not pe.evaluate("typeof canAccessView==='function' && currentUser ? canAccessView('data-admin') : false"))
    check('D16 no page errors', not pa._errs and not pw._errs and not po._errs, (pa._errs + pw._errs + po._errs)[:3])
    for c in (c1, c2, c3, c4): c.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
