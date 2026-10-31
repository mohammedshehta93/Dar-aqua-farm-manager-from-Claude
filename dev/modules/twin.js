// ══════════════════════════════════════════════════════════
//  DIGITAL TWIN — phase 1: fish + section loads, calibrated by the farm's own records
// ══════════════════════════════════════════════════════════
// Per tank: growth by thermal growth coefficient TGC = Δ(W^⅓)/(T·days)·1000 from the tank's own samples and its
// section's measured temperature; mortality at the section's last-28-day rate; feed from the farm's feeding table
// (getSFRAdjusted). Per section: feed, TAN produced (feed × protein × 0.092), O₂ demand (feed × kg O₂/kg feed) and
// biofilter load as % of the highest load PROVEN on this farm (entered, and raised automatically by weekly TAN readings
// that stayed within limit). Scenarios: feed %, temperature shift, horizon. Backtest: predicts past samples.
// Stated assumptions: feeding above the table does not add growth; below it, growth falls in proportion.
var DA_TWIN_KEY = 'daracqua_plan_v1_twin';   // synced: {farm: {...}}
var DA_TWIN_DEF = {media:0, ssa:500, provenFeed:0, tanOk:1, prot1:40, prot2:36, prot3:36, o2PerFeed:1, tgc:1.8, temp:28};
function daTwinCfg(farm){ var a = {}; try{ a = JSON.parse(localStorage.getItem(DA_TWIN_KEY) || '{}') || {}; }catch(e){} return Object.assign({}, DA_TWIN_DEF, a[farm] || {}); }
function daTwinProtein(w, cfg){ var st = daFcrStages(), i = daStageOf(w, st), z = daSizeOf(st[i].label) || String(i + 1); return (parseFloat(cfg['prot' + z]) || 36) / 100; }
// latest section reading (section record or any tank of the section) within `days`
// one pass over the records, cached until data changes: water readings and daily feed per section
var _twIdx = {v:-1};
function daTwinIdx(){
  if(_twIdx.v === _dataVer) return _twIdx;
  var wq = {}, feed = {};
  getTX().forEach(function(t){
    if(t.deleted) return;
    if(t.type === 'water_quality'){ var k = t.scope === 'section' ? t.unit : (daSecOf(t.unit) || t.unit); (wq[k] = wq[k] || []).push(t); }
    else if(t.type === 'feeding'){ var s2 = daSecOf(t.unit); if(!s2) return; var f = feed[s2] = feed[s2] || {}; f[t.date] = (f[t.date] || 0) + (parseFloat(t.kg) || 0); }
  });
  Object.keys(wq).forEach(function(k){ wq[k].sort(function(a, b){ return a.date < b.date ? -1 : 1; }); });
  _twIdx = {v:_dataVer, wq:wq, feed:feed}; return _twIdx;
}
function daTwinSecRead(sec, field, upTo, days){
  var L = daTwinIdx().wq[sec] || [];
  for(var i = L.length - 1; i >= 0; i--){ var t = L[i]; if(t.date > upTo) continue; if(days && daDaysBetween(t.date, upTo) > days) return null;
    if(t[field] !== undefined && t[field] !== null && t[field] !== '') return {v:parseFloat(t[field]), date:t.date}; }
  return null;
}
function daTwinTempOn(sec, date, cfg){ var r = daTwinSecRead(sec, 'temp', date, 21); return r && r.v > 5 ? r.v : cfg.temp; }
function daTwinSamples(unit){ return getTX().filter(function(t){ return t.type === 'sampling' && t.unit === unit && !t.deleted && parseFloat(t.avgWt) > 0; }).sort(function(a, b){ return a.date < b.date ? -1 : 1; }); }
function daTwinTGC(w1, w2, d1, d2, sec, cfg){
  var days = daDaysBetween(d1, d2); if(days < 7 || !(w2 > w1)) return null;
  var tsum = 0; for(var i = 0; i < days; i += 7) tsum += daTwinTempOn(sec, daAddDays(d1, i), cfg) * Math.min(7, days - i);
  var g = (Math.cbrt(w2) - Math.cbrt(w1)) / tsum * 1000; return g > 0.2 && g < 6 ? g : null;
}
function daTwinTankTGC(unit, sec, cfg){
  var s = daTwinSamples(unit); if(s.length < 2) return null; var last = s[s.length - 1];
  for(var i = s.length - 2; i >= 0; i--) if(daDaysBetween(s[i].date, last.date) >= 7) return daTwinTGC(+s[i].avgWt, +last.avgWt, s[i].date, last.date, sec, cfg);
  return null;
}
function daTwinMortRate(units, today){
  var dead = 0, fish = 0, from = daAddDays(today, -28);
  getTX().forEach(function(t){ if(t.type === 'mortality' && !t.deleted && t.date > from && t.date <= today && units[t.unit]) dead += parseInt(t.count) || 0; });
  Object.keys(units).forEach(function(u){ fish += units[u].fishNo || 0; });
  return fish > 0 ? Math.min(0.02, dead / (fish + dead) / 28) : 0;
}
function daMedian(a){ a = a.filter(function(v){ return v != null; }).sort(function(x, y){ return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : null; }
// observed calibration: the highest 7-day section feed under which weekly TAN stayed within limit
function daTwinProvenObserved(sec, units, cfg){
  var I = daTwinIdx(), F = I.feed[sec] || {}, best = 0, at = '';
  (I.wq[sec] || []).forEach(function(t){
    if(t.ammonia === undefined || t.ammonia === '' || t.ammonia === null || parseFloat(t.ammonia) > cfg.tanOk) return;
    var kg = 0; for(var d = 1; d <= 7; d++) kg += F[daAddDays(t.date, -d)] || 0;   // the week BEFORE the reading (tests are taken early)
    if(kg / 7 > best){ best = kg / 7; at = t.date; } });
  return {kg:best, date:at};
}
function daTwinRun(farm, sc){
  var cfg = daTwinCfg(farm), today = daToday(), H = sc.days || 60, fp = (sc.feedPct || 100) / 100, dT = sc.dT || 0;
  var lim = daFarmLIM(farm), target = daHarvestTargetFor(farm), secs = {};
  daRows().forEach(function(r){ if(r.farm !== farm && String(r.unit).indexOf(farm + '.') !== 0) return; if(daIsBrood(r.unit)) return;
    var sec = r.section || daSecOf(r.unit); (secs[sec] = secs[sec] || {sec:sec, units:{}, tanks:[]}).units[r.unit] = r; });
  var farmTGC = [];
  Object.keys(secs).forEach(function(k){ var S = secs[k]; S.tgcs = Object.keys(S.units).map(function(u){ var g = daTwinTankTGC(u, k, cfg); farmTGC.push(g); return g; }); });
  var fTGC = daMedian(farmTGC) || cfg.tgc;
  Object.keys(secs).sort(function(a, b){ return daSecNo(a) - daSecNo(b); }).forEach(function(k){
    var S = secs[k], sTGC = daMedian(S.tgcs) || fTGC, T0 = daTwinTempOn(k, today, cfg), T = T0 + dT, DO = (daTwinSecRead(k, 'do', today, 14) || {}).v || 6;
    var m = daTwinMortRate(S.units, today); S.temp = T0; S.mort = m; S.series = [];
    for(var d = 0; d <= H; d++) S.series.push({d:d, bio:0, feed:0, tan:0, o2:0});
    S.events = {dens:null, harvest:null};
    Object.keys(S.units).forEach(function(u, i){
      var r = S.units[u], w = r.avgWt || 0, n = r.fishNo || 0, vol = (daRawUnit(u) || {}).volume || r.volume || 0, g = (S.tgcs[i] || sTGC) * Math.min(1, fp), src = S.tgcs[i] ? 'tank' : 'section';
      var tank = {unit:u, tgc:g / Math.min(1, fp), src:src, w0:w, densDay:null, harvDay:null};
      for(var d2 = 0; d2 <= H; d2++){
        if(d2 > 0){ w = Math.pow(Math.cbrt(w) + g * T / 1000, 3); n = n * (1 - m); }
        var bio = n * w / 1000, feed = bio * getSFRAdjusted(w, farm, T, DO) / 100 * fp, z = S.series[d2];
        z.bio += bio; z.feed += feed; z.tan += feed * daTwinProtein(w, cfg) * 0.092; z.o2 += feed * cfg.o2PerFeed;
        if(vol > 0 && tank.densDay === null && bio / vol >= lim.densAlarm) tank.densDay = d2;
        if(target && tank.harvDay === null && w >= target) tank.harvDay = d2;
      }
      tank.w1 = w; S.tanks.push(tank);
      if(tank.densDay !== null && (!S.events.dens || tank.densDay < S.events.dens.d)) S.events.dens = {d:tank.densDay, unit:u};
      if(tank.harvDay !== null && (!S.events.harvest || tank.harvDay < S.events.harvest.d)) S.events.harvest = {d:tank.harvDay, unit:u};
    });
    var obs = daTwinProvenObserved(k, S.units, cfg), proven = Math.max(cfg.provenFeed || 0, obs.kg);
    S.obs = obs; S.provenFeed = proven; S.provenTan = proven * (parseFloat(cfg.prot3) || 36) / 100 * 0.092;
    S.series.forEach(function(z){ z.load = S.provenTan > 0 ? z.tan / S.provenTan * 100 : null; });
    S.loadDay = null; S.series.forEach(function(z){ if(S.loadDay === null && z.load !== null && z.load > 100) S.loadDay = z.d; });
    S.tan = daTwinSecRead(k, 'ammonia', today, 21); S.no2 = daTwinSecRead(k, 'nitrite', today, 21);
  });
  return {farm:farm, cfg:cfg, today:today, H:H, secs:Object.keys(secs).sort(function(a, b){ return daSecNo(a) - daSecNo(b); }).map(function(k){ return secs[k]; }), fTGC:fTGC};
}
// backtest: TGC from samples 1→2 predicts sample 3 (each tank with ≥3 samples, gaps ≥7 days)
function daTwinBacktest(farm){
  var cfg = daTwinCfg(farm), errs = [];
  daRows().forEach(function(r){ if(r.farm !== farm && String(r.unit).indexOf(farm + '.') !== 0) return;
    var s = daTwinSamples(r.unit), sec = r.section || daSecOf(r.unit);
    for(var i = 0; i + 2 < s.length; i++){
      var a = s[i], b = s[i + 1], c = s[i + 2]; if(daDaysBetween(b.date, c.date) < 7) continue;
      var g = daTwinTGC(+a.avgWt, +b.avgWt, a.date, b.date, sec, cfg); if(!g) continue;
      var days = daDaysBetween(b.date, c.date), w = +b.avgWt; for(var d = 0; d < days; d++) w = Math.pow(Math.cbrt(w) + g * daTwinTempOn(sec, daAddDays(b.date, d), cfg) / 1000, 3);
      errs.push(Math.abs(w - c.avgWt) / c.avgWt * 100); } });
  return {n:errs.length, med:daMedian(errs)};
}
function daTwinChart(S, H){
  // one scale only: filter load % with the 100 % line when a proven load exists, otherwise feed kg/day
  var useLoad = S.provenTan > 0, key = useLoad ? 'load' : 'feed', mx = useLoad ? 110 : 0;
  S.series.forEach(function(z){ if(z[key] !== null) mx = Math.max(mx, z[key]); }); if(!mx) return '';
  var W = 640, Hh = 170, P = 30, x = function(d){ return P + (W - 2 * P) * d / H; }, y = function(v){ return Hh - 20 - (Hh - 34) * v / (mx * 1.08); };
  var path = S.series.filter(function(z){ return z[key] !== null; }).map(function(z, i){ return (i ? 'L' : 'M') + x(z.d).toFixed(1) + ' ' + y(z[key]).toFixed(1); }).join('');
  var h = '<div style="font-size:12px;color:var(--muted);margin-bottom:4px">' + (useLoad ? '<span style="color:#b45309;font-weight:700">━ حمل الفلتر %</span> · <span style="color:#ef4444">┅ 100% = أعلى حمل اتجرب</span>' : '<span style="color:#0f766e;font-weight:700">━ علف/يوم (كجم)</span> — حط "أعلى علف اتجرب" عشان يظهر حمل الفلتر') + '</div>';
  h += '<svg viewBox="0 0 ' + W + ' ' + Hh + '" direction="ltr" style="width:100%;max-width:' + W + 'px;height:auto;background:#fff;border-radius:8px">';
  h += '<line x1="' + P + '" y1="' + (Hh - 20) + '" x2="' + (W - P) + '" y2="' + (Hh - 20) + '" stroke="#cbd5e1"/>';
  if(useLoad){ var y100 = y(100); h += '<line x1="' + P + '" y1="' + y100 + '" x2="' + (W - P) + '" y2="' + y100 + '" stroke="#ef4444" stroke-dasharray="5 4"/>'; }
  [0, Math.round(mx / 2), Math.round(mx)].forEach(function(v){ h += '<text x="' + (P - 4) + '" y="' + (y(v) + 3) + '" font-size="9" text-anchor="end" fill="#94a3b8">' + v + '</text>'; });
  h += '<path d="' + path + '" fill="none" stroke="' + (useLoad ? '#f59e0b' : '#0f766e') + '" stroke-width="2.4"/>';
  [0, Math.round(H / 2), H].forEach(function(d){ h += '<text x="' + x(d) + '" y="' + (Hh - 5) + '" font-size="10" text-anchor="middle" fill="#64748b">' + (d ? '+' + d + 'd' : 'today') + '</text>'; });
  return h + '</svg>';
}
function renderTwin(){
  var st = window._tw = window._tw || {days:60, feedPct:100, dT:0}, farms = daFarms();
  if(farmFilter && farmFilter !== 'all') st.farm = farmFilter; if(!st.farm || farms.indexOf(st.farm) < 0) st.farm = farms[farms.length - 1] || '';
  var R = daTwinRun(st.farm, st), cfg = R.cfg, can = ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0;
  var inp = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px', f1 = function(v, d){ return v == null || isNaN(v) ? '—' : (+v).toFixed(d == null ? 1 : d); };
  var fd = function(d){ return d === null || d === undefined ? '—' : (d === 0 ? 'دلوقتي' : daAddDays(R.today, d) + ' (' + d + 'ي)'); };
  var h = '<div class="ph"><div><h2>🧬 التوأم الرقمي</h2><p style="font-size:11px;color:var(--muted)">نموذج للمزرعة بيمشي يوم بيوم من عيناتكم وحرارتكم وجدول التغذية، وبيتصحح بقرايات الأمونيا الأسبوعية</p></div></div>';
  h += '<div class="card" style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">';
  if(!(farmFilter && farmFilter !== 'all')) h += '<div class="field" style="margin:0"><label>المزرعة</label><select id="tw-farm" style="' + inp + '" onchange="window._tw.farm=this.value;show(&quot;twin&quot;,true)">' + farms.map(function(f){ return '<option' + (f === st.farm ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div>';
  h += '<div class="field" style="margin:0"><label>المدة</label><select id="tw-days" style="' + inp + '" onchange="window._tw.days=+this.value;show(&quot;twin&quot;,true)">' + [30, 60, 90, 120].map(function(d){ return '<option value="' + d + '"' + (d === st.days ? ' selected' : '') + '>' + d + ' يوم</option>'; }).join('') + '</select></div>'
    + '<div class="field" style="margin:0"><label>ماذا لو العلف</label><select id="tw-feed" style="' + inp + '" onchange="window._tw.feedPct=+this.value;show(&quot;twin&quot;,true)">' + [70, 80, 90, 100, 110, 120, 130].map(function(v){ return '<option value="' + v + '"' + (v === st.feedPct ? ' selected' : '') + '>' + (v === 100 ? 'حسب الجدول' : v + '% من الجدول') + '</option>'; }).join('') + '</select></div>'
    + '<div class="field" style="margin:0"><label>ماذا لو الحرارة</label><select id="tw-dt" style="' + inp + '" onchange="window._tw.dT=+this.value;show(&quot;twin&quot;,true)">' + [-4, -2, 0, 2, 4].map(function(v){ return '<option value="' + v + '"' + (v === st.dT ? ' selected' : '') + '>' + (v ? (v > 0 ? '+' : '') + v + ' °م' : 'زي ما هي') + '</option>'; }).join('') + '</select></div></div>';
  if(!R.secs.length) return h + '<div class="card" style="text-align:center;padding:40px;color:var(--muted)">مفيش تانكات فيها سمك للمزرعة دي.</div>' + daTwinCfgCard(st.farm, cfg, can);
  var bt = daTwinBacktest(st.farm);
  h += '<div class="card" style="margin-bottom:12px;font-size:13px">📏 <b>دقة توقع النمو:</b> ' + (bt.n ? 'النموذج اتنبأ بـ ' + bt.n + ' عينة قديمة من اللي قبلها، والفرق المتوسط <b>' + f1(bt.med) + '%</b> من الوزن الفعلي.' : 'محتاج تانكات فيها 3 عينات على الأقل (بين كل عينة والتانية أسبوع) عشان أقيس الدقة.')
    + ' · معامل النمو (TGC) للمزرعة: <b>' + f1(R.fTGC, 2) + '</b>' + (cfg.provenFeed || R.secs.some(function(S){ return S.obs.kg; }) ? '' : ' · <span style="color:var(--amber)">حط "أعلى علف اتجرب" تحت عشان يتحسب حمل الفلتر</span>') + '</div>';
  // events
  var ev = []; R.secs.forEach(function(S){
    if(S.events.dens) ev.push({d:S.events.dens.d, t:'🔴 ' + (daTankNo(S.events.dens.unit) || {}).label + ' يوصل لحد الكثافة الحرج (' + daFarmLIM(st.farm).densAlarm + ' كجم/م³)'});
    if(S.loadDay !== null) ev.push({d:S.loadDay, t:'🟠 سكشن ' + daSecNo(S.sec) + ' يعدّي أعلى حمل فلتر اتجرب'});
    if(S.events.harvest) ev.push({d:S.events.harvest.d, t:'🎣 ' + (daTankNo(S.events.harvest.unit) || {}).label + ' يوصل لوزن الحصاد'}); });
  ev.sort(function(a, b){ return a.d - b.d; });
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">📅 اللي هيحصل خلال ' + R.H + ' يوم' + (st.feedPct !== 100 || st.dT ? ' <span style="font-size:11px;color:var(--amber)">(سيناريو)</span>' : '') + '</div>'
    + (ev.length ? '<ul style="margin:0;padding-inline-start:18px;line-height:1.9;font-size:13px">' + ev.slice(0, 15).map(function(e){ return '<li><b>' + fd(e.d) + '</b> — ' + daEsc(e.t) + '</li>'; }).join('') + '</ul>' : '<div style="color:var(--muted);font-size:13px">مفيش أحداث متوقعة في المدة دي.</div>') + '</div>';
  // per section
  var th = 'padding:7px 6px;white-space:nowrap';
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🏠 السكاشن — النهارده ← بعد ' + R.H + ' يوم</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--deep);color:#fff">'
    + ['السكشن', 'الحرارة', 'الكتلة (كجم)', 'علف/يوم (كجم)', 'TAN ناتج (كجم/يوم)', 'O₂ مطلوب (كجم/يوم)', 'حمل الفلتر', 'آخر أمونيا / نيتريت', ''].map(function(c){ return '<th style="' + th + '">' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
  R.secs.forEach(function(S, i){
    var a = S.series[0], b = S.series[S.series.length - 1], lc = function(v){ return v == null ? '—' : '<b style="color:' + (v > 100 ? 'var(--red)' : v > 85 ? 'var(--amber)' : 'var(--green)') + '">' + Math.round(v) + '%</b>'; };
    var warnTan = S.tan && S.tan.v > cfg.tanOk ? ' <span title="الأمونيا أعلى من ' + cfg.tanOk + '" style="color:var(--red)">⚠️</span>' : '';
    h += '<tr style="border-bottom:1px solid var(--line)"><td style="' + th + ';font-weight:800">' + daSecNo(S.sec) + '</td><td style="' + th + '">' + f1(S.temp) + '°</td>'
      + '<td style="' + th + '">' + Math.round(a.bio).toLocaleString() + ' ← ' + Math.round(b.bio).toLocaleString() + '</td><td style="' + th + '">' + f1(a.feed) + ' ← ' + f1(b.feed) + '</td>'
      + '<td style="' + th + '">' + f1(a.tan, 2) + ' ← ' + f1(b.tan, 2) + '</td><td style="' + th + '">' + f1(a.o2) + ' ← ' + f1(b.o2) + '</td>'
      + '<td style="' + th + '" data-load="' + (a.load == null ? '' : a.load.toFixed(1)) + '">' + lc(a.load) + ' ← ' + lc(b.load) + '</td>'
      + '<td style="' + th + '">' + (S.tan ? f1(S.tan.v, 2) : '—') + ' / ' + (S.no2 ? f1(S.no2.v, 2) : '—') + warnTan + (S.tan ? '<div style="font-size:10px;color:var(--muted)">' + S.tan.date + '</div>' : '') + '</td>'
      + '<td style="' + th + '"><button onclick="window._tw.open=' + i + ';show(&quot;twin&quot;,true)" style="border:1px solid var(--line);background:#fff;border-radius:6px;cursor:pointer;padding:3px 8px">📈</button></td></tr>';
  });
  h += '</tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:6px">حمل الفلتر = الأمونيا الناتجة ÷ الأمونيا عند أعلى علف اتجرب والأمونيا فضلت ≤ ' + cfg.tanOk + '. أكتر من 100% = برّه المجرَّب، مش بالضرورة فشل.</div></div>';
  var S0 = R.secs[st.open || 0] || R.secs[0];
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">📈 سكشن ' + daSecNo(S0.sec) + ' — النفوق ' + (S0.mort * 100).toFixed(3) + '%/يوم · أعلى علف اتجرب ' + f1(S0.provenFeed) + ' كجم/يوم' + (S0.obs.kg ? ' (من قراياتكم ' + S0.obs.date + ')' : '') + '</div>' + daTwinChart(S0, R.H) + '</div>';
  h += daTwinWeeklyCard(st.farm, R) + daTwinCfgCard(st.farm, cfg, can);
  return h;
}
function daTwinWeeklyCard(farm, R){
  var inp = 'padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px;width:80px;text-align:center';
  var h = '<div class="card" style="margin-bottom:12px"><div class="card-title">🧪 قرايات الأمونيا والنيتريت الأسبوعية</div><div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:8px"><div class="field" style="margin:0"><label>التاريخ</label><input type="date" id="tw-wdate" data-nodirty="1" value="' + daToday() + '" max="' + daToday() + '" style="' + inp + ';width:auto"/></div></div>'
    + '<div style="overflow-x:auto"><table class="wqs-t" dir="ltr"><thead><tr><th>Section</th><th>NH₃/TAN (mg/L)</th><th>NO₂ (mg/L)</th></tr></thead><tbody>';
  R.secs.forEach(function(S, i){ h += '<tr><td class="wqs-sec">S-' + ('0' + daSecNo(S.sec)).slice(-2) + '</td><td><input id="tw-nh-' + i + '" inputmode="decimal" style="' + inp + '"/></td><td><input id="tw-no-' + i + '" inputmode="decimal" style="' + inp + '"/></td></tr>'; });
  return h + '</tbody></table></div><button id="tw-wsave" class="savebtn" style="width:auto;padding:8px 18px;margin-top:8px" onclick="daTwinSaveWeekly()">💾 حفظ القرايات</button>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:6px">كل قراية أمونيا مظبوطة بتتسجل مع علف السكشن في الأسبوع ده، والنموذج بيرفع "أعلى علف اتجرب" لوحده.</div></div>';
}
function daTwinSaveWeekly(){
  var st = window._tw, R = daTwinRun(st.farm, st), date = (document.getElementById('tw-wdate') || {}).value || daToday(), n = 0, bad = [];
  R.secs.forEach(function(S, i){
    var a = String((document.getElementById('tw-nh-' + i) || {}).value || '').trim(), b = String((document.getElementById('tw-no-' + i) || {}).value || '').trim();
    if(!a && !b) return; var va = a === '' ? null : parseFloat(a), vb = b === '' ? null : parseFloat(b);
    if((a && !(va >= 0 && va < 50)) || (b && !(vb >= 0 && vb < 50))){ bad.push(daSecNo(S.sec)); return; }
    var id = 'wn-' + S.sec + '-' + date, old = getTX().filter(function(t){ return t.id === id && !t.deleted; })[0], rec = {ammonia:va, nitrite:vb};
    if(old) updateTX(id, rec); else addTX(Object.assign({id:id, type:'water_quality', date:date, unit:S.sec, scope:'section', section:S.sec, source:'weekly-n', _skipValidation:true}, rec));
    n++; });
  if(bad.length){ toast('⚠️ أرقام مش منطقية في سكشن ' + bad.join('، ')); return; }
  toast(n ? '✅ اتحفظت قرايات ' + n + ' سكشن' : 'مفيش قرايات'); show('twin', true);
}
function daTwinCfgCard(farm, cfg, can){
  if(!can) return '';
  var inp = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px;width:90px', f = function(k, lbl, step){ return '<div class="field" style="margin:0"><label>' + lbl + '</label><input type="number" step="' + (step || 'any') + '" id="tw-c-' + k + '" data-nodirty="1" value="' + cfg[k] + '" style="' + inp + '"/></div>'; };
  return '<details class="card"><summary style="cursor:pointer;font-weight:700">⚙️ بيانات النموذج — ' + daEsc(farm) + '</summary><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:flex-end">'
    + f('provenFeed', 'أعلى علف اتجرب للسكشن (كجم/يوم)') + f('tanOk', 'والأمونيا فضلت ≤ (mg/L)') + f('media', 'ميديا الفلتر (م³)') + f('ssa', 'المساحة النوعية (م²/م³)')
    + f('prot1', 'بروتين 1مم %') + f('prot2', 'بروتين 2مم %') + f('prot3', 'بروتين 3مم %') + f('o2PerFeed', 'كجم O₂ لكل كجم علف') + f('tgc', 'TGC افتراضي') + f('temp', 'حرارة افتراضية °م')
    + '<button class="savebtn" style="width:auto;padding:8px 16px" onclick="daTwinSaveCfg()">💾 حفظ</button></div>'
    + (cfg.media > 0 && cfg.provenFeed > 0 ? '<div style="font-size:12px;color:var(--muted);margin-top:8px">معدل إزالة الأمونيا المجرَّب: <b>' + (cfg.provenFeed * cfg.prot3 / 100 * 0.092 * 1000 / (cfg.media * cfg.ssa)).toFixed(2) + ' جم TAN/م²/يوم</b></div>' : '') + '</details>';
}
function daTwinSaveCfg(){
  var farm = window._tw.farm, a = {}; try{ a = JSON.parse(localStorage.getItem(DA_TWIN_KEY) || '{}') || {}; }catch(e){}
  var c = {}; Object.keys(DA_TWIN_DEF).forEach(function(k){ var v = parseFloat((document.getElementById('tw-c-' + k) || {}).value); c[k] = isNaN(v) ? DA_TWIN_DEF[k] : v; });
  a[farm] = c; localStorage.setItem(DA_TWIN_KEY, JSON.stringify(a)); toast('✅ اتحفظت بيانات النموذج — ' + farm); show('twin', true);
}
// ── registration ──
VIEWS['twin'] = renderTwin; VIEW_PERMS['twin'] = 'view_growth';
(function(){ var g = DA_NAV.filter(function(x){ return x.id === 'analysis'; })[0];
  if(g && !g.items.some(function(i){ return i[0] === 'twin'; })) g.items.splice(0, 0, ['twin', '🧬', 'التوأم الرقمي', 'Digital Twin']); })();
