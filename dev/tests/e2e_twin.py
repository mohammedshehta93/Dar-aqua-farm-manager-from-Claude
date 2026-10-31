# Digital twin phase 1: growth (TGC) from the farm's own samples + temperatures, section loads, scenarios, calibration.
import os, sys, math; os.environ['E2E_PORT'] = '8812'
sys.path.insert(0, os.path.dirname(__file__))
import harness
harness.DEFAULT_UNITS[:] = [(f'F2.S06T0{t}', 5000, 300) for t in (1, 2)] + [(f'F2.S07T0{t}', 4000, 200) for t in (1, 2)] + [('F1.S01T01', 500, 100)]
from harness import *

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("""() => { RAW.forEach(r=>{ if(/^F2/.test(r.unit)) r.volume=117; }); _dataVer++;
      const A=o=>addTX(Object.assign({_skipValidation:true},o)), d=n=>daAddDays(daToday(),-n);
      [40,20,0].forEach(n=>A({id:'tq'+n,type:'water_quality',unit:'F2.S06',scope:'section',date:d(n),temp:28,do:6.5}));
      [40,20,0].forEach(n=>A({id:'tr'+n,type:'water_quality',unit:'F2.S07',scope:'section',date:d(n),temp:26,do:6.5}));
      A({id:'s1',type:'sampling',unit:'F2.S06T01',date:d(35),avgWt:250}); A({id:'s2',type:'sampling',unit:'F2.S06T01',date:d(21),avgWt:300}); A({id:'s3',type:'sampling',unit:'F2.S06T01',date:d(7),avgWt:340});
      for(let n=1;n<=10;n++){ A({id:'f6a'+n,type:'feeding',unit:'F2.S06T01',date:d(n),kg:50,source:'sheet'}); A({id:'f6b'+n,type:'feeding',unit:'F2.S06T02',date:d(n),kg:50,source:'sheet'}); }
      localStorage.setItem(DA_TWIN_KEY, JSON.stringify({F2:Object.assign({}, DA_TWIN_DEF, {provenFeed:80, media:9, ssa:500})}));
      window._tw={farm:'F2',days:60,feedPct:100,dT:0}; }""")
    pg.wait_for_timeout(300)
    items = pg.evaluate("() => DA_NAV.find(g=>g.id==='analysis').items.map(i=>i[0])")
    check('T1 "التوأم الرقمي" first in the analysis menu', items[0] == 'twin', items)
    pg.evaluate("show('twin')"); pg.wait_for_timeout(500)
    check('T2 page renders: accuracy, events, sections, chart, weekly readings, model data', all(x in content(pg) for x in ['دقة توقع النمو', 'اللي هيحصل', 'السكاشن', 'قرايات الأمونيا']) and pg.evaluate("!!document.querySelector('#content svg')"), content(pg)[:300])
    # TGC from the tank's last two samples ≥7 days apart (300 g → 340 g in 14 days at 28 °C)
    g = pg.evaluate("daTwinTankTGC('F2.S06T01','F2.S06',daTwinCfg('F2'))"); g_py = (340 ** (1/3) - 300 ** (1/3)) / (28 * 14) * 1000
    check(f'T3 TGC from the tank\'s own samples and its section temperature ({g_py:.3f})', abs(g - g_py) < 1e-6, (g, g_py))
    R = pg.evaluate("(() => { const R=daTwinRun('F2',{days:60,feedPct:100,dT:0}); return R.secs.map(S=>({sec:S.sec,temp:S.temp,mort:S.mort,s0:S.series[0],s60:S.series[60],tanks:S.tanks,prov:S.provenFeed,provTan:S.provenTan,obs:S.obs})); })()")
    s6 = next(s for s in R if s['sec'] == 'F2.S06'); t1 = next(t for t in s6['tanks'] if t['unit'] == 'F2.S06T01')
    w = 340.0
    for _ in range(60): w = (w ** (1/3) + g_py * 28 / 1000) ** 3
    check('T4 weight 60 days ahead follows TGC × section temperature', abs(t1['w1'] - w) / w < 1e-6, (t1['w1'], w))
    t2 = next(t for t in s6['tanks'] if t['unit'] == 'F2.S06T02')
    check('T4 a tank without its own samples uses the section\'s TGC', t2['src'] == 'section' and abs(t2['tgc'] - g_py) < 1e-6, t2)
    f0 = pg.evaluate("(() => { let s=0; daRows().filter(r=>daSecOf(r.unit)==='F2.S06').forEach(r=>{ s += r.fishNo*r.avgWt/1000*getSFRAdjusted(r.avgWt,'F2',28,6.5)/100; }); return s; })()")
    check('T5 today\'s feed = biomass × feeding table (temperature, DO)', abs(s6['s0']['feed'] - f0) < 1e-6, (s6['s0']['feed'], f0))
    tan_expect = s6['s0']['feed'] * 0.36 * 0.092   # all tanks of S06 are in the 3 mm band (36 % protein)
    check('T5 TAN = feed × protein × 0.092; O₂ = feed × 1', abs(s6['s0']['tan'] - tan_expect) < 1e-6 and abs(s6['s0']['o2'] - s6['s0']['feed']) < 1e-9, s6['s0'])
    check('T6 proven load from the weekly feed of the section (100 kg/d) beats nothing yet', s6['prov'] == 80 and abs(s6['provTan'] - 80 * 0.36 * 0.092) < 1e-9, s6['prov'])
    check('T6 filter load % = TAN ÷ TAN at the proven feed', abs(s6['s0']['load'] - s6['s0']['tan'] / (80 * 0.36 * 0.092) * 100) < 1e-6)
    # scenarios
    hi = pg.evaluate("(() => { const S=daTwinRun('F2',{days:60,feedPct:120,dT:0}).secs.find(s=>s.sec==='F2.S06'); return {f:S.series[0].feed, w:S.tanks[0].w1}; })()")
    lo = pg.evaluate("(() => { const S=daTwinRun('F2',{days:60,feedPct:80,dT:0}).secs.find(s=>s.sec==='F2.S06'); return {w:S.tanks[0].w1}; })()")
    warm = pg.evaluate("(() => { const S=daTwinRun('F2',{days:60,feedPct:100,dT:2}).secs.find(s=>s.sec==='F2.S06'); return {w:S.tanks[0].w1}; })()")
    check('T7 feed 120%: load +20%, no extra growth (stated assumption)', abs(hi['f'] / s6['s0']['feed'] - 1.2) < 1e-9 and abs(hi['w'] - t1['w1']) < 1e-6, hi)
    check('T7 feed 80%: slower growth; +2 °C: faster growth', lo['w'] < t1['w1'] < warm['w'], (lo, t1['w1'], warm))
    # weekly readings calibrate the proven load
    pg.evaluate("window._tw={farm:'F2',days:60,feedPct:100,dT:0}; show('twin',true)"); pg.wait_for_timeout(400)
    i = pg.evaluate("daTwinRun('F2',window._tw).secs.findIndex(s=>s.sec==='F2.S06')")
    pg.fill(f'#tw-nh-{i}', '0.8'); pg.fill(f'#tw-no-{i}', '0.3'); pg.click('#tw-wsave'); pg.wait_for_timeout(500)
    rec = pg.evaluate("getTX().find(t=>t.id==='wn-F2.S06-'+daToday())")
    check('T8 weekly NH₃/NO₂ saved as one reading for the section', rec and rec['ammonia'] == 0.8 and rec['nitrite'] == 0.3 and rec['scope'] == 'section', rec)
    S = pg.evaluate("(() => { const S=daTwinRun('F2',window._tw).secs.find(s=>s.sec==='F2.S06'); return {prov:S.provenFeed, obs:S.obs}; })()")
    check('T9 a TAN reading within limit while the section ate ~100 kg/day raises the proven load to 100', abs(S['prov'] - 100) < 1e-6, S)
    bt = pg.evaluate("daTwinBacktest('F2')")
    w3 = 300.0
    for _ in range(14): w3 = (w3 ** (1/3) + ((300 ** (1/3) - 250 ** (1/3)) / (28 * 14) * 1000) * 28 / 1000) ** 3
    check(f'T10 accuracy check: predicts the 3rd sample from the first two ({abs(w3-340)/340*100:.1f}% off)', bt['n'] == 1 and abs(bt['med'] - abs(w3 - 340) / 340 * 100) < 1e-6, (bt, w3))
    check('T11 model settings in a synced key', pg.evaluate("daIsSyncedKey(DA_TWIN_KEY)"))
    t0 = pg.evaluate("(() => { const t=performance.now(); for(let k=0;k<5;k++){ _dataVer++; daTwinRun('F2',{days:120,feedPct:100,dT:0}); } return (performance.now()-t)/5; })()")
    check(f'T12 fast enough: {t0:.0f} ms per 120-day run', t0 < 1500, t0)
    check('T13 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
