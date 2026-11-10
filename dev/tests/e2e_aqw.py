# Testing log → AquaManager Site Measurements: names learned from the farm's export (588.xls), section inside the parameter
# name, one temperature per house (average of the sections).
import os, sys; os.environ['E2E_PORT'] = '8825'
sys.path.insert(0, os.path.dirname(__file__))
import harness
harness.DEFAULT_UNITS[:] = [(f'F1.S{s:02d}T01', 500, 300) for s in range(1, 13)] + [('F2.S01T01', 500, 100), ('F2.S16T01', 400, 500)]
from harness import *
XLS = '/mnt/user-data/uploads/588.xls'
if not os.path.exists(XLS): print('SKIP: owner file not available'); sys.exit()
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    parsed = pg.evaluate("['Oxygen FH2. S01','PH F1.S01','TOTAL AMMONIA FH2 .S16','Nitrite(NO2) FH1.S03','Temperature FH1','Temperature Nursery'].map(daAqwParse)")
    check('W1 AquaManager names read despite their spelling (F1/FH1, spaces), temperature per house, other houses ignored',
          parsed == [{'kind': 'do', 'farm': 'F2', 'sec': 1}, {'kind': 'ph', 'farm': 'F1', 'sec': 1}, {'kind': 'tan', 'farm': 'F2', 'sec': 16}, {'kind': 'no2', 'farm': 'F1', 'sec': 3}, {'kind': 'temp', 'farm': 'F1'}, None], parsed)
    pg.evaluate("window._wqs={farm:'F1'}; show('wq-sheet')"); pg.wait_for_timeout(300)
    pg.fill('#wqs-0-temp', '29'); pg.fill('#wqs-0-ph', '7'); pg.fill('#wqs-0-do', '6.5'); pg.fill('#wqs-1-temp', '30'); pg.fill('#wqs-1-ph', '7.1'); pg.fill('#wqs-1-do', '7')
    pg.click('#wqs-save'); pg.wait_for_timeout(500)
    pg.evaluate("addTX({id:'wn1',type:'water_quality',unit:'F1.S01',scope:'section',date:window._wqs.date,ammonia:0.2,nitrite:0.1,_skipValidation:true})")
    pg.click('#wqs-aqx'); pg.wait_for_timeout(200)
    with pg.expect_file_chooser() as fc: pg.click('#aqw-learn')
    fc.value.set_files(XLS); pg.wait_for_timeout(1200)
    c = pg.evaluate("daAqwCfg()")
    check('W2 learned: site, house temperatures, per-section names', c['site'] == 'Dar Aqua' and c['temp'].get('F1') == 'Temperature FH1' and c['names']['F2']['1']['do'] == 'Oxygen FH2. S01' and c['names']['F1']['1']['ph'] == 'PH F1.S01', (c.get('site'), c.get('temp')))
    pg.evaluate("addTX({id:'wf2a',type:'water_quality',unit:'F2.S01',scope:'section',date:window._wqs.date,temp:27,ph:7.4,do:6.1,_skipValidation:true}); addTX({id:'wf2b',type:'water_quality',unit:'F2.S16',scope:'section',date:window._wqs.date,temp:25,ph:7.0,do:5.9,ammonia:1,_skipValidation:true}); daAqwOpen()"); pg.wait_for_timeout(200)
    A = pg.evaluate("daAqwAll(window._wqs.date)")
    ordr = pg.evaluate("daAqwCfg().order"); idx = [ordr.index(r[0]) for r in A['rows']]
    check('W3b the whole site in ONE sheet (F1 + F2 together), in exactly the order of AquaManager\'s file', idx == sorted(idx) and any(r[0].startswith('Oxygen FH2') for r in A['rows']) and any(r[0] == 'Temperature FH2' for r in A['rows']), [r[0] for r in A['rows']][:12])
    check('W3c FH2 temperature = average of its sections (27, 25 → 26); each farm shown with its sections recorded', ['Temperature FH2', 'Dar Aqua', pg.evaluate("daAqwDate(window._wqs.date)"), '', 26] in A['rows'] and pg.evaluate("!!document.getElementById('aqw-per-F1') && !!document.getElementById('aqw-per-F2')"), A['per'])
    nm = {r[0]: r[4] for r in A['rows']}
    check('W3d a daily-only section: its weekly readings go to AquaManager as 0 (not measured)', nm.get('TOTAL AMMONIA FH1.S02') == 0 and nm.get('Nitrite(NO2) FH1.S02') == 0 and nm.get('Nitrate(NO3) FH1.S02') == 0, {k: v for k, v in nm.items() if 'S02' in k})
    check('W3e a weekly reading that WAS measured keeps its value', nm.get('TOTAL AMMONIA FH1.S01') == 0.2)
    check('W3f the hatchery\'s two temperatures (Holding, Nursery) take FH1\'s temperature', nm.get('Temperature Holding') == nm.get('Temperature FH1') == nm.get('Temperature Nursery') == 29.5, {k: v for k, v in nm.items() if k.startswith('Temperature')})
    check('W3g sections not measured that day are not sent at all', not any('FH1.S05' in k for k in nm))
    pg.evaluate("RAW.push({unit:'F3.S01T01',farm:'F3',section:'F3.S01',startDate:daAddDays(daToday(),-5),fishNo:300,startWt:2,avgWt:2,volume:2}); _dataVer++; addTX({id:'wf3',type:'water_quality',unit:'F3.S01',scope:'section',date:window._wqs.date,temp:28,ph:7,do:6,_skipValidation:true}); daAqwOpen()"); pg.wait_for_timeout(200)
    A3 = pg.evaluate("daAqwAll(window._wqs.date)")
    check('W3h the nursery (not in AquaManager) is noted, not copied, no "name missing" warning', not any('F3' in r[0] for r in A3['rows']) and not any('F3' in m for m in A3['miss']) and 'مش في الأكوامانجر' in pg.inner_text('#aqw-per-F3'), A3['miss'])
    R = pg.evaluate("daAqwRows('F1', window._wqs.date)")
    d = pg.evaluate("daAqwDate(window._wqs.date)")
    check('W3 rows: one temperature for the house = average of sections (29.5), then each section\'s readings with AquaManager\'s names',
          R['rows'][0] == ['Temperature FH1', 'Dar Aqua', d, '', 29.5] and ['Oxygen FH1.S01', 'Dar Aqua', d, '', 6.5] in R['rows'] and ['PH F1.S02', 'Dar Aqua', d, '', 7.1] in R['rows']
          and ['TOTAL AMMONIA FH1.S01', 'Dar Aqua', d, '', 0.2] in R['rows'] and ['Nitrite(NO2) FH1.S01', 'Dar Aqua', d, '', 0.1] in R['rows'], R['rows'][:8])
    pg.click('#aqw-copy'); pg.wait_for_timeout(300)
    clip = pg.evaluate("navigator.clipboard.readText()")
    L = clip.split('\r\n')
    check('W4 AquaManager\'s paste template: header Parameter / Site / Time / Value (no Zone) + 4 columns, a number in every Value, both farms', L[0] == 'Parameter\tSite\tTime\tValue' and len(L) == len(A['rows']) + 1 and all(len(l.split('\t')) == 4 and l.split('\t')[3].replace('.', '', 1).isdigit() for l in L[1:]), clip[:200])
    check('W5 the average temperature is shown before copying', '29.5' in content(pg))
    with pg.expect_download() as dl: pg.evaluate("daAqwExcel()")
    check('W6 or as an Excel file (real dates)', dl.value.suggested_filename.startswith('AquaManager_SiteMeasurements_2'), dl.value.suggested_filename)
    check('W7 names kept in a synced key', pg.evaluate("daIsSyncedKey(DA_AQW_KEY)"))
    check('W8 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
