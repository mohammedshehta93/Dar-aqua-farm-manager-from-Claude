# Testing log with daily (temp/pH/DO) and weekly (TAN/NO2/NO3/alkalinity) modes; the AquaManager copy carries both.
import os, sys; os.environ['E2E_PORT'] = '8827'
sys.path.insert(0, os.path.dirname(__file__))
import harness
harness.DEFAULT_UNITS[:] = [(f'F1.S{s:02d}T01', 500, 300) for s in range(1, 13)] + [('F2.S01T01', 500, 100)]
from harness import *
XLS = '/mnt/user-data/uploads/588.xls'
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("window._wqs={farm:'F1'}; show('wq-sheet')"); pg.wait_for_timeout(300)
    check('Q1 the testing log has two modes: daily and weekly', pg.evaluate("!!document.getElementById('wqs-mode-daily') && !!document.getElementById('wqs-mode-weekly')") and pg.evaluate("!!document.getElementById('wqs-0-temp')"))
    pg.fill('#wqs-0-temp', '29'); pg.fill('#wqs-0-ph', '7'); pg.fill('#wqs-0-do', '6.5'); pg.click('#wqs-save'); pg.wait_for_timeout(400)
    pg.click('#wqs-mode-weekly'); pg.wait_for_timeout(300)
    check('Q2 weekly mode: ammonia · nitrite · nitrate · alkalinity for every section', pg.evaluate("['ammonia','nitrite','nitrate','alkalinity'].every(k=>!!document.getElementById('wqw-0-'+k))") and pg.evaluate("document.querySelectorAll('#content tbody tr').length") == 12)
    pg.fill('#wqw-0-ammonia', '0.2'); pg.fill('#wqw-0-nitrite', '0.1'); pg.fill('#wqw-0-nitrate', '10'); pg.fill('#wqw-0-alkalinity', '120'); pg.fill('#wqw-1-nitrate', '5')
    pg.click('#wqw-save'); pg.wait_for_timeout(400)
    r = pg.evaluate("getTX().find(t=>t.id==='wn-F1.S01-'+window._wqs.date)")
    check('Q3 saved as the section\'s weekly reading of that day', r and r['ammonia'] == 0.2 and r['nitrite'] == 0.1 and r['nitrate'] == 10 and r['alkalinity'] == 120 and r['scope'] == 'section', r)
    check('Q3b a section with only nitrate measured keeps the rest empty', pg.evaluate("(t => t && t.nitrate===5 && t.ammonia===null)(getTX().find(t=>t.id==='wn-F1.S02-'+window._wqs.date))"))
    pg.fill('#wqw-2-ammonia', '99'); pg.click('#wqw-save'); pg.wait_for_timeout(200)
    check('Q4 impossible values refused', 'مش منطقية' in pg.evaluate("(window.__toasts||[]).slice(-1)[0]||''"))
    pg.evaluate("show('wq-sheet',true)"); pg.wait_for_timeout(200)
    check('Q5 reopening shows what was saved', pg.input_value('#wqw-0-alkalinity') == '120')
    check('Q6 the digital twin reads the weekly ammonia from here', pg.evaluate("(daTwinSecRead('F1.S01','ammonia',window._wqs.date,7)||{}).v") == 0.2)
    pg.click('#wqs-mode-daily'); pg.wait_for_timeout(300)
    check('Q7 back to daily: the daily readings are untouched', pg.input_value('#wqs-0-temp') in ('29', '29.0'))
    if os.path.exists(XLS):
        pg.click('#wqs-aqx'); pg.wait_for_timeout(200)
        with pg.expect_file_chooser() as fc: pg.click('#aqw-learn')
        fc.value.set_files(XLS); pg.wait_for_timeout(1200)
        A = pg.evaluate("daAqwAll(window._wqs.date)"); names = {r[0]: r[4] for r in A['rows']}
        check('Q8 the AquaManager copy of the day carries daily AND weekly readings with AquaManager\'s names',
              names.get('Oxygen FH1.S01') == 6.5 and names.get('TOTAL AMMONIA FH1.S01') == 0.2 and names.get('Nitrite(NO2) FH1.S01') == 0.1 and names.get('Nitrate(NO3) FH1.S01') == 10 and names.get('Nitrate(NO3) FH1.S02') == 5, names)
        check('Q9 alkalinity is not in the AquaManager file → not copied, and the panel says why', not any('lkal' in k for k in names) and 'القلوية متسجلة' in content(pg))
        check('Q10 per farm: daily and weekly sections shown separately', 'أسبوعي 2 سكشن' in content(pg), A['per'])
    check('Q11 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
