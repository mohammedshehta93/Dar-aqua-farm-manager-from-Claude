import os, sys, json; os.environ['E2E_PORT'] = '8894'; sys.path.insert(0, 'dev/tests')
import harness
harness.DEFAULT_UNITS[:] = [('F1.S01T01', 1000, 100), ('F1.S01T02', 1000, 100), ('F1.S01T03', 1000, 100), ('F1.S01T04', 0, 0)]
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    D = pg.evaluate("daAddDays(daToday(),-5)")
    # T01 → T04 all fish on D; T02 harvested fully on D
    pg.evaluate(f"""() => {{ const D='{D}';
      addTX({{id:'to',type:'transfer_out',date:D,unit:'F1.S01T01',fishNo:1000,avgWt:100,txGroup:'g',_skipValidation:true}});
      addTX({{id:'ti',type:'transfer_in',date:D,unit:'F1.S01T04',fishNo:1000,avgWt:100,txGroup:'g',_skipValidation:true}});
      addTX({{id:'h',type:'harvesting',date:D,unit:'F1.S01T02',fishNo:1000,avgWt:100,weight:100,_skipValidation:true}}); _dataVer++; }}""")
    rows = lambda d: pg.evaluate(f"Object.fromEntries(daFsRows('F1','{d}').map(r=>[r.unit.slice(-3), r.fish]))")
    for lbl, d in [('D-1', pg.evaluate(f"daAddDays('{D}',-1)")), ('D (transfer/harvest day)', D), ('D+1', pg.evaluate(f"daAddDays('{D}',1)"))]:
        print(lbl, rows(d))
    # feed + dead on D for T01 (fed in the morning, before the transfer) and for T02 (before the harvest)
    pg.evaluate(f"""() => {{ addTX({{id:'f1',type:'feeding',unit:'F1.S01T01',date:'{D}',kg:3,source:'sheet',_skipValidation:true}}); addTX({{id:'m1',type:'mortality',unit:'F1.S01T01',date:'{D}',count:5,source:'sheet',_skipValidation:true}});
      addTX({{id:'f2',type:'feeding',unit:'F1.S01T02',date:'{D}',kg:3,source:'sheet',_skipValidation:true}}); _dataVer++; }}""")
    probs = lambda u: pg.evaluate(f"(daSimulateUnit('{u}', (daTxByUnit()['{u}']||[]).slice()).probs||[]).map(p=>p.key.split('|')[0]+': '+p.msg)")
    print('problems T01:', probs('F1.S01T01')); print('problems T02:', probs('F1.S01T02'))
    # what the feed sheet does on day D when saving
    pg.evaluate(f"window._fs={{farm:'F1',date:'{D}'}}; show('feed-sheet')"); pg.wait_for_timeout(400)
    print('sheet D inputs disabled:', pg.evaluate("Object.fromEntries(window._fs.rows.filter(r=>r.i!==undefined).map(r=>[r.unit.slice(-3), document.getElementById('fs-'+r.i+'-m0').disabled]))"))
