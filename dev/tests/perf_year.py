# Speed with a year of data: 136 tanks · feed + some mortality every day · a sample every 2 weeks · daily section readings.
import os, sys, json, time; os.environ['E2E_PORT'] = '8842'
sys.path.insert(0, os.path.dirname(__file__))
import harness
U = [(f'F1.S{s:02d}T{t:02d}', 1500, 50) for s in range(1, 13) for t in range(1, 5)] + [(f'F2.S{s:02d}T{t:02d}', 1500, 50) for s in range(1, 6) for t in range(1, 15)] + [(f'F2.S{s:02d}T{t:02d}', 9000, 50) for s in range(6, 17) for t in range(1, 3)]
harness.DEFAULT_UNITS[:] = U
from harness import *
GEN = """(units) => { const out = []; const start = daAddDays(daToday(), -365);
  for(let d = 0; d < 365; d++){ const date = daAddDays(start, d);
    units.forEach((u, i) => { out.push({id:'f'+i+'-'+d, type:'feeding', unit:u, date:date, kg:+(1+d/120).toFixed(2), size:String(1+Math.min(2,Math.floor(d/120))), source:'sheet', at:date+'T08:00:00Z'});
      if((d + i) % 9 === 0) out.push({id:'m'+i+'-'+d, type:'mortality', unit:u, date:date, count:2, source:'sheet', at:date+'T08:00:00Z'});
      if(d % 14 === 0) out.push({id:'s'+i+'-'+d, type:'sampling', unit:u, date:date, avgWt:50+d*1.4, sampleN:30, at:date+'T08:00:00Z'}); });
    const secs = {}; units.forEach(u => secs[u.split('T')[0].replace(/T$/,'')] = 1);
    Object.keys(secs).forEach(s => out.push({id:'w'+s+'-'+d, type:'water_quality', unit:s.slice(0, s.length), scope:'section', date:date, temp:29, ph:7.1, do:6.5, at:date+'T08:00:00Z'})); }
  saveTX(out); return out.length; }"""
def t(pg, js):
    return pg.evaluate("(async () => { const t0 = performance.now(); " + js + "; await new Promise(r => setTimeout(r, 0)); return Math.round(performance.now() - t0); })()")
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=20000)
    n = pg.evaluate(GEN, [u[0] for u in U]); pg.evaluate("_dataVer++")
    print('records:', n)
    pg.wait_for_timeout(1500)
    if os.environ.get('PHONE'):
        cdp = ctx.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    t0 = time.time(); pg.reload(); pg.wait_for_function('() => !!window._cloudSyncDone && typeof currentView!=="undefined" && document.querySelector("#content") && document.querySelector("#content").children.length', timeout=60000)
    boot = round((time.time() - t0) * 1000)
    if os.environ.get('PHONE'):
        cdp = ctx.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    res = {'open the app (reload → first page)': boot}
    res['_txLiveRows (cold)'] = t(pg, "_dataVer++; _txLiveRows()")
    res['_txLiveRows (again)'] = t(pg, "_txLiveRows()")
    for v, setup in [('dashboard', ''), ('feed-sheet', "window._fs={farm:'F2'}"), ('wq-sheet', "window._wqs={farm:'F2'}"), ('tx-sampling', "window._sp={farm:'F2'}"),
                     ('site-overview', ''), ('daily-overview', ''), ('alarms', ''), ('fcr-stage', ''), ('twin', ''), ('farm-plan', ''), ('tx-harvesting', ''), ('unit-cycles', '')]:
        res[v] = t(pg, f"{setup}; show('{v}', true)")
    res['save feed sheet (F2, 108 tanks)'] = t(pg, "window._fs={farm:'F2'}; show('feed-sheet',true); window._fs.rows.forEach(r=>{ const e=document.getElementById('fs-'+r.i+'-m0'); if(e && !e.disabled) e.value='3'; }); daFsSave()")
    print(json.dumps(res, indent=1, ensure_ascii=False))
    json.dump(res, open('/tmp/perf_' + os.environ.get('TAG', 'before') + '.json', 'w'))
    print('errors:', pg._errs[:3])
