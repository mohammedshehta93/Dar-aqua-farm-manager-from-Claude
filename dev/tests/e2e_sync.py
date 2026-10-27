import os, time as _t; os.environ['E2E_PORT'] = '8795'
from harness import *
def wait_sync(pg): pg.wait_for_function('() => !!window._cloudSyncDone', timeout=20000); pg.wait_for_timeout(300)
def reload_sync(pg): pg.evaluate('window._cloudSyncDone=0'); pg.reload(); pg.wait_for_timeout(300); wait_sync(pg); pg.wait_for_timeout(500)
with sync_playwright() as p:
    harness_browser[0] = p.chromium.launch()
    sb = MockSB(); sb.add_user('owner@example.com','admin123',role='admin',uid='u-admin')
    for i in range(2500):   # an existing farm history
        sb.tx['h%d' % i] = {'id':'h%d' % i,'farm_id':'farm-main','type':'feeding','unit':'F1.S01T01','synced_at':__import__('datetime').datetime(2026,1,1,tzinfo=__import__('datetime').timezone.utc).__add__(__import__('datetime').timedelta(minutes=i*60)).strftime('%Y-%m-%dT%H:%M:%S.000000Z'),
                            'data':{'id':'h%d' % i,'type':'feeding','date':'2026-09-01','unit':'F1.S01T01','kg':1,'ts':'2026-09-01T00:00:00Z'}}
    cA, A = new_page(p, sb); login(A,'owner@example.com','admin123'); wait_sync(A)
    check('Y1 first login: full download once, sync point saved', A.evaluate('window._lastLoadMode') == 'full:2500' and A.evaluate("() => !!daSyncMeta().at"), A.evaluate('window._lastLoadMode'))
    cB, B = new_page(p, sb); login(B,'owner@example.com','admin123'); wait_sync(B)
    B.evaluate("() => { addTX({id:'n1',type:'feeding',date:daToday(),unit:'F1.S01T02',kg:2,_skipValidation:true}); addTX({id:'n2',type:'feeding',date:daToday(),unit:'F1.S01T02',kg:3,_skipValidation:true}); }")
    B.evaluate("addTX({id:'skew',type:'feeding',date:daToday(),unit:'F1.S01T02',kg:4,ts:'2019-01-01T00:00:00Z',_skipValidation:true})")
    B.wait_for_timeout(900)
    served0 = getattr(sb, 'sync_rows_served', 0)
    reload_sync(A)
    mode = A.evaluate('window._lastLoadMode'); served = getattr(sb, 'sync_rows_served', 0) - served0
    check('Y2 next login downloads only what changed (not 2,500 again)', mode.startswith('incremental:') and served < 50, (mode, served))
    check('Y3 nothing missed — even an entry from a device with a wrong clock', A.evaluate("() => ['n1','n2','skew'].every(id => getTX().some(t => t.id === id))"))
    B.evaluate("updateTX('n1', {kg:9})"); B.evaluate("deleteTX('n2')"); B.wait_for_timeout(900)
    A.evaluate('daRealtimePull()'); A.wait_for_timeout(900)
    check('Y4 edits and deletes reach the other device', A.evaluate("() => getTX().find(t=>t.id==='n1').kg === 9 && !getTX().some(t=>t.id==='n2')"))
    # Y6 a single save that fails is queued, not dropped
    sb.offline = True
    B.evaluate("addTX({id:'q1',type:'feeding',date:daToday(),unit:'F1.S01T02',kg:1,_skipValidation:true})"); B.wait_for_timeout(700)
    queued = B.evaluate("() => getOfflineQueue().some(x => x.data && x.data.id === 'q1')"); sb.offline = False
    B.evaluate('_offLast=0; syncOfflineQueue()'); B.wait_for_timeout(900)
    check('Y6 a failed save waits in the queue and uploads later', queued and 'q1' in sb.tx, queued)
    # Y7 weekly id check repairs anything that slipped through
    A.evaluate("() => { const a=getTX(); a.push({id:'orphan',type:'feeding',date:daToday(),unit:'F1.S01T03',kg:1,ts:new Date().toISOString()}); saveTX(a); }")
    del sb.tx['h5']
    A.evaluate('daMaybeReconcile(true)'); A.wait_for_timeout(1500)
    rec = A.evaluate('window._lastReconcile')
    check('Y7 weekly check: local-only record uploaded', 'orphan' in sb.tx and rec and rec['uploaded'] >= 1, rec)
    # Y8 rename a tank with its history; other devices follow
    n_before = A.evaluate("() => getTX().filter(t=>t.unit==='F1.S01T02').length")
    A.on('dialog', lambda d: d.accept())
    A.evaluate("show('farm-setup')"); A.wait_for_timeout(300); A.evaluate("daOpenUnitEditor('F1.S01T02')"); A.wait_for_timeout(200)
    A.fill('#ue-name', 'f1.s01.t09'); A.click('#ue-save'); A.wait_for_timeout(1500)
    r = A.evaluate("() => ({old: getTX().filter(t=>t.unit==='F1.S01T02').length, nw: getTX().filter(t=>t.unit==='F1.S01T09').length, raw: !!daRawUnit('F1.S01T09') && !daRawUnit('F1.S01T02'), hist: (daRawUnit('F1.S01T09').history||[]).some(h=>h.f==='unit')})")
    check('Y8 rename moves every transaction + keeps a record of the old name', r['old'] == 0 and r['nw'] == n_before and r['raw'] and r['hist'], r)
    check('Y8 cloud updated (old tank row gone, new present, rows re-labelled)', 'farm-main:F1.S01T02' not in sb.units and 'farm-main:F1.S01T09' in sb.units and sb.tx['n1']['data']['unit'] == 'F1.S01T09')
    B.evaluate('daRealtimePull()'); B.wait_for_timeout(1500)
    check('Y8 other device follows (no ghost tank left behind)', B.evaluate("() => !!daRawUnit('F1.S01T09') && !daRawUnit('F1.S01T02') && getTX().find(t=>t.id==='n1').unit === 'F1.S01T09'"))
    A.evaluate("daOpenUnitEditor('F1.S01T09')"); A.wait_for_timeout(200); hook_toasts(A)
    A.fill('#ue-name', 'F1.S01T01'); A.click('#ue-save'); A.wait_for_timeout(400)
    check('Y9 renaming to an existing tank name refused', 'فيه وحدة اسمها' in toasts(A) and A.evaluate("() => !!daRawUnit('F1.S01T09')"))
    A.evaluate("daCloseModal('unit-edit')")
    # Y10 new-version notice
    A.evaluate('_verTag=null; daCheckUpdate()'); A.wait_for_timeout(600)
    os.utime(os.path.join(ROOT, 'index.html'), None); _t.sleep(1.2); os.utime(os.path.join(ROOT, 'index.html'), None)
    A.evaluate('daCheckUpdate()'); A.wait_for_timeout(800)
    check('Y10 "new version" notice appears after an update is published', A.is_visible('#upd-banner'))
    for c in (cA, cB): c.close()
    # Y5 database without the new column still works (full download, old way)
    sb2 = MockSB(); sb2.no_synced_at = True; sb2.add_user('owner@example.com','admin123',role='admin',uid='u-admin')
    sb2.tx['x1'] = {'id':'x1','farm_id':'farm-main','data':{'id':'x1','type':'feeding','date':'2026-09-01','unit':'F1.S01T01','kg':1,'ts':'2026-09-01T00:00:00Z'}}
    cC, C = new_page(p, sb2); login(C,'owner@example.com','admin123'); wait_sync(C)
    check('Y5 before the SQL is run: falls back to the old full download', C.evaluate('window._lastLoadMode') == 'legacy-full' and C.evaluate("() => getTX().some(t=>t.id==='x1')"), C.evaluate('window._lastLoadMode'))
    check('Y11 no JS errors', not A._errs and not B._errs and not C._errs, (A._errs + B._errs + C._errs)[:3])
    cC.close()
srv.shutdown()
for n, ok, d in RESULTS: print(('✅ ' if ok else '❌ ') + n + ('' if ok or not d else f'   → {d}'))
print(f"\n{sum(1 for _, o, _ in RESULTS if o)}/{len(RESULTS)} passed")
