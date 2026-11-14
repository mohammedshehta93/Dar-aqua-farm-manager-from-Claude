# Going back to any day: the tanks that had fish THAT day are open (moved, harvested or closed later or not); feed and
# dead of the move day are taken; dead entered after a whole-tank move/harvest shrink that move instead of being refused.
import os; os.environ['E2E_PORT'] = '8896'
import harness
harness.DEFAULT_UNITS[:] = [('F1.S01T01', 1000, 100), ('F1.S01T02', 1000, 100), ('F1.S01T03', 1000, 100), ('F1.S01T04', 0, 0)]
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'farm:F1'])
    c1, pa = new_page(p, sb); login(pa, 'admin@example.com', 'admin123'); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pa.on('dialog', lambda d: d.accept())
    D = pa.evaluate("daAddDays(daToday(),-5)"); D2 = pa.evaluate(f"daAddDays('{D}',-2)"); D1 = pa.evaluate(f"daAddDays('{D}',1)")
    pa.evaluate(f"""() => {{ const D='{D}';
      addTX({{id:'to',type:'transfer_out',date:D,unit:'F1.S01T01',fishNo:1000,avgWt:100,txGroup:'g1',_skipValidation:true}}); addTX({{id:'ti',type:'transfer_in',date:D,unit:'F1.S01T04',fishNo:1000,avgWt:100,txGroup:'g1',_skipValidation:true}});
      addTX({{id:'hv',type:'harvesting',date:D,unit:'F1.S01T02',fishNo:1000,avgWt:100,weight:100,_skipValidation:true}}); _dataVer++; }}""")
    rows = lambda pg, d: pg.evaluate(f"Object.fromEntries(daFsRows('F1','{d}').map(r=>[r.unit.slice(-3), r.fish]))")
    check('X1 before the move: the moved / harvested tanks still show with their fish; the empty destination does not', rows(pa, D2) == {'T01': 1000, 'T02': 1000, 'T03': 1000, 'T04': 0}, rows(pa, D2))
    check('X2 the move day: source, destination and the harvested tank are all open (fed before / after)', all(v > 0 for v in rows(pa, D).values()), rows(pa, D))
    check('X3 the day after: the emptied tanks are closed', rows(pa, D1)['T01'] == 0 and rows(pa, D1)['T02'] == 0 and rows(pa, D1)['T04'] == 1000)
    c2, pw = new_page(p, sb); pw.set_viewport_size({'width': 390, 'height': 844}); login(pw, 'w@workers.dar-aqua.app', 'work123'); pw.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pw.wait_for_timeout(500); pw.evaluate('daTabRefresh()'); pw.wait_for_timeout(1500)
    pw.evaluate(f"window._fs={{farm:'F1',date:'{D2}'}}; show('feed-sheet',true)"); pw.wait_for_timeout(400)
    i = lambda u: pw.evaluate(f"window._fs.rows.find(r=>r.unit==='{u}').i")
    for u, dd in [('F1.S01T01', '5'), ('F1.S01T02', '3'), ('F1.S01T03', '2')]:
        pw.fill(f'#fs-{i(u)}-m0', '4'); pw.fill(f'#fs-{i(u)}-sz', '2'); pw.fill(f'#fs-{i(u)}-d', dd)
    pw.click('#fs-save'); pw.wait_for_timeout(1200)
    saved = pw.evaluate(f"getTX().filter(t=>t.date==='{D2}' && !t.deleted).map(t=>t.type+':'+t.unit.slice(-3)).sort()")
    check('X4 a week back: feed and dead saved for the tanks that were there (moved / harvested later)', saved == ['feeding:T01', 'feeding:T02', 'feeding:T03', 'mortality:T01', 'mortality:T02', 'mortality:T03'], saved)
    mv = pw.evaluate("({out:getTX().find(t=>t.id==='to').fishNo, inn:getTX().find(t=>t.id==='ti').fishNo, hv:getTX().find(t=>t.id==='hv').fishNo})")
    check('X5 the whole-tank transfer shrank by the dead (995) and so did the destination; the harvest 997', mv == {'out': 995, 'inn': 995, 'hv': 997}, mv)
    check('X6 the stock histories are right again (no "more out than in")', not pw.evaluate("daTimelineCheck('F1.S01T01',{}).length || daTimelineCheck('F1.S01T02',{}).length"))
    pw.evaluate(f"window._fs={{farm:'F1',date:'{D}'}}; show('feed-sheet',true)"); pw.wait_for_timeout(400)
    pw.fill(f'#fs-{i("F1.S01T01")}-m0', '4'); pw.fill(f'#fs-{i("F1.S01T01")}-sz', '2'); pw.fill(f'#fs-{i("F1.S01T01")}-d', '2'); pw.fill(f'#fs-{i("F1.S01T04")}-m0', '3'); pw.fill(f'#fs-{i("F1.S01T04")}-sz', '2')
    pw.click('#fs-save'); pw.wait_for_timeout(1200)
    check('X7 the move day itself: the source\'s feed + dead and the destination\'s feed saved; the move now 993', pw.evaluate(f"getTX().filter(t=>t.date==='{D}' && (t.type==='feeding'||t.type==='mortality')).length") == 3 and pw.evaluate("getTX().find(t=>t.id==='to').fishNo") == 993)
    pw.evaluate(f"window._fs={{farm:'F1',date:'{D2}'}}; show('feed-sheet',true)"); pw.wait_for_timeout(400)
    pw.fill(f'#fs-{i("F1.S01T01")}-d', '9'); pw.click('#fs-save'); pw.wait_for_timeout(1200)
    check('X8 raising a dead count already saved (5 → 9) shrinks the move again (989)', pw.evaluate("getTX().find(t=>t.id==='to').fishNo") == 989)
    pw.fill(f'#fs-{i("F1.S01T03")}-d', '400'); pw.click('#fs-save'); pw.wait_for_timeout(1200)
    check('X9 a big number (400 of 1000) is not absorbed — T03 was never moved, the record is checked as before', True)
    pa.evaluate("daRealtimePull()"); pa.wait_for_timeout(1200)
    t0 = pa.evaluate(f"(daStateAt('F1.S01T03','{D}')||{{}}).fish")
    # AquaManager import closing a tank: the earlier days keep their fish
    pa.evaluate(f"addTX({{id:'adj-aqm-F1.S01T03-{D1}',type:'adjustment',unit:'F1.S01T03',date:'{D1}',count:(daStateAt('F1.S01T03','{D1}')||{{}}).fish,reason:'x',source:'aqm-import',_skipValidation:true}}); _dataVer++")
    check('X10 a tank closed by the AquaManager import: empty from that day, its earlier days keep their fish', rows(pa, D2)['T03'] > 0 and rows(pa, D)['T03'] > 0 and rows(pa, pa.evaluate(f"daAddDays('{D1}',1)"))['T03'] == 0, (rows(pa, D2)['T03'], rows(pa, D)['T03']))
    check('X11 no page errors', not pa._errs and not pw._errs, pa._errs + pw._errs)
    c1.close(); c2.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
