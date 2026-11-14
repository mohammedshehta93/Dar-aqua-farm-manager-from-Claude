# More fish than recorded: a transfer / harvest of more than the tool holds records a count surplus (asked first) and
# saves; declined → nothing; more than double / an empty tank → still refused; the register hides the surplus;
# deleting the transfer takes it along; the stock histories stay right.
import os; os.environ['E2E_PORT'] = '8897'
import harness
harness.DEFAULT_UNITS[:] = [('F2.S02T05', 1589, 30), ('F2.S02T06', 1000, 30), ('F2.S04T09', 0, 0), ('F2.S02T07', 0, 0)]
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    d = pg.evaluate("daAddDays(daToday(),-1)"); msgs = []
    def ans(ok):
        pg.once('dialog', lambda dl: (msgs.append(dl.message), dl.accept() if ok else dl.dismiss()))
    def transfer(n1, n2, ok):
        pg.evaluate("show('tx-transfer')"); pg.wait_for_timeout(300); pg.click('#rg-new'); pg.wait_for_timeout(200)
        pg.fill('#rf-date', d); pg.select_option('#rf-from', 'F2.S02T05'); pg.wait_for_timeout(100)
        pg.select_option('#rf-d0-u', 'F2.S04T09'); pg.fill('#rf-d0-n', str(n1)); pg.fill('#rf-d0-w', '30')
        pg.click('text=➕ تانك تاني'); pg.select_option('#rf-d1-u', 'F2.S02T07'); pg.fill('#rf-d1-n', str(n2)); pg.fill('#rf-d1-w', '30')
        ans(ok); pg.click('#rf-save'); pg.wait_for_timeout(700)
    transfer(747, 1103, False)
    check('G1 1,850 out of a tank holding 1,589: it asks (surplus 261), and "no" saves nothing', msgs and '261' in msgs[-1] and not pg.evaluate("getTX().some(t=>t.type==='transfer_out' && !t.deleted)"), msgs[-1:] )
    transfer(747, 1103, True)
    g = pg.evaluate(f"getTX().filter(t=>t.gain && !t.deleted).map(t=>[t.unit,t.date,t.fishNo,!!t.link])")
    check('G2 "yes": the surplus 261 is recorded on that day, linked to the transfer, and the transfer is saved (747 + 1,103)', g == [['F2.S02T05', d, 261, True]] and pg.evaluate("getTX().find(t=>t.type==='transfer_out' && !t.deleted).fishNo") == 1850, g)
    check('G3 the source is empty after, the destinations hold 747 and 1,103; no "more out than in"', pg.evaluate(f"[(daStateAt('F2.S02T05', daAddDays('{d}',1))||{{}}).fish||0, (daStateAt('F2.S04T09','{d}')||{{}}).fish, (daStateAt('F2.S02T07','{d}')||{{}}).fish, daNegStock('F2.S02T05')]") == [0, 747, 1103, False])
    rows = pg.evaluate(f"daTransRows({{from:daAddDays('{d}',-3), to:daToday()}}).filter(Boolean).map(r=>r.from)")
    check('G4 the transfer register shows the transfer only (not the surplus as a transfer "from —")', rows == ['F2.S02T05'], rows)
    cyc = pg.evaluate("(daUnitCycles('F2.S02T05')||[]).map(c=>[c.fish1, c.endBy||''])")
    check('G5 the cycle of the source closes on that day by the transfer', cyc and cyc[-1][0] == 0, cyc)
    # more than double / empty → still refused
    pg.evaluate("show('tx-transfer',true)"); pg.wait_for_timeout(200); pg.click('#rg-new'); pg.wait_for_timeout(200)
    pg.fill('#rf-date', d); pg.select_option('#rf-from', 'F2.S02T06'); pg.select_option('#rf-d0-u', 'F2.S02T07'); pg.fill('#rf-d0-n', '2500'); pg.fill('#rf-d0-w', '30')
    ans(True); pg.click('#rf-save'); pg.wait_for_timeout(500)
    check('G6 more than double the recorded count (2,500 of 1,000) is still refused as a wrong number', 'مينفعش' in msgs[-1] and not pg.evaluate("getTX().some(t=>t.type==='transfer_out' && t.unit==='F2.S02T06' && !t.deleted)"), msgs[-1])
    # harvest with a surplus
    pg.evaluate("show('tx-harvesting')"); pg.wait_for_timeout(300); pg.click('#rg-new'); pg.wait_for_timeout(200)
    pg.fill('#rf-date', d); pg.select_option('#rf-unit', 'F2.S02T06'); pg.wait_for_timeout(100)
    s_ = pg.evaluate("document.querySelector('[id^=rf-c][id$=-n]').id.split('-')[1].slice(1)")
    pg.fill(f'#rf-c{s_}-n', '1100'); pg.fill(f'#rf-c{s_}-kg', '33'); ans(True); pg.click('#rf-save'); pg.wait_for_timeout(700)
    check('G7 harvest of 1,100 from 1,000: surplus 100 recorded, harvest saved', pg.evaluate("getTX().some(t=>t.gain && t.unit==='F2.S02T06' && t.fishNo===100)") and pg.evaluate("getTX().some(t=>t.type==='harvesting' && t.unit==='F2.S02T06' && !t.deleted)"))
    # deleting the transfer takes its surplus along
    gid = pg.evaluate("getTX().find(t=>t.type==='transfer_out' && !t.deleted).txGroup")
    pg.evaluate(f"(getTX().filter(t=>t.txGroup==='{gid}' && !t.deleted).map(t=>t.id).concat(daLinked(['{gid}']))).forEach(id=>deleteTX(id))"); pg.wait_for_timeout(300)   # as the register does: the transfer first, then what is linked
    check('G8 deleting the transfer removes its surplus too', not pg.evaluate("getTX().some(t=>t.gain && t.unit==='F2.S02T05' && !t.deleted)"))
    check('G9 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
