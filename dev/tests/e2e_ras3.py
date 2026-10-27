import os; os.environ['E2E_PORT'] = '8786'
from harness import *
with sync_playwright() as p:
    harness_browser[0] = p.chromium.launch()
    sb = MockSB(); sb.units.clear(); sb.add_user('owner@example.com','admin123',role='admin',uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg,'owner@example.com','admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("show('farm-setup')"); pg.wait_for_timeout(300)
    pg.set_input_files('#imp-file', '/mnt/user-data/uploads/2510.xls'); pg.wait_for_timeout(1200); pg.click('#imp-go'); pg.wait_for_timeout(2000)
    pg.evaluate("""localStorage.setItem('daracqua_sites_v1', JSON.stringify({F1:{name:'أكوابونيك',system:'aquaponics'},F2:{name:'RAS',system:'ras'}}));
      localStorage.setItem('daracqua_ras_v1', JSON.stringify({o2:0.45,capacity:{},capFeed:{},loops:[{site:'F2',from:1,to:16,each:true,capFeed:80,capProtein:32,mediaVol:9}]})); show('ras-load')""")
    pg.wait_for_timeout(400)
    get = "() => daRasCompute(14).map(f => ({l:f.label, bio:+(f.bio/1000).toFixed(2), feed:+f.feed.toFixed(1), sfr:+f.effSFR.toFixed(2), prot:+f.effProtein.toFixed(1), load:Math.round(f.loadPct), maxFeed:Math.round(f.maxFeed), maxBio:+(f.maxBio/1000).toFixed(2), cap:Math.round(f.cap)}))"
    d = {x['l']: x for x in pg.evaluate(get)}
    for k in ['F2 S01','F2 S02','F2 S04','F2 S05','F2 S06','F2 S07','F2 S16']: print('  ', d[k])
    s1, s6 = d['F2 S01'], d['F2 S06']
    check('V1 filter capacity is fixed in TAN for every section (2,355 g)', all(x['cap'] == 2355 for x in d.values()))
    check('V2 nursery section eats a higher % of its biomass', s1['sfr'] > s6['sfr'] * 1.5, (s1['sfr'], s6['sfr']))
    check('V2 nursery feed carries higher protein', s1['prot'] > s6['prot'], (s1['prot'], s6['prot']))
    check('V3 max feed for nursery < 80 kg, grow-out ≈ 80 kg', s1['maxFeed'] < 80 and 75 <= s6['maxFeed'] <= 81, (s1['maxFeed'], s6['maxFeed']))
    check('V3 max biomass for nursery far below grow-out', s1['maxBio'] < s6['maxBio'] / 1.5, (s1['maxBio'], s6['maxBio']))
    mf = 2.355 / (s1['prot'] / 100 * 0.092)
    check('V4 formula check: max feed = capacity ÷ (protein × 0.092)', abs(mf - s1['maxFeed']) <= 1, (round(mf, 1), s1['maxFeed']))
    # change 1mm protein → nursery load rises, max feed falls; forecast page keeps the protein
    pg.fill('#ras-prot-0', '45'); pg.evaluate('rasSaveCfg()'); pg.wait_for_timeout(400)
    s1b = {x['l']: x for x in pg.evaluate(get)}['F2 S01']
    check('V5 raising starter protein raises nursery TAN, lowers its max feed', s1b['load'] >= s1['load'] and s1b['maxFeed'] <= s1['maxFeed'], (s1['load'], s1b['load'], s1['maxFeed'], s1b['maxFeed']))
    pg.evaluate("show('feed-forecast')"); pg.wait_for_timeout(300); pg.evaluate('ffSave()'); pg.wait_for_timeout(300)
    check('V6 saving pellet sizes keeps protein', pg.evaluate("() => daPlanCfg().bands[0].protein") == 45)
    pg.evaluate("show('ras-load')"); pg.wait_for_timeout(300)
    c = content(pg)
    check('V7 page shows max feed + max biomass per section', 'أقصى كتلة' in c and 'من الكتلة' in c and 'متاح +' in c)
    check('V8 no JS errors', not pg._errs, pg._errs[:3])
    ctx.close()
srv.shutdown()
for n, ok, d_ in RESULTS: print(('✅ ' if ok else '❌ ') + n + ('' if ok or not d_ else f'   → {d_}'))
print(f"\n{sum(1 for _, o, _ in RESULTS if o)}/{len(RESULTS)} passed")
