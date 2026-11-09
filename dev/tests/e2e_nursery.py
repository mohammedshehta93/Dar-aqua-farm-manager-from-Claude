# The nursery (F3 "Nursery"): tanks added from the settings units list WITHOUT sections ("N1", "Tank A"), a worker limited
# to F3 on a phone — feed sheet, testing log (daily + weekly) and sampling must list them (as one section S01).
import os; os.environ['E2E_PORT'] = '8857'
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    sb.add_user('sajed@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'input_wq', 'input_sampling', 'farm:F3'])
    c1, pc = new_page(p, sb); login(pc, 'admin@example.com', 'admin123'); pc.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pc.evaluate("() => { const r=getFarmsRegistry(); r.F3='Nursery'; saveFarmsRegistry(r); const u=getFarmUnits(); ['N1','N2','N3','Tank A'].forEach((n,i)=>u.push({id:'n'+i,name:n,unitType:'tank',volume:2,depth:1,fishNo:20000,startWt:0.5,source:'',farm:'F3'})); saveFarmUnits(u); }")
    pc.wait_for_timeout(2500)
    c2, ph = new_page(p, sb); ph.set_viewport_size({'width': 390, 'height': 844}); login(ph, 'sajed@workers.dar-aqua.app', 'work123'); ph.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); ph.wait_for_timeout(600)
    rows = ph.evaluate("(window._fs.rows||[]).map(r=>r.unit+'='+r.no.label)")
    check('U1 the nursery\'s tanks without sections appear in the worker\'s feed sheet (one section, numbered by name)', sorted(rows) == sorted(['N1=1.1', 'N2=1.2', 'N3=1.3', 'Tank A=1.4']) and 'No tanks' not in ph.inner_text('#content') and 'مفيش تانكات' not in ph.inner_text('#content'), rows)
    i = ph.evaluate("window._fs.rows.find(r=>r.unit==='N2').i"); ph.fill(f'#fs-{i}-m0', '0.3'); ph.fill(f'#fs-{i}-sz', '1'); ph.click('#fs-save'); ph.wait_for_timeout(600)
    check('U2 feed saved on a nursery tank', ph.evaluate("getTX().some(t=>t.type==='feeding'&&t.unit==='N2'&&t.kg===0.3)"))
    ph.click('#da-wbar button[data-v="wq-sheet"]'); ph.wait_for_timeout(400)
    check('U3 the testing log shows the nursery as one section', ph.evaluate("document.querySelectorAll('#content tbody tr').length") == 1 and 'S-01' in ph.inner_text('#content'))
    ph.fill('#wqs-0-temp', '28'); ph.fill('#wqs-0-ph', '7.2'); ph.fill('#wqs-0-do', '6'); ph.click('#wqs-save'); ph.wait_for_timeout(500)
    check('U4 its reading is saved for the nursery section', ph.evaluate("getTX().some(t=>t.type==='water_quality'&&t.unit==='F3.S01'&&+t.temp===28)"))
    ph.evaluate("window._wqs.mode='weekly'; show('wq-sheet',true)"); ph.wait_for_timeout(300)
    check('U5 the weekly testing log too', ph.evaluate("document.querySelectorAll('#content tbody tr').length") == 1)
    ph.evaluate("show('tx-sampling',true)"); ph.wait_for_timeout(400)
    check('U6 the sampling sheet lists the nursery tanks', ph.evaluate("document.querySelectorAll('.sp-t tbody tr').length") == 4)
    check('U7 the other farms are untouched (tank numbers from names)', ph.evaluate("daTankNo('F1.S03T02').label") == '3.2')
    check('U8 no page errors', not pc._errs and not ph._errs, pc._errs + ph._errs)
    c1.close(); c2.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
