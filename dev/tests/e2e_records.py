# Harvest & transfer registers: date range, totals, right-click new/edit/delete, multi-destination transfers, Excel.
import os; os.environ['E2E_PORT'] = '8819'
from harness import *
def ctx_pick(pg, sel, label):
    pg.click(sel, button='right'); pg.wait_for_timeout(100); pg.click(f'#da-ctx .ctx-i:has-text("{label}")'); pg.wait_for_timeout(300)

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('worker@example.com', 'work123', role='worker')
    ctx, pg = new_page(p, sb, )
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("addTX({id:'stb',type:'stocking',unit:'F1.S02T01',date:'2026-08-17',fishNo:0,avgWt:75,batch:'LOT-7',_skipValidation:true}); RAW.find(r=>r.unit==='F1.S02T01').batch='LOT-7'; _dataVer++")
    d = pg.evaluate("daAddDays(daToday(),-3)")
    pg.evaluate("window._rgtrans={}; farmFilter='F1'; show('tx-transfer')"); pg.wait_for_timeout(300)
    ctx_pick(pg, '#content .card:has(#rg-t)', 'سجل جديد')
    check('R1 right-click on the table → new record form', pg.evaluate("!!document.getElementById('rf-from')"))
    pg.fill('#rf-date', d); pg.select_option('#rf-from', 'F1.S02T01'); pg.wait_for_timeout(100)
    check('R2 form shows how many fish the source has that day', '881' in pg.inner_text('#rf-avail'), pg.inner_text('#rf-avail'))
    pg.select_option('#rf-d0-u', 'F1.S01T01'); pg.fill('#rf-d0-n', '300'); pg.fill('#rf-d0-w', '80'); pg.wait_for_timeout(100)
    ba = [pg.inner_text(f'#rf-d0-{k}') for k in ('fb', 'wb', 'fa', 'wa')]
    check('R2b destination before / after: 791 fish @275 g + 300 @80 g → 1,091 fish @221.38 g, flagged as a big size mix', ba[0] == '791' and ba[1] == '275.00' and ba[2] == '1,091' and ba[3].startswith('221.38') and '⚠️' in ba[3], ba)
    pg.click('text=➕ تانك تاني'); pg.select_option('#rf-d1-u', 'F1.S01T02'); pg.fill('#rf-d1-n', '200'); pg.fill('#rf-d1-w', '70')
    pg.click('#rf-save'); pg.wait_for_timeout(500)
    rows = pg.evaluate("window._rgtrans.rows.map(r=>({from:r.from,to:r.to,fish:r.fish,batch:r.batch,n:r.ids.length}))")
    check('R3 one record: 1 source → 2 destinations, -500 fish, shown like AquaManager', len(rows) == 1 and rows[0]['fish'] == 500 and 'F1.S01T01(300-80.00)' in rows[0]['to'] and 'F1.S01T02(200-70.00)' in rows[0]['to'] and rows[0]['n'] == 3, rows)
    ins = pg.evaluate("getTX().filter(t=>t.type==='transfer_in'&&t.date==='" + d + "').map(t=>t.batch)")
    check('R4 destinations carry the source batch (LTD continues across tanks)', ins == ['LOT-7', 'LOT-7'], ins)
    pg.evaluate("window._rgtrans={from:daToday()}; show('tx-transfer',true)"); pg.wait_for_timeout(200)
    pg.click('#rg-new'); pg.fill('#rf-date', pg.evaluate("daAddDays(daToday(),-40)")); pg.select_option('#rf-from', 'F1.S01T03'); pg.select_option('#rf-d0-u', 'F1.S02T02'); pg.fill('#rf-d0-n', '10'); pg.click('#rf-save'); pg.wait_for_timeout(400)
    check('R3b a record dated before the period widens it, so it never seems lost', pg.evaluate("window._rgtrans.from") == pg.evaluate("daAddDays(daToday(),-40)") and pg.evaluate("window._rgtrans.rows.length") == 2)
    pg.evaluate("(() => { const r=window._rgtrans.rows.find(x=>x.from==='F1.S01T03'); r.ids.forEach(id=>deleteTX(id)); window._rgtrans={}; show('tx-transfer',true); })()"); pg.wait_for_timeout(200)
    check('R4 stock moved in both engines', pg.evaluate("(_txLiveRows().find(r=>r.unit==='F1.S02T01')||{}).fishNo") == 381)
    # too many fish → refused
    pg.click('#rg-new'); pg.fill('#rf-date', d); pg.select_option('#rf-from', 'F1.S02T01'); pg.select_option('#rf-d0-u', 'F1.S01T03'); pg.fill('#rf-d0-n', '9999')
    msg = []; pg.once('dialog', lambda dl: (msg.append(dl.message), dl.accept())); pg.click('#rf-save'); pg.wait_for_timeout(300)
    check('R5 cannot transfer more fish than the tank has that day', msg and 'مينفعش' in msg[0] and len(pg.evaluate("window._rgtrans.rows")) == 1, msg)
    # edit via right-click on the row
    ctx_pick(pg, '#rg-t tbody tr[data-i="0"]', 'تعديل')
    check('R6 edit opens the record with its destinations', pg.input_value('#rf-d1-n') == '200')
    pg.fill('#rf-d1-n', '250'); pg.click('#rf-save'); pg.wait_for_timeout(400)
    rows = pg.evaluate("window._rgtrans.rows.map(r=>r.fish)")
    check('R6 edit replaces the record (no duplicate), 550 fish now', rows == [550] and pg.evaluate("getTX().filter(t=>t.type==='transfer_out'&&!t.deleted).length") == 1, rows)
    # harvest with adjustment
    pg.evaluate("window._rgharv={}; show('tx-harvesting')"); pg.wait_for_timeout(300)
    pg.click('#rg-new'); pg.fill('#rf-date', d); pg.select_option('#rf-unit', 'F1.S02T02'); u = 'F1.S02T02'
    idx = pg.evaluate("Object.fromEntries(daSizes().map((c,i)=>[c.n,i]))")
    s_, n_ = idx['صغير'], idx['طبيعي']
    pg.fill(f'#rf-c{s_}-n', '50'); pg.fill(f'#rf-c{s_}-kg', '23'); pg.fill(f'#rf-c{s_}-price', '1.5')
    pg.fill(f'#rf-c{n_}-n', '50'); pg.fill(f'#rf-c{n_}-kg', '25'); pg.fill(f'#rf-c{n_}-inv', '24.5'); pg.fill(f'#rf-c{n_}-price', '2'); pg.fill('#rf-adj', '3'); pg.wait_for_timeout(100)
    check('R7 sizes: totals 100 fish · 48 kg · avg 480 g · sale value (23×1.5 + 24.5 invoiced×2 = 83.5)', pg.inner_text('#rf-tn') == '100' and pg.inner_text('#rf-tkg') == '48.00' and pg.inner_text('#rf-tavg') == '480.00' and pg.inner_text('#rf-tval') == '83.50',
          [pg.inner_text(s) for s in ('#rf-tn', '#rf-tkg', '#rf-tavg', '#rf-tval')])
    check('R7 a size whose average is outside its range is marked (small at 460 g, limit 450)', pg.evaluate(f"document.querySelector('#rf-c{s_}-avg span').style.color") in ('var(--red)',), pg.evaluate(f"document.querySelector('#rf-c{s_}-avg').innerHTML"))
    pg.click('#rf-save'); pg.wait_for_timeout(400)
    hr = pg.evaluate("window._rgharv.rows")
    check('R8 harvest listed with sizes, adjustment and sale value; totals row', len(hr) == 1 and hr[0]['fish'] == 100 and hr[0]['kg'] == 48 and hr[0]['adj'] == 3 and hr[0]['value'] == 83.5 and 'صغير 50' in hr[0]['cats'] and 'AVG=480.00' in pg.inner_text('#rg-t tfoot'), hr)
    smp = pg.evaluate(f"getTX().filter(t=>t.type==='sampling'&&t.unit==='{u}'&&t.date==='{d}'&&!t.deleted).map(t=>[t.avgWt,t.link])")
    check('R8 Is Sampling: the harvest average (480 g) becomes a weight sample, linked to the harvest', len(smp) == 1 and smp[0][0] == 480 and smp[0][1] == hr[0]['id'], smp)
    check('R8 adjustment stored as its own type (not mortality)', pg.evaluate(f"getTX().some(t=>t.type==='adjustment'&&t.unit==='{u}'&&t.count===3)") and not pg.evaluate(f"getTX().some(t=>t.type==='mortality'&&t.unit==='{u}'&&t.date==='{d}')"))
    # date range
    pg.evaluate(f"window._rgharv.from=daAddDays('{d}',1); show('tx-harvesting',true)"); pg.wait_for_timeout(200)
    check('R9 date range filters (record before From hidden)', pg.evaluate("window._rgharv.rows.length") == 0)
    pg.evaluate(f"window._rgharv.from='{d}'; show('tx-harvesting',true)"); pg.wait_for_timeout(200)
    # delete via menu
    ctx_pick(pg, '#rg-t tbody tr[data-i="0"]', 'تعديل'); pg.fill(f'#rf-c{n_}-n', '60'); pg.fill(f'#rf-c{n_}-kg', '30'); pg.click('#rf-save'); pg.wait_for_timeout(400)
    linked = pg.evaluate(f"getTX().filter(t=>t.unit==='{u}'&&t.date==='{d}'&&!t.deleted&&(t.type==='sampling'||t.type==='adjustment'||t.type==='harvesting')).map(t=>t.type).sort()")
    check('R9b edit replaces the harvest AND its sample/adjustment (no orphans)', linked == ['adjustment', 'harvesting', 'sampling'], linked)
    pg.once('dialog', lambda dl: dl.accept()); ctx_pick(pg, '#rg-t tbody tr[data-i="0"]', 'حذف')
    check('R10 delete from the right-click menu removes the linked sample and adjustment too', pg.evaluate("window._rgharv.rows.length") == 0 and pg.evaluate(f"!getTX().some(t=>t.unit==='{u}'&&t.date==='{d}'&&!t.deleted&&(t.type==='sampling'||t.type==='adjustment'))"))
    # close unit with the harvest
    pg.click('#rg-new'); pg.fill('#rf-date', d); pg.select_option('#rf-unit', 'F1.S02T02'); pg.fill('#rf-c0-n', '690'); pg.fill('#rf-c0-kg', '270'); pg.check('#rf-close'); pg.wait_for_timeout(100)
    info = pg.inner_text('#rf-closeinfo'); pg.click('#rf-save'); pg.wait_for_timeout(400)
    check('R10b Close Unit: the remainder (704 − 690 = 14) is saved as an adjustment and the tank is empty', '14' in info and pg.evaluate("(_txLiveRows().find(r=>r.unit==='F1.S02T02')||{}).fishNo") == 0 and pg.evaluate("getTX().some(t=>t.type==='adjustment'&&t.unit==='F1.S02T02'&&t.count===14&&t.source==='close')"), info)
    with pg.expect_download() as dl:
        pg.evaluate("window._rgtrans={from:'" + d + "'}; show('tx-transfer'); daRegExcel('trans')")
    check('R11 Excel export of the list', dl.value.suggested_filename.startswith('Transfer_'), dl.value.suggested_filename)
    check('R12 no page errors', not pg._errs, pg._errs)
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(500)
    login(pg, 'worker@example.com', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate(f"window._rgtrans={{from:'{d}'}}; farmFilter='F1'; show('tx-transfer')"); pg.wait_for_timeout(300)
    if pg.evaluate("document.querySelectorAll('#rg-t tbody tr').length"):
        pg.click('#rg-t tbody tr[data-i="0"]', button='right'); pg.wait_for_timeout(100)
        check('R13 worker: edit/delete greyed out in the menu', pg.evaluate("[...document.querySelectorAll('#da-ctx .ctx-i')].filter(x=>/تعديل|حذف/.test(x.textContent)).every(x=>x.style.cursor.startsWith('default'))"))
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
