# Sections of a farm's tanks: add as "each tank its own section", rearrange an existing farm (records move), Settings shows real tanks.
import os; os.environ['E2E_PORT'] = '8863'
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.on('dialog', lambda d: d.accept())
    pg.evaluate("show('farm-setup')"); pg.wait_for_timeout(300)
    check('L1 the add card asks how the tanks are arranged', pg.evaluate("!!document.getElementById('ta-one') && !!document.getElementById('ta-each')"))
    pg.select_option('#ta-farm', '__new'); pg.fill('#ta-newcode', 'F3'); pg.fill('#ta-newname', 'Nursery'); pg.check('#ta-each'); pg.fill('#ta-n', '7'); pg.dispatch_event('#ta-n', 'input'); pg.wait_for_timeout(100)
    pv = pg.inner_text('#ta-preview')
    check('L2 "each tank its own section": names F3.S01T01 … F3.S07T01 shown before saving', 'F3.S01T01' in pv and 'F3.S07T01' in pv, pv)
    pg.click('#ta-save'); pg.wait_for_timeout(700)
    check('L3 saved as 7 sections of one tank', pg.evaluate("RAW.filter(u=>u.farm==='F3').map(u=>u.section).join(',')") == ','.join(f'F3.S0{i}' for i in range(1, 8)))
    pg.evaluate("window._wqs={farm:'F3',mode:'daily'}; show('wq-sheet')"); pg.wait_for_timeout(300)
    check('L4 the testing log shows the 7 sections', pg.evaluate("document.querySelectorAll('#content tbody tr').length") == 7)
    # an existing farm added as ONE section of 7, with feed already recorded on one tank
    pg.evaluate("show('farm-setup',true)"); pg.wait_for_timeout(300)
    pg.select_option('#ta-farm', '__new'); pg.fill('#ta-newcode', 'F4'); pg.fill('#ta-n', '7'); pg.dispatch_event('#ta-n', 'input'); pg.click('#ta-save'); pg.wait_for_timeout(700)
    pg.evaluate("addTX({id:'fd-x',type:'feeding',unit:'F4.S01T05',date:daToday(),kg:0.7,source:'sheet',_skipValidation:true})")
    pg.evaluate("show('farm-setup',true)"); pg.wait_for_timeout(1300)
    check('L5 the status card has "🔀 arrange" per farm', pg.evaluate("!!document.querySelector('.lay-btn[data-farm=\"F4\"]')"))
    pg.click('.lay-btn[data-farm="F4"]'); pg.wait_for_timeout(200)
    prev = pg.inner_text('#lay-prev')
    check('L6 the plan shows old → new names (7 sections)', '7 سكشن' in prev and 'F4.S01T05 → F4.S05T01' in prev, prev[:200])
    pg.click('#lay-apply'); pg.wait_for_timeout(2500)
    names = pg.evaluate("RAW.filter(u=>u.farm==='F4').map(u=>u.unit).sort()")
    check('L7 renamed to 7 sections of one tank, no leftovers', names == [f'F4.S0{i}T01' for i in range(1, 8)], names)
    check('L8 the recorded feed moved with its tank', pg.evaluate("(t => t && t.unit)(getTX().find(t=>t.id==='fd-x'))") == 'F4.S05T01')
    cloud = sorted(k.split(':')[1] for k in sb.units if ':F4.' in k)
    check('L9 the cloud has only the new names (old and temporary ones gone)', cloud == [f'F4.S0{i}T01' for i in range(1, 8)], cloud)
    pg.evaluate("window._wqs={farm:'F4',mode:'daily'}; show('wq-sheet',true)"); pg.wait_for_timeout(300)
    check('L10 the testing log now shows 7 sections for F4', pg.evaluate("document.querySelectorAll('#content tbody tr').length") == 7)
    pg.evaluate("show('farm-setup',true)"); pg.wait_for_timeout(1300); pg.click('.lay-btn[data-farm="F4"]'); pg.wait_for_timeout(200)
    pg.check('input[name="lay-m"][value="n"]'); pg.fill('#lay-n', '2'); pg.dispatch_event('#lay-n', 'input'); pg.wait_for_timeout(100)
    check('L11 "2 tanks per section" → 4 sections planned', '4 سكشن' in pg.inner_text('#lay-prev'))
    # what the owner saw: a temporary tank left behind (device + cloud + upload queue) → cleaned up by the next sync
    pg.evaluate("(() => { const u={unit:'F3.TMP1794219039640_3',farm:'F3',section:'F3.S01',fishNo:0,startWt:0,avgWt:0,volume:2}; RAW.push(u); daPersistUnitsLocal(); const q=daUPend(); q[u.unit]=u; daUPendSet(q); })()")
    sb.units['farm-main:F3.TMP1794219039640_3'] = {'id': 'farm-main:F3.TMP1794219039640_3', 'farm_id': 'farm-main', 'unit': 'F3.TMP1794219039640_3', 'data': {'unit': 'F3.TMP1794219039640_3', 'farm': 'F3'}}
    pg.evaluate("daRealtimePull()"); pg.wait_for_timeout(1500)
    check('L11b a leftover temporary tank is removed by itself (device, cloud, queue) — no records on it', not pg.evaluate("RAW.some(u=>/TMP/.test(u.unit))") and not any('TMP' in k for k in sb.units) and not pg.evaluate("Object.keys(daUPend()).some(n=>/TMP/.test(n))"))
    pg.evaluate("(() => { const q=daUPend(); q['F3.TMP9_1']={unit:'F3.TMP9_1',farm:'F3'}; daUPendSet(q); })()"); pg.evaluate("daUnitsFlush()"); pg.wait_for_timeout(800)
    check('L11c a temporary name in a queue (e.g. from another tab) is never uploaded', not any('TMP' in k for k in sb.units))
    pg.evaluate("daUnitsBusySet(true)"); n0 = pg.evaluate("RAW.length"); sb.units['farm-main:F9.S01T01'] = {'id': 'farm-main:F9.S01T01', 'farm_id': 'farm-main', 'unit': 'F9.S01T01', 'data': {'unit': 'F9.S01T01', 'farm': 'F9', 'section': 'F9.S01'}}
    pg.evaluate("daRealtimePull()"); pg.wait_for_timeout(800)
    check('L11d while sections are being rearranged no sync touches the tank list', pg.evaluate("RAW.length") == n0 and not pg.evaluate("RAW.some(u=>u.unit==='F9.S01T01')"))
    pg.evaluate("daUnitsBusySet(false)"); pg.evaluate("daRealtimePull()"); pg.wait_for_timeout(800); del sb.units['farm-main:F9.S01T01']
    pg.evaluate("settingsTab='units'; show('settings')"); pg.wait_for_timeout(400)
    st = pg.inner_text('#st-tanks') if pg.query_selector('#st-tanks') else ''
    check('L12 Settings → Tanks shows the real tanks per farm (no "no tanks added")', 'F3' in st and 'F4' in st and 'S07' in st and 'لا توجد أحواض مضافة' not in pg.inner_text('#content'), st[:200])
    check('L13 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
