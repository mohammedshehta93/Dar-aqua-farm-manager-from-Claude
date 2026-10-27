import os; os.environ['E2E_PORT'] = '8784'
from harness import *
with sync_playwright() as p:
    harness_browser[0] = p.chromium.launch()
    sb = MockSB(); sb.units.clear(); sb.add_user('owner@example.com','admin123',role='admin',uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg,'owner@example.com','admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("show('farm-setup')"); pg.wait_for_timeout(300)
    pg.set_input_files('#imp-file', '/mnt/user-data/uploads/2510.xls'); pg.wait_for_timeout(1200); pg.click('#imp-go'); pg.wait_for_timeout(2000)
    pg.evaluate("localStorage.setItem('daracqua_sites_v1', JSON.stringify({F1:{name:'أكوابونيك',system:'aquaponics'},F2:{name:'RAS',system:'ras'}}))")
    # define filters through the UI: S06–S15 each own filter, max feed 80 kg; S16 by media 9 m³ K1
    pg.evaluate("show('ras-load')"); pg.wait_for_timeout(300)
    pg.evaluate('rasAddLoop()'); pg.wait_for_timeout(200)
    pg.fill('#rl-from-0', '6'); pg.fill('#rl-to-0', '15'); pg.check('#rl-each-0'); pg.fill('#rl-capf-0', '80'); pg.fill('#rl-media-0', '9')
    pg.evaluate('rasAddLoop()'); pg.wait_for_timeout(200)
    pg.fill('#rl-name-1', 'فلتر الحصاد'); pg.fill('#rl-from-1', '16'); pg.fill('#rl-to-1', '16'); pg.fill('#rl-media-1', '9')
    pg.evaluate('rasSaveCfg()'); pg.wait_for_timeout(500)
    d = pg.evaluate("() => daRasCompute(14).map(f => ({l:f.label, u:f.units, cap:Math.round(f.cap), src:f.capSrc, load:Math.round(f.loadPct), feed:+f.feed.toFixed(1), basis:f.basis, over:f.over}))")
    concrete = [x for x in d if x['l'].startswith('F2 S') and x['l'] not in ('F2 S16',)]
    check('L1 one filter per concrete section S06–S15 (10 filters)', len([x for x in d if x['src'] == 'observed']) == 10, [x['l'] for x in d])
    check('L1 capacity from 80 kg/day = 2,355 g TAN', all(x['cap'] == 2355 for x in d if x['src'] == 'observed'))
    s16 = next(x for x in d if x['l'] == 'فلتر الحصاد')
    check('L2 media filter: 9 m³ × 500 × 0.5 = 2,250 g TAN', s16['cap'] == 2250, s16)
    un = [x for x in d if 'مش متعرفة' in x['l']]
    check('L3 sections without a filter shown separately (F2 S01–S05)', len(un) == 1 and un[0]['cap'] == 0, un)
    check('L4 F1 (aquaponics) excluded', not any(x['l'].startswith('F1') for x in d))
    s06 = next(x for x in d if x['l'] == 'F2 S06')
    print('   S06 by SFR:', s06)
    # actual 80 kg/day on S06 for 3 days → exactly at proven max → not "over"
    pg.evaluate("""() => { const u = RAW.filter(r=>r.farm==='F2' && /\\.S06T/.test(r.unit) && r.fishNo>0).map(r=>r.unit);
      [0,-1,-2].forEach(d => u.forEach((x,i) => addTX({id:'s6'+d+'_'+i,type:'feeding',date:daAddDays(daToday(),d),unit:x,kg:80/u.length,_skipValidation:true}))); }""")
    a = pg.evaluate("() => { const f=daRasCompute(14).find(f=>f.label==='F2 S06'); return {feed:+f.feed.toFixed(1), basis:f.basis, load:+f.loadPct.toFixed(1), over:f.over}; }")
    check('L5 actual 80 kg/day → 100% of proven max, NOT flagged as over', a['basis'] == 'actual' and a['feed'] == 80 and abs(a['load'] - 100) < 0.2 and a['over'] is False, a)
    pg.evaluate("addTX({id:'s6x',type:'feeding',date:daToday(),unit:RAW.find(r=>/F2\\.S06T/.test(r.unit)&&r.fishNo>0).unit,kg:30,_skipValidation:true})")
    b = pg.evaluate("() => { const f=daRasCompute(14).find(f=>f.label==='F2 S06'); return {feed:+f.feed.toFixed(1), load:+f.loadPct.toFixed(0), over:f.over}; }")
    check('L6 above proven max (90 kg avg) → flagged + smart alert names the filter', b['over'] is True and pg.evaluate("() => generateAlerts().some(x => String(x.msg||'').indexOf('F2 S06') === 0 && String(x.msg||'').indexOf('أقصى علف جربتوه') > 0)"), b)
    pg.evaluate("show('ras-load')"); pg.wait_for_timeout(300)
    c = content(pg)
    check('L7 page lists filters with status', 'F2 S06' in c and 'فوق أقصى حمل جربتوه' in c and 'فلتر الحصاد' in c and 'مش متعرفة' in c)
    check('L8 no JS errors', not pg._errs, pg._errs[:3])
    ctx.close()
srv.shutdown()
for n, ok, d_ in RESULTS: print(('✅ ' if ok else '❌ ') + n + ('' if ok or not d_ else f'   → {d_}'))
print(f"\n{sum(1 for _, o, _ in RESULTS if o)}/{len(RESULTS)} passed")
