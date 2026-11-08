# Tanks added in the tool with other name styles (e.g. the hatchery) appear in the feed sheet like the rest.
import os; os.environ['E2E_PORT'] = '8839'
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    got = pg.evaluate("['F1.S01T01','F2.S16.T01','HA.S01.T02','HA.S1-T3','HA.S02 T01','HA.S02.Tank2','F1.S10T04'].map(u=>{const t=daTankNo(u); return t && t.label;})")
    check('N1 names with a dot / dash / space / "Tank" between section and tank are read', got == ['1.1', '16.1', '1.2', '1.3', '2.1', '2.2', '10.4'], got)
    pg.evaluate("(() => { const u=getFarmUnits(); [['HA.S03.01','HA.S03'],['HA.S03.02','HA.S03']].forEach(([n,s])=>u.push({name:n,farm:'HA',section:s,fishNo:5000,avgWt:2})); ['HA.S01.T01','HA.S01.T02'].forEach(n=>u.push({name:n,farm:'HA',section:'HA.S01',fishNo:8000,avgWt:1})); saveFarmUnits(u); })()")
    check('N2 a name without T: the tank\'s own section + its last number', pg.evaluate("daTankNo('HA.S03.02').label") == '3.2')
    pg.evaluate("window._fs={farm:'HA'}; show('feed-sheet')"); pg.wait_for_timeout(400)
    rows = pg.evaluate("window._fs.rows.map(r=>r.no.label)")
    check('N3 the hatchery feed sheet lists its tanks (no more "no tanks")', rows == ['1.1', '1.2', '3.1', '3.2'] and 'مفيش تانكات' not in content(pg), rows)
    check('N3b a tank added in setup with its fish counts as stocked (not locked as empty)', pg.evaluate("window._fs.rows.find(r=>r.unit==='HA.S01.T01').fish") == 8000 and pg.evaluate("daStateAt('HA.S03.01',daToday()).fish") == 5000)
    i = pg.evaluate("window._fs.rows.find(r=>r.unit==='HA.S01.T01').i"); pg.fill(f'#fs-{i}-m0', '0.5'); pg.fill(f'#fs-{i}-sz', '1'); pg.click('#fs-save'); pg.wait_for_timeout(500)
    check('N4 feed saved on the hatchery tank', pg.evaluate("getTX().some(t=>t.type==='feeding'&&t.unit==='HA.S01.T01'&&t.kg===0.5)"))
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet',true)"); pg.wait_for_timeout(300)
    check('N5 the other farms are unchanged', pg.evaluate("window._fs.rows.length") > 0 and pg.evaluate("window._fs.rows[0].no.label") == '1.1')
    # the hardest case: names not starting with the farm code, no S / T, one with no number at all
    pg.evaluate("(() => { const u=getFarmUnits(); [['حوض 1','MF.S01'],['حوض 2','MF.S01'],['Tank 3','MF.S02'],['Hatch-A','MF.S02']].forEach(([n,s])=>u.push({name:n,farm:'MF',section:s,fishNo:3000,avgWt:0.5})); saveFarmUnits(u); })()")
    pg.evaluate("window._wqs={farm:'MF',mode:'daily'}; show('wq-sheet')"); pg.wait_for_timeout(300)
    daily = pg.evaluate("document.querySelectorAll('#content tbody tr').length")
    pg.evaluate("window._fs={farm:'MF'}; show('feed-sheet',true)"); pg.wait_for_timeout(300)
    feed = pg.evaluate("window._fs.rows.map(r=>r.unit+'='+r.no.label)")
    check('N7 any tank names: the feed sheet lists every tank, numbered inside its section', sorted(feed) == sorted(['حوض 1=1.1', 'حوض 2=1.2', 'Tank 3=2.3', 'Hatch-A=2.1']) and 'مفيش تانكات' not in content(pg), (feed, daily))
    pg.evaluate("window._wqs={farm:'MF',mode:'weekly'}; show('wq-sheet',true)"); pg.wait_for_timeout(300)
    weekly = pg.evaluate("document.querySelectorAll('#content tbody tr').length")
    check('N8 the weekly testing log shows the same sections as the daily one', weekly == daily == 2, (daily, weekly))
    pg.evaluate("window._sp={farm:'MF'}; show('tx-sampling',true)"); pg.wait_for_timeout(300)
    check('N9 the sampling sheet lists them too', pg.evaluate("document.querySelectorAll('.sp-t tbody tr').length") == 4)
    pg.evaluate("addTX({id:'mfw',type:'water_quality',unit:'MF.S01',scope:'section',date:daToday(),do:6,_skipValidation:true})")
    check('N10 their readings count for their farm when copying to AquaManager', pg.evaluate("daInFarm('MF.S01','MF') && !daInFarm('MF.S01','F1')"))
    check('N6 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
