# Tanks always reach the cloud (and the phones); deleting a tank / farm removes it everywhere; old Settings tanks move over.
import os; os.environ['E2E_PORT'] = '8860'
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('sajed@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_wq', 'farm:F3'])
    c1, pc = new_page(p, sb); login(pc, 'admin@example.com', 'admin123'); pc.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    st = {'fail': 1}
    def handler(route):
        if st['fail'] and route.request.method == 'POST': st['fail'] -= 1; route.fulfill(status=503, body='{"message":"timeout"}')
        else: route.fallback()
    pc.route('**/rest/v1/farm_units*', handler)
    pc.on('dialog', lambda d: d.accept())
    pc.evaluate("show('farm-setup')"); pc.wait_for_timeout(300)
    pc.select_option('#ta-farm', '__new'); pc.fill('#ta-newcode', 'F3'); pc.fill('#ta-newname', 'Nursery'); pc.fill('#ta-n', '3'); pc.click('#ta-save'); pc.wait_for_timeout(800)
    cloudF3 = lambda: sorted(k.split(':')[1] for k in sb.units if ':F3.' in k)
    check('S1 the upload failed: the tanks are kept and listed as waiting (not lost)', pc.evaluate("RAW.filter(u=>u.farm==='F3').length") == 3 and len(pc.evaluate("Object.keys(daUPend())")) == 3 and cloudF3() == [])
    pc.wait_for_timeout(1200)
    check('S2 the status card shows them waiting', '⏳ 3' in pc.inner_text('#us-card'), pc.inner_text('#us-card')[:200])
    pc.evaluate("daRealtimePull()"); pc.wait_for_timeout(1200)
    check('S3 the next sync uploads them by itself (queue emptied, in the cloud, still on the computer)', cloudF3() == ['F3.S01T01', 'F3.S01T02', 'F3.S01T03'] and pc.evaluate("Object.keys(daUPend()).length") == 0 and pc.evaluate("RAW.filter(u=>u.farm==='F3').length") == 3, cloudF3())
    c2, ph = new_page(p, sb); ph.set_viewport_size({'width': 390, 'height': 844}); login(ph, 'sajed@workers.dar-aqua.app', 'work123'); ph.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); ph.wait_for_timeout(600)
    check('S4 Sajed\'s phone (F3 only) shows the nursery tanks in the feed sheet', ph.evaluate("(window._fs.rows||[]).length") == 3 and 'No tanks' not in ph.inner_text('#content'))
    ph.click('#da-wbar button[data-v="wq-sheet"]'); ph.wait_for_timeout(300)
    check('S5 and the testing log (section S-01)', 'S-01' in ph.inner_text('#content'))
    # a tank on the computer that never reached the cloud (added before this update): "upload now" sends it
    pc.evaluate("RAW.push({unit:'F3.S01T09',farm:'F3',section:'F3.S01',fishNo:0,startWt:0,avgWt:0,volume:2}); daPersistUnitsLocal()")
    pc.evaluate("show('farm-setup',true)"); pc.wait_for_timeout(1200)
    check('S5b a tank missing from the cloud shows as waiting, "upload now" sends it', '⏳ 1' in pc.inner_text('#us-card'))
    pc.click('#us-flush'); pc.wait_for_timeout(1000)
    check('S5c … and it is in the cloud', 'F3.S01T09' in cloudF3())
    pc.evaluate("daUnitDeleteEverywhere('F3.S01T09')"); pc.wait_for_timeout(500)
    # not ready at all (the cloud link not up yet): never silent
    pc.evaluate("window.__sbr = sbReady; sbReady = false"); pc.evaluate("show('farm-setup',true)"); pc.wait_for_timeout(300)
    pc.select_option('#ta-farm', 'F3'); pc.fill('#ta-sec', '2'); pc.dispatch_event('#ta-sec', 'input'); pc.fill('#ta-n', '2'); pc.click('#ta-save'); pc.wait_for_timeout(600)
    check('S6 cloud link not ready: queued, not silently dropped', len(pc.evaluate("Object.keys(daUPend())")) == 2)
    pc.evaluate("sbReady = window.__sbr; daRealtimePull()"); pc.wait_for_timeout(1200)
    check('S7 uploaded as soon as the link is back', 'F3.S02T01' in cloudF3() and 'F3.S02T02' in cloudF3())
    # delete a tank: everywhere
    pc.evaluate("show('farm-setup',true)"); pc.wait_for_timeout(300); pc.evaluate("daDeleteUnit('F3.S02T02')"); pc.wait_for_timeout(600)
    check('S8 deleting a tank removes it from the computer and the cloud', 'F3.S02T02' not in cloudF3() and not pc.evaluate("RAW.some(u=>u.unit==='F3.S02T02')"))
    # old Settings tanks → main list
    pc.evaluate("() => { const u=getFarmUnits(); ['N1','N2'].forEach((n,i)=>u.push({id:'o'+i,name:n,farm:'F3',fishNo:1000,startWt:1,volume:2})); saveFarmUnits(u); }")
    pc.evaluate("show('farm-setup',true)"); pc.wait_for_timeout(1200)
    check('S9 old Settings tanks are shown as such', '⚠️ 2' in pc.inner_text('#us-card'))
    pc.click('#us-move'); pc.wait_for_timeout(900)
    check('S10 one click moves them to the main list and the cloud (same names)', pc.evaluate("getFarmUnits().filter(u=>u.farm==='F3').length") == 0 and pc.evaluate("RAW.filter(u=>u.unit==='N1'||u.unit==='N2').length") == 2 and 'N1' in cloudF3() + [k.split(':')[1] for k in sb.units])
    # delete the farm: its tanks go too
    pc.evaluate("farmRegDelete('F3')"); pc.wait_for_timeout(1500)
    check('S11 deleting the farm deletes its tanks everywhere (nothing left behind)', cloudF3() == [] and not pc.evaluate("RAW.some(u=>u.farm==='F3')") and not pc.evaluate("'F3' in getFarmsRegistry()") and not any(':N1' in k or ':N2' in k for k in sb.units))
    ph.evaluate("daTabRefresh()"); ph.wait_for_timeout(1500)
    check('S12 the phone drops them too', ph.evaluate("RAW.filter(u=>u.farm==='F3').length") == 0)
    check('S13 no page errors', not pc._errs and not ph._errs, pc._errs + ph._errs)
    c1.close(); c2.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
