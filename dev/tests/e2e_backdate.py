import os; os.environ['E2E_PORT'] = '8790'
from harness import *
def wait_sync(pg): pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(300)
with sync_playwright() as p:
    harness_browser[0] = p.chromium.launch()
    sb = MockSB(); sb.units.clear(); sb.add_user('owner@example.com','admin123',role='admin',uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg,'owner@example.com','admin123'); wait_sync(pg)
    pg.evaluate("""() => { ['T1.S01T01','T1.S01T02','T1.S01T03'].forEach((u,i) => RAW.push({unit:u, farm:'T1', section:'T1.S01', startDate:daAddDays(daToday(),-30),
        fishNo: i===2 ? 0 : 1000, avgWt: 100, startWt:100, biomass: i===2 ? 0 : 100, volume:10})); _valCache={t:0,map:{}}; }""")
    D = lambda n: pg.evaluate(f"daAddDays(daToday(),{n})")
    def add(tx):
        if tx.get('type') in ('feeding', 'mortality'): tx = dict(tx, source='sheet')   # feeding + dead counts come from the feed sheet only
        pg.evaluate("t => addTX(t)", tx); pg.wait_for_timeout(250)
        modal = pg.inner_text('#tx-review-modal') if pg.is_visible('#tx-review-modal') else ''
        if modal: pg.evaluate('txReviewClose()')
        saved = pg.evaluate("id => getTX().some(t => t.id === id)", tx['id'])
        return saved, modal
    live = lambda u, k: pg.evaluate(f"() => _txLiveRows().find(r => r.unit === '{u}').{k}")
    # B1 order by date, not entry time
    add({'id':'s5','type':'sampling','date':D(-5),'unit':'T1.S01T01','avgWt':150}); add({'id':'s10','type':'sampling','date':D(-10),'unit':'T1.S01T01','avgWt':120})
    check('B1 older sample entered later does not overwrite newer weight', live('T1.S01T01','avgWt') == 150, live('T1.S01T01','avgWt'))
    # B2 harvest removes fish
    add({'id':'h3','type':'harvesting','date':D(-3),'unit':'T1.S01T01','fishNo':100,'kg':15})
    check('B2 harvest now reduces the tank (1000 → 900)', live('T1.S01T01','fishNo') == 900, live('T1.S01T01','fishNo'))
    # your scenario on T1.S01T02 (1000 fish, stocked day −30)
    ok, _ = add({'id':'f20','type':'feeding','date':D(-20),'unit':'T1.S01T02','kg':5})
    check('B3 feeding on day −20 saved', ok)
    ok, m = add({'id':'hfull','type':'harvesting','date':D(-25),'unit':'T1.S01T02','fishNo':1000,'kg':100})
    check('B4 FULL harvest on day −25 refused: feeding exists on day −20', not ok and 'فاضي' in m and D(-20) in m, m[:200])
    ok, _ = add({'id':'hpart','type':'harvesting','date':D(-25),'unit':'T1.S01T02','fishNo':400,'kg':40})
    check('B5 partial harvest (400) on day −25 allowed', ok)
    ok, m = add({'id':'m22','type':'mortality','date':D(-22),'unit':'T1.S01T02','count':700})
    check('B6 mortality 700 on day −22 refused (only 600 left then)', not ok and 'أكبر من السمك الموجود' in m, m[:200])
    pg.evaluate("""() => { addTX({id:'to12',type:'transfer_out',date:daAddDays(daToday(),-12),unit:'T1.S01T02',fishNo:600,avgWt:100,txGroup:'g1'});
                           addTX({id:'ti12',type:'transfer_in',date:daAddDays(daToday(),-12),unit:'T1.S01T03',fishNo:600,avgWt:100,txGroup:'g1'}); }""")
    pg.wait_for_timeout(300)
    check('B7a full transfer out after the last feeding is fine', pg.evaluate("() => getTX().some(t=>t.id==='to12') && getTX().some(t=>t.id==='ti12')"))
    ok, m = add({'id':'f10','type':'feeding','date':D(-10),'unit':'T1.S01T02','kg':5})
    check('B7b feeding after the tank was emptied (day −10) refused', not ok and 'فاضي' in m and 'نقل خارج' in m, m[:200])
    ok, _ = add({'id':'rs11','type':'transfer_in','date':D(-11),'unit':'T1.S01T02','fishNo':300,'avgWt':80})
    ok2, _ = add({'id':'f10b','type':'feeding','date':D(-10),'unit':'T1.S01T02','kg':0.5})
    check('B7c after restocking on day −11, feeding on day −10 allowed', ok and ok2)
    ok, m = add({'id':'f35','type':'feeding','date':D(-35),'unit':'T1.S01T02','kg':5})
    check('B8 entry before the stocking date refused', not ok and 'قبل' in m, m[:160])
    ok, _ = add({'id':'wq35','type':'water_quality','date':D(-35),'unit':'T1.S01T02','temp':27,'do':6})
    check('B9 water measurement on any date allowed', ok)
    pg.evaluate("""() => { addTX({id:'to9',type:'transfer_out',date:daAddDays(daToday(),-9),unit:'T1.S01T02',fishNo:5000,avgWt:100,txGroup:'g2'});
                           addTX({id:'ti9',type:'transfer_in',date:daAddDays(daToday(),-9),unit:'T1.S01T01',fishNo:5000,avgWt:100,txGroup:'g2'}); }""")
    pg.wait_for_timeout(300); pg.evaluate('txReviewClose()')
    check('B10 impossible transfer: BOTH legs refused (no fish appear from nowhere)', pg.evaluate("() => !getTX().some(t=>t.id==='to9'||t.id==='ti9')"))
    # B11 edit that breaks the record
    pg.evaluate("window._trUnit='T1.S01T02'; show('traceability')"); pg.wait_for_timeout(300); hook_toasts(pg)
    pg.click('button[onclick^="daOpenTxEditor"][data-id="hpart"]'); pg.wait_for_timeout(200)
    pg.fill('#te-n2', '1000'); pg.fill('#te-why', 'تجربة'); pg.click('#te-save'); pg.wait_for_timeout(300)
    check('B11 editing partial harvest into a full one is refused', pg.evaluate("() => getTX().find(t=>t.id==='hpart').fishNo") == 400 and 'فاضي' in toasts(pg), toasts(pg))
    pg.evaluate("daCloseModal('tx-edit')")
    pg.evaluate("deleteTX('rs11')"); pg.wait_for_timeout(200)
    check('B12 deleting the restock that later feeding depends on is refused', pg.evaluate("() => getTX().some(t=>t.id==='rs11')") and 'مينفعش تتمسح' in toasts(pg))
    # B14 old mess never blocks unrelated new work
    pg.evaluate("addTX({id:'legacy',type:'feeding',date:daAddDays(daToday(),-30),unit:'T1.S01T03',kg:2,_skipValidation:true})")
    ok, _ = add({'id':'new1','type':'feeding','date':D(-1),'unit':'T1.S01T03','kg':3})
    check('B14 an old inconsistency does not block new valid entries', ok)
    # B13 imported tank: nothing before its opening balance
    pg.evaluate("show('farm-setup')"); pg.wait_for_timeout(300)
    pg.set_input_files('#imp-file', '/mnt/user-data/uploads/2510.xls'); pg.wait_for_timeout(1200); pg.click('#imp-go'); pg.wait_for_timeout(2000)
    od = pg.evaluate("() => daUnitOpenDate('F2.S06T01')")
    ok, m = add({'id':'pre','type':'feeding','date':pg.evaluate(f"daAddDays('{od}',-1)"),'unit':'F2.S06T01','kg':5})
    check('B13 imported tank: entries before the opening balance refused (no double counting)', not ok and 'الرصيد الافتتاحي' in m, m[:160])
    # feeding is entered from the feed sheet only (2026-10-29): the sheet must refuse a day before the opening balance
    pg.evaluate(f"window._fs={{farm:'F2',date:daAddDays('{od}',-1)}}; show('feed-sheet')"); pg.wait_for_timeout(400)
    ri = pg.evaluate("() => (window._fs.rows.find(r=>r.unit==='F2.S06T01')||{}).i")
    pg.fill(f'#fs-{ri}-m0', '5'); pg.fill(f'#fs-{ri}-sz', '3')
    dl = []; pg.once('dialog', lambda d: (dl.append(d.message), d.accept())); pg.click('#fs-save'); pg.wait_for_timeout(600)
    check('B13 feed sheet refuses a day before the opening balance', dl and 'الرصيد الافتتاحي' in dl[0] and not pg.evaluate(f"getTX().some(t=>t.id==='fs-F2.S06T01-'+daAddDays('{od}',-1))"), dl)
    check('B15 no JS errors', not pg._errs, pg._errs[:3])
    ctx.close()
srv.shutdown()
for n, ok, d in RESULTS: print(('✅ ' if ok else '❌ ') + n + ('' if ok or not d else f'   → {d}'))
print(f"\n{sum(1 for _, o, _ in RESULTS if o)}/{len(RESULTS)} passed")
