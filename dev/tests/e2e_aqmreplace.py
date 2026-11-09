# Importing today's AquaManager Site Overview = the farm's picture: tanks not in the file (or with 0 fish) become empty.
import os, sys; os.environ['E2E_PORT'] = '8874'
FILE = '/mnt/user-data/uploads/2510.xls'
if not os.path.exists(FILE): print('SKIP: 2510.xls not available'); sys.exit()
import xlrd, openpyxl
wb = xlrd.open_workbook(FILE); sh = wb.sheet_by_index(0)
hdr_row = next(r for r in range(6) if any('unit start date' in str(sh.cell_value(r, c)).lower() for c in range(sh.ncols)))
H = [str(sh.cell_value(hdr_row, c)) for c in range(sh.ncols)]; ui = next(i for i, h in enumerate(H) if h.strip().lower() == 'unit'); fi = next(i for i, h in enumerate(H) if 'fish' in h.lower() and 'no' in h.lower() and 'stock' not in h.lower())
rows = [[sh.cell_value(r, c) for c in range(sh.ncols)] for r in range(sh.nrows)]
units = [str(r[ui]).strip() for r in rows[hdr_row + 1:] if str(r[ui]).strip() and any(ch.isdigit() for ch in str(r[ui])) and (isinstance(r[fi], float) and r[fi] > 0)]
GONE = units[:3]; ZERO = units[3]
out = openpyxl.Workbook(); ws = out.active
for i, r in enumerate(rows):
    if i > hdr_row and str(r[ui]).strip() in GONE: continue
    r = list(r)
    if i > hdr_row and str(r[ui]).strip() == ZERO: r[fi] = 0
    if i > hdr_row:
        sd = r[next(j for j, h in enumerate(H) if 'unit start date' in h.lower())]
        if isinstance(sd, float): r[next(j for j, h in enumerate(H) if 'unit start date' in h.lower())] = xlrd.xldate_as_datetime(sd, wb.datemode)
    ws.append(r)
TODAY = '/tmp/aqm_today.xlsx'; out.save(TODAY)
from harness import *
norm = lambda n: n.replace('.T', 'T') if n.count('.') > 1 else n
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("show('farm-setup')"); pg.wait_for_timeout(300); pg.evaluate('daLayoutBuild()'); pg.wait_for_timeout(900)
    pg.set_input_files('#imp-file', FILE); pg.wait_for_timeout(1500); pg.click('#imp-go'); pg.wait_for_timeout(2500)
    pg.evaluate("RAW.push({unit:'F3.S01T01',farm:'F3',section:'F3.S01',startDate:daAddDays(daToday(),-5),fishNo:300,startWt:2,avgWt:2,volume:2}); _valCache={t:0,map:{}}; _dataVer++")
    gone = [pg.evaluate(f"daNormUnit('{g}')") for g in GONE]; zero = pg.evaluate(f"daNormUnit('{ZERO}')")
    D = pg.evaluate("daToday()")
    before = pg.evaluate("(names) => names.map(n => (daStateAt(n, daToday())||{}).fish||0)", gone + [zero])
    check('R0 after the first import those tanks have fish', all(x > 0 for x in before), before)
    pg.evaluate("show('farm-setup',true)"); pg.wait_for_timeout(300)
    pg.set_input_files('#imp-file', TODAY); pg.wait_for_timeout(1500)
    prev = pg.inner_text('#imp-preview')
    check('R1 the preview says which tanks become empty (not in today\'s file or 0 fish)', '🧹 4 تانك هتتسجل فاضية' in prev and all(n in prev for n in gone + [zero]), prev[-500:])
    check('R2 … and that farms not in the file are not touched (the nursery F3 is not listed)', 'F3.S01T01' not in prev)
    pg.click('#imp-go'); pg.wait_for_timeout(2500)
    after = pg.evaluate("(names) => names.map(n => (daStateAt(n, daToday())||{}).fish||0)", gone + [zero])
    check('R3 after importing today\'s file those 4 tanks are empty', after == [0, 0, 0, 0], after)
    check('R4 the other tanks still have their fish from the file', pg.evaluate(f"(daStateAt('{pg.evaluate(f'daNormUnit({chr(39)}{units[5]}{chr(39)})')}', daToday())||{{}}).fish||0") > 0)
    check('R5 the nursery (not in the file) keeps its fish', pg.evaluate("(daStateAt('F3.S01T01', daToday())||{}).fish") == 300)
    check('R6 no tank was deleted', pg.evaluate("(names) => names.every(n => RAW.some(u => u.unit === n))", gone + [zero]))
    pg.evaluate("show('site-overview')"); pg.wait_for_timeout(600)
    ov = pg.evaluate("daOverviewRows(daToday()).map(r=>r.unit)")
    check('R7 the Site Overview no longer lists them', not any(n in ov for n in gone + [zero]) and 'F3.S01T01' in ov)
    # untick: nothing emptied
    pg.evaluate("show('farm-setup',true)"); pg.wait_for_timeout(300)
    pg.evaluate("RAW.find(u=>u.unit==='F1.S12T04') && 0")
    check('R8 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
