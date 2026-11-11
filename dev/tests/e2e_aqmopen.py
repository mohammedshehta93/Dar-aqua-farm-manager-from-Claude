# The date an AquaManager opening balance stands at: chosen at import, or moved earlier afterwards, so days that were not
# in AquaManager yet (yesterday's feed) can be recorded.
import os, sys; os.environ['E2E_PORT'] = '8878'
FILE = '/mnt/user-data/uploads/2510.xls'
if not os.path.exists(FILE): print('SKIP: 2510.xls not available'); sys.exit()
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.on('dialog', lambda d: d.accept())
    pg.evaluate("show('farm-setup')"); pg.wait_for_timeout(300); pg.evaluate('daLayoutBuild()'); pg.wait_for_timeout(900)
    pg.set_input_files('#imp-file', FILE); pg.wait_for_timeout(1500)
    od = pg.evaluate("window._impParsed.stats.openDate")
    check('O1 the import preview asks "these numbers stand at the start of day …" (the file\'s date by default)', pg.evaluate("document.getElementById('imp-opendate') && document.getElementById('imp-opendate').value") == od)
    pg.click('#imp-go'); pg.wait_for_timeout(2500)
    u = pg.evaluate(f"RAW.find(r=>r.open && r.open.date==='{od}' && (daStateAt(r.unit, daToday())||{{}}).fish>0).unit"); prev = pg.evaluate(f"daAddDays('{od}',-1)")
    pg.evaluate(f"addTX({{id:'y1',type:'feeding',unit:'{u}',date:'{prev}',kg:2,source:'sheet',_skipValidation:true}})")
    pre = lambda: pg.evaluate(f"(daSimulateUnit('{u}', (daTxByUnit()['{u}']||[]).slice()).probs||[]).some(p=>p.key==='pre|y1')")
    check('O2 as before: the day before the opening date is refused (it would count twice)', pre())
    pg.evaluate("show('farm-setup',true)"); pg.wait_for_timeout(500)
    card = pg.inner_text('#aqo-card') if pg.query_selector('#aqo-card') else ''
    check('O3 Farm setup shows the last import\'s date and offers an earlier one', od in card and pg.evaluate("document.getElementById('aqo-date').value") == prev, card[:200])
    pg.click('#aqo-go'); pg.wait_for_timeout(1200)
    check('O4 moved: the last import\'s tanks now stand at the start of the day before (none left at the old date)', pg.evaluate(f"RAW.find(r=>r.unit==='{u}').open.date") == prev and not pg.evaluate(f"RAW.some(r=>r.open && /^AquaManager/.test(r.open.source||'') && r.open.date==='{od}')"))
    check('O5 … so that day\'s feed is accepted now (no longer a problem)', not pre())
    check('O6 the stock itself is unchanged (same fish as in the file)', pg.evaluate(f"(daStateAt('{u}', daToday())||{{}}).fish") == pg.evaluate(f"RAW.find(r=>r.unit==='{u}').open.fish"))
    # going back a week in the feed sheet: a banner offers to start the balance there; tanks stocked later are left alone
    wk = pg.evaluate(f"daAddDays('{od}',-7)"); fm = pg.evaluate(f"RAW.find(r=>r.unit==='{u}').farm")
    late = pg.evaluate(f"(() => {{ const r=RAW.find(r=>r.farm==='{fm}' && r.open && /^AquaManager/.test(r.open.source||'') && r.open.fish>0 && r.open.date>'{wk}' && r.unit!=='{u}'); r.startDate=daAddDays('{wk}',2); _dataVer++; return r.unit; }})()")
    late_od = pg.evaluate(f"RAW.find(r=>r.unit==='{late}').open.date")
    pg.evaluate(f"window._fs={{farm:'{fm}',date:'{wk}'}}; show('feed-sheet')"); pg.wait_for_timeout(500)
    check('O8 a past day before the balance: the sheet itself offers "↩️ start the balance from that day"', pg.evaluate("!!document.getElementById('fs-aqmback')") and wk in pg.inner_text('#fs-aqmback'))
    pg.click('#fs-aqmback-go'); pg.wait_for_timeout(1500)
    check('O9 the tanks that had fish then now start at that day', pg.evaluate(f"RAW.find(r=>r.unit==='{u}').open.date") == wk)
    check('O10 a tank stocked after that day is left alone (it did not exist then)', pg.evaluate(f"RAW.find(r=>r.unit==='{late}').open.date") == late_od)
    rows = pg.evaluate("Object.fromEntries((window._fs.rows||[]).map(r=>[r.unit, r.fish]))")
    check('O11 the sheet that day: existing tanks open with fish, the later one empty', (rows.get(u) or 0) > 0 and not (rows.get(late) or 0), (rows.get(u), rows.get(late)))
    check('O12 the banner is gone (nothing left to move for that day)', not pg.evaluate("!!document.getElementById('fs-aqmback')"))
    check('O7 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
