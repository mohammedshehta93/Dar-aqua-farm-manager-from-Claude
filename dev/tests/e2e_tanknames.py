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
    check('N6 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
