# Feeding → AquaManager: names learned from the farm's AquaManager Excel, the day's rows in AquaManager's 8-column paste format.
import os, sys; os.environ['E2E_PORT'] = '8824'
sys.path.insert(0, os.path.dirname(__file__))
import harness
harness.DEFAULT_UNITS[:] = [('F1.S01T01', 500, 300), ('F1.S01T02', 500, 300), ('F1.S06T01', 500, 20), ('F2.S16T01', 400, 500), ('F2.S16T02', 400, 500)]
from harness import *
XLS = '/mnt/user-data/uploads/2.xls'
if not os.path.exists(XLS): print('SKIP: owner file not available'); sys.exit()
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("localStorage.setItem(DA_FS_MODE_KEY, JSON.stringify({}))")
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet')"); pg.wait_for_timeout(300)
    ix = pg.evaluate("Object.fromEntries(window._fs.rows.filter(r=>r.i!==undefined).map(r=>[r.unit,r.i]))")
    pg.fill(f"#fs-{ix['F1.S01T01']}-m0", '4.8'); pg.fill(f"#fs-{ix['F1.S01T01']}-sz", '3')
    pg.fill(f"#fs-{ix['F1.S01T02']}-m0", '4.4'); pg.fill(f"#fs-{ix['F1.S01T02']}-sz", '3')
    pg.fill(f"#fs-{ix['F1.S06T01']}-m0", '1.2'); pg.fill(f"#fs-{ix['F1.S06T01']}-sz", '1'); pg.click('#fs-save'); pg.wait_for_timeout(500)
    pg.click('#fs-aqx'); pg.wait_for_timeout(200)
    check('X1 first time: asks for the AquaManager feeding Excel to learn the names', pg.evaluate("!!document.getElementById('aqx-learn') && !document.getElementById('aqx-copy')") and 'ارفع ملف علف الأكوامانجر' in content(pg))
    with pg.expect_file_chooser() as fc: pg.click('#aqx-learn')
    fc.value.set_files(XLS); pg.wait_for_timeout(1200)
    c = pg.evaluate("daAqxCfg()")
    check('X2 learned: AquaManager unit names (section 16 written with a dot), stores, feed names per pellet size', c['units'].get('F2.S16T01') == 'F2.S16.T01' and c['store'] == {'F1': 'Fish House 1', 'F2': 'Fish House 2'}
          and c['feed']['F1'] == {'1': 'Maram 40% cp 1mm', '2': 'Maram 36% cp 2mm', '3': 'Maram 36% cp 3mm'} and 'ARASKO 44% cp POWDER' in c['feeds'], (c.get('store'), c.get('feed'), len(c.get('feeds', []))))
    rows = pg.evaluate("daAqxRows('F1', window._fs.date).rows")
    check('X3 the day in AquaManager\'s 8 columns: Unit / Batch / Store / Feed / Feed Batch Code / Qty / Feeder / Feeding Method',
          rows == [['F1.S01T01', '', 'Fish House 1', 'Maram 36% cp 3mm', '', 4.8, '', ''], ['F1.S01T02', '', 'Fish House 1', 'Maram 36% cp 3mm', '', 4.4, '', ''], ['F1.S06T01', '', 'Fish House 1', 'Maram 40% cp 1mm', '', 1.2, '', '']], rows)
    pg.click('#aqx-copy'); pg.wait_for_timeout(300)
    clip = pg.evaluate("navigator.clipboard.readText()")
    check('X4 copied as an Excel-style range with the header AquaManager checks', clip.split('\r\n')[0] == 'Unit\tBatch\tStore\tFeed\tFeed Batch Code\tQty\tFeeder\tFeeding Method' and clip.split('\r\n')[1].split('\t')[0] == 'F1.S01T01' and len(clip.split('\r\n')) == 4, clip[:200])
    with pg.expect_download() as dl: pg.evaluate("daAqxExcel()")
    check('X5 or as an Excel file', dl.value.suggested_filename.startswith('AquaManager_Feeding_F1_'), dl.value.suggested_filename)
    check('X6 names are stored in a synced key (learned once for every device)', pg.evaluate("daIsSyncedKey(DA_AQX_KEY)"))
    check('X7 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
