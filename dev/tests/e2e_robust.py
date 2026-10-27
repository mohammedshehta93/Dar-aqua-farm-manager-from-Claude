import os; os.environ['E2E_PORT'] = '8793'
from harness import *
def wait_sync(pg): pg.wait_for_function('() => !!window._cloudSyncDone', timeout=20000); pg.wait_for_timeout(300)
with sync_playwright() as p:
    harness_browser[0] = p.chromium.launch()
    sb = MockSB(); sb.add_user('owner@example.com','admin123',role='admin',uid='u-admin')
    cA, A = new_page(p, sb); login(A,'owner@example.com','admin123'); wait_sync(A)
    A.evaluate("addTX({id:'zz1',type:'feeding',date:daToday(),unit:'F1.S01T01',kg:1,_skipValidation:true})"); A.wait_for_timeout(600)
    cB, B = new_page(p, sb); login(B,'owner@example.com','admin123'); wait_sync(B)
    check('R0 device B has the record', B.evaluate("() => getTX().some(t=>t.id==='zz1')"))
    A.evaluate("deleteTX('zz1')"); A.wait_for_timeout(700)
    check('R1 delete leaves a tombstone in the cloud', sb.tx['zz1']['data'].get('deleted') is True)
    B.evaluate("localStorage.setItem('daracqua_last_sync', new Date(Date.now()-60000).toISOString()); daRealtimePull()"); B.wait_for_timeout(800)
    check('R1 open device B drops it on the next sync', not B.evaluate("() => getTX().some(t=>t.id==='zz1')"))
    # device C was offline and still holds the record
    cC, C = new_page(p, sb); C.goto(BASE); C.wait_for_timeout(300)
    login(C,'owner@example.com','admin123'); wait_sync(C)
    C.evaluate("() => { const a=getTX(); a.push({id:'zz1',type:'feeding',date:daToday(),unit:'F1.S01T01',kg:1,ts:'2026-01-01T00:00:00Z'}); daUnmarkDead('zz1'); saveTX(a); }")
    C.evaluate("_cloudStarted=false; startCloudSync()"); C.wait_for_timeout(1500)
    check('R2 a stale device cannot resurrect a deleted record', sb.tx['zz1']['data'].get('deleted') is True and not C.evaluate("() => getTX().some(t=>t.id==='zz1')"))
    A.evaluate("addTX({id:'zz1',type:'feeding',date:daToday(),unit:'F1.S01T01',kg:2,_skipValidation:true})"); A.wait_for_timeout(700)
    check('R3 re-entering the same id later works (revived on purpose)', sb.tx['zz1']['data'].get('deleted') is not True and sb.tx['zz1']['data'].get('kg') == 2)
    # R4 a big batch from one device reaches the other completely
    A.evaluate("""() => { const a=[]; for(let i=0;i<1200;i++) a.push({id:'bulk'+i,type:'feeding',date:daAddDays(daToday(),-(i%7)),unit:'F1.S01T0'+(1+i%3),kg:0.5,ts:new Date(Date.now()+i).toISOString()}); const all=getTX().concat(a); saveTX(all); return daUploadTxBatch(a); }"""); A.wait_for_timeout(1500)
    B.evaluate("localStorage.setItem('daracqua_last_sync', new Date(Date.now()-60000).toISOString()); daRealtimePull()"); B.wait_for_timeout(2000)
    nb = B.evaluate("() => getTX().filter(t=>String(t.id).startsWith('bulk')).length")
    check('R4 another device receives ALL 1,200 new rows (was capped at 500)', nb == 1200, nb)
    # R7 caches never go stale
    f0 = A.evaluate("() => _txLiveRows().find(r=>r.unit==='F1.S01T01').fishNo")
    A.evaluate("addTX({id:'mm1',type:'mortality',date:daToday(),unit:'F1.S01T01',count:5,_skipValidation:true})")
    f1 = A.evaluate("() => _txLiveRows().find(r=>r.unit==='F1.S01T01').fishNo")
    A.evaluate("() => { const u=daRawUnit('F1.S01T02'); u.fishNo += 10; daPersistUnitsLocal(); }")
    f2 = A.evaluate("() => _txLiveRows().find(r=>r.unit==='F1.S01T02').fishNo - daRawUnit('F1.S01T02').fishNo")
    check('R7 live numbers update instantly after entries and unit edits', f1 == f0 - 5 and f2 == 0, (f0, f1, f2))
    for c in (cA, cB, cC): c.close()
    # R5 local calendar day
    ctx = harness_browser[0].new_context(timezone_id='Asia/Bahrain'); pg = ctx.new_page(); pg._errs = []
    pg.route('**/*', make_handler(sb)); pg.clock.set_fixed_time('2026-10-26T01:30:00+03:00'); pg.goto(BASE); pg.wait_for_timeout(400)
    login(pg,'owner@example.com','admin123'); pg.wait_for_timeout(800)
    check('R5 at 01:30 Bahrain time the app says 26th (was 25th)', pg.evaluate('daToday()') == '2026-10-26' and pg.evaluate("daYmd(new Date())") == '2026-10-26')
    ctx.close()
srv.shutdown()
for n, ok, d in RESULTS: print(('✅ ' if ok else '❌ ') + n + ('' if ok or not d else f'   → {d}'))
print(f"\n{sum(1 for _, o, _ in RESULTS if o)}/{len(RESULTS)} passed")
