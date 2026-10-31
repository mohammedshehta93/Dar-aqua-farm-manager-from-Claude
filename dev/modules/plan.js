// ══════════════════════════════════════════════════════════
//  FARM PRODUCTION PLAN — optional, advisory, linked automatically
// ══════════════════════════════════════════════════════════
// Nothing here is required and nothing is blocked by it. A plan is a list of batches (stocking date, count, weight,
// harvest weight) moving through the farm's stages (F2: S1–3 → S4–5 → S6–16). The growth model is the digital twin's
// (farm TGC from its own samples, measured temperature, last-28-day mortality). From it: transfer and harvest dates,
// harvest kg, stage occupancy against capacity (density warning limit), weekly feed by pellet size. "Goal" mode works
// backwards from kg per month. Plan vs actual: real stocking records match a batch by batch name, else by date ±7 days.
var DA_PLAN_FKEY = 'daracqua_plan_v1_farmplan';   // synced: {farm: {stages:[{from,to,until,name}], batches:[...], goal:{...}}}
function daPlanAll(){ try{ return JSON.parse(localStorage.getItem(DA_PLAN_FKEY) || '{}') || {}; }catch(e){ return {}; } }
function daPlanOf(farm){ var p = daPlanAll()[farm] || {}; p.stages = p.stages && p.stages.length ? p.stages : [{from:1, to:999, until:0, name:'كل السكاشن'}]; p.batches = p.batches || []; p.goal = p.goal || {}; return p; }
function daPlanSave(farm, p){ var a = daPlanAll(); a[farm] = p; localStorage.setItem(DA_PLAN_FKEY, JSON.stringify(a)); }
function daPlanStagesText(p){ return p.stages.map(function(s){ return s.from + '-' + (s.to >= 999 ? '' : s.to) + ' = ' + (s.name || '') + (s.until ? ' | ' + s.until : ''); }).join('\n'); }
function daPlanParseStages(t){
  var out = [], bad = [];
  String(t || '').split('\n').forEach(function(l, i){ l = l.trim(); if(!l) return;
    var m = l.match(/^(\d+)\s*-\s*(\d*)\s*=\s*([^|]*?)\s*(?:\|\s*(\d+(?:\.\d+)?))?\s*$/); if(!m){ bad.push(i + 1); return; }
    out.push({from:+m[1], to:m[2] === '' ? 999 : +m[2], name:m[3], until:m[4] ? +m[4] : 0}); });
  return {stages:out, bad:bad};
}
// growth basis = the digital twin's farm values
function daPlanBasis(farm){
  var cfg = daTwinCfg(farm), R = daTwinRun(farm, {days:1, feedPct:100, dT:0}), units = {}, temps = [];
  R.secs.forEach(function(S){ temps.push(S.temp); Object.assign(units, S.units); });
  return {cfg:cfg, tgc:R.fTGC || cfg.tgc, temp:daMedian(temps) || cfg.temp, mort:daTwinMortRate(units, daToday())};
}
function daPlanStageCap(farm, st){   // biomass that fits at the density WARNING limit
  var lim = daFarmLIM(farm), vol = 0, tanks = 0;
  _txLiveRows().concat([]).forEach(function(r){ if((r.farm !== farm && String(r.unit).indexOf(farm + '.') !== 0) || daIsBrood(r.unit)) return; var n = daTankNo(r.unit); if(!n || n.s < st.from || n.s > st.to) return;
    tanks++; vol += (daRawUnit(r.unit) || {}).volume || r.volume || 0; });
  return {tanks:tanks, vol:vol, kg:vol * lim.densWarn};
}
function daPlanSim(farm, b, B, p, days){
  var w = +b.wt || 1, n = +b.count || 0, d0 = b.date, ev = [], st = 0, out = [], stg = p.stages, target = +b.target || daHarvestTargetFor(farm) || 450;
  for(var d = 0; d <= (days || 400); d++){
    if(d > 0){ w = Math.pow(Math.cbrt(w) + B.tgc * B.temp / 1000, 3); n *= (1 - B.mort); }
    while(st < stg.length - 1 && stg[st].until && w >= stg[st].until){ st++; ev.push({type:'move', d:d, date:daAddDays(d0, d), to:st, w:w, n:n}); }
    var feed = n * w / 1000 * getSFRAdjusted(w, farm, B.temp, 6) / 100;
    out.push({d:d, date:daAddDays(d0, d), w:w, n:n, bio:n * w / 1000, st:st, feed:feed, size:daSizeOf(daFcrStages()[daStageOf(w)].label) || ''});
    if(w >= target){ ev.push({type:'harvest', d:d, date:daAddDays(d0, d), w:w, n:n, kg:n * w / 1000}); break; }
  }
  return {b:b, ev:ev, days:out, harvest:ev.filter(function(e){ return e.type === 'harvest'; })[0] || null};
}
var _plMemo = {v:-1, m:{}};
function daPlanRun(farm){   // cached until data or the plan changes (plan key is synced → bumps _dataVer)
  if(_plMemo.v !== _dataVer) _plMemo = {v:_dataVer, m:{}};
  return _plMemo.m[farm] || (_plMemo.m[farm] = daPlanRunCore(farm));
}
function daPlanRunCore(farm){
  var p = daPlanOf(farm), B = daPlanBasis(farm), sims = p.batches.map(function(b){ return daPlanSim(farm, b, B, p); });
  var caps = p.stages.map(function(s){ return daPlanStageCap(farm, s); }), today = daToday(), over = [];
  // stage occupancy by week for 26 weeks
  var weeks = []; for(var k = 0; k < 26; k++){ var day = daAddDays(today, k * 7), row = {date:day, bio:p.stages.map(function(){ return 0; })};
    sims.forEach(function(S){ S.days.forEach(function(z){ if(z.date === day) row.bio[z.st] += z.bio; }); });
    row.bio.forEach(function(v, i){ if(caps[i].kg > 0 && v > caps[i].kg && !over.some(function(o){ return o.st === i; })) over.push({st:i, date:day, kg:v, cap:caps[i].kg}); });
    weeks.push(row); }
  // weekly feed by pellet size, next 12 weeks
  var feed = []; for(var w = 0; w < 12; w++){ var from = daAddDays(today, w * 7), to = daAddDays(from, 6), f = {from:from}; 
    sims.forEach(function(S){ S.days.forEach(function(z){ if(z.date >= from && z.date <= to){ var k2 = z.size || '?'; f[k2] = (f[k2] || 0) + z.feed; } }); }); feed.push(f); }
  return {farm:farm, p:p, B:B, sims:sims, caps:caps, weeks:weeks, over:over, feed:feed};
}
// plan vs actual: stocking records matched by batch name, else date ±7 days (never required)
function daPlanActual(farm, b){
  var st = getTX().filter(function(t){ return t.type === 'stocking' && !t.deleted && String(t.unit).indexOf(farm + '.') === 0; });
  var byName = b.name ? st.filter(function(t){ return t.batch && String(t.batch).trim() === String(b.name).trim(); }) : [];
  var hit = byName.length ? byName : st.filter(function(t){ return Math.abs(daDaysBetween(b.date, t.date)) <= 7; });
  if(!hit.length) return null;
  var n = hit.reduce(function(a, t){ return a + (parseInt(t.fishNo || t.count) || 0); }, 0), w = hit.reduce(function(a, t){ return a + (parseInt(t.fishNo || t.count) || 0) * (parseFloat(t.avgWt) || 0); }, 0) / Math.max(1, n);
  return {by:byName.length ? 'name' : 'date', n:n, wt:w, date:hit.map(function(t){ return t.date; }).sort()[0], units:hit.length};
}
// goal mode: kg per month → stocking needed per month
function daPlanGoal(farm, g, B, p){
  var kg = +g.kgMonth || 0, target = +g.target || daHarvestTargetFor(farm) || 450, wt = +g.wt || 1; if(!kg) return null;
  var probe = daPlanSim(farm, {date:daToday(), count:1000, wt:wt, target:target}, B, p), h = probe.harvest; if(!h) return null;
  var surv = h.n / 1000, perMonth = Math.ceil(kg / (target / 1000) / surv / 100) * 100, list = [];
  for(var m = 0; m < 6; m++){ var hd = daAddDays(daToday(), h.d + m * 30); list.push({stock:daAddDays(hd, -h.d), harvest:hd, count:perMonth}); }
  return {days:h.d, surv:surv, perMonth:perMonth, list:list, target:target, wt:wt};
}
function renderFarmPlan(){
  var st = window._pl = window._pl || {}, farms = daFarms(); if(farmFilter && farmFilter !== 'all') st.farm = farmFilter; if(!st.farm || farms.indexOf(st.farm) < 0) st.farm = farms[farms.length - 1] || '';
  var R = daPlanRun(st.farm), p = R.p, can = ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0, inp = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px';
  var f0 = function(v){ return Math.round(v).toLocaleString(); }, th = 'padding:7px 6px;white-space:nowrap';
  var h = '<div class="ph"><div><h2>🗓️ خطة المزرعة</h2><p style="font-size:11px;color:var(--muted)">اختيارية — بتقترح وتقارن وتنبّه، ومش بتمنع أي إدخال. النمو من التوأم الرقمي: TGC ' + R.B.tgc.toFixed(2) + ' · حرارة ' + R.B.temp.toFixed(1) + '° · نفوق ' + (R.B.mort * 100).toFixed(3) + '%/يوم</p></div></div>';
  if(!(farmFilter && farmFilter !== 'all')) h += '<div class="card" style="margin-bottom:12px"><div class="field" style="margin:0"><label>المزرعة</label><select id="pl-farm" style="' + inp + '" onchange="window._pl.farm=this.value;show(&quot;farm-plan&quot;,true)">' + farms.map(function(f){ return '<option' + (f === st.farm ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div></div>';
  // stages + capacity
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🔁 مسار السمك والسعة</div><div style="display:flex;gap:8px;flex-wrap:wrap">' + p.stages.map(function(s, i){ var c = R.caps[i];
    return '<div style="border:1px solid var(--line);border-radius:8px;padding:8px 12px;min-width:150px"><b>' + daEsc(s.name || ('مرحلة ' + (i + 1))) + '</b><div style="font-size:12px;color:var(--muted)">سكاشن ' + s.from + (s.to >= 999 ? '+' : '–' + s.to) + (s.until ? ' · لحد ' + s.until + 'g' : ' · لحد الحصاد') + '</div><div style="font-size:12px">' + c.tanks + ' تانك · ' + f0(c.vol) + ' م³ · سعة ~' + f0(c.kg) + ' كجم</div></div>' + (i < p.stages.length - 1 ? '<div style="align-self:center">←</div>' : ''); }).join('') + '</div>'
    + (can ? '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px">⚙️ تعديل المسار</summary><div style="font-size:11px;color:var(--muted);margin:6px 0">سطر لكل مرحلة: <code>السكاشن = الاسم | ينقل عند وزن (جم)</code> — آخر مرحلة من غير وزن = لحد الحصاد</div><textarea id="pl-stages" data-nodirty="1" rows="3" dir="ltr" style="width:100%;' + inp + ';font-family:monospace">' + daEsc(daPlanStagesText(p)) + '</textarea><button class="savebtn" style="width:auto;padding:7px 14px;margin-top:6px" onclick="daPlanSaveStages()">💾 حفظ المسار</button></details>' : '') + '</div>';
  // upcoming events
  var ev = [], today = daToday(); R.sims.forEach(function(S){ S.ev.forEach(function(e){ if(e.date >= today && daDaysBetween(today, e.date) <= 60) ev.push({date:e.date, t:(e.type === 'harvest' ? '🎣 حصاد ' : '🔁 نقل ') + daEsc(S.b.name || S.b.date) + (e.type === 'harvest' ? ' — ~' + f0(e.kg) + ' كجم (' + Math.round(e.w) + 'g)' : ' إلى ' + daEsc(p.stages[e.to].name || ('مرحلة ' + (e.to + 1))) + ' (' + Math.round(e.w) + 'g)')}); }); });
  R.over.forEach(function(o){ ev.push({date:o.date, t:'⚠️ ' + daEsc(p.stages[o.st].name || ('مرحلة ' + (o.st + 1))) + ' مش هتكفي: ' + f0(o.kg) + ' كجم والسعة ~' + f0(o.cap)}); });
  ev.sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">📅 الجاي (60 يوم)</div>' + (ev.length ? '<ul style="margin:0;padding-inline-start:18px;line-height:1.9;font-size:13px">' + ev.map(function(e){ return '<li><b>' + e.date + '</b> — ' + e.t + '</li>'; }).join('') + '</ul>' : '<div style="color:var(--muted);font-size:13px">' + (p.batches.length ? 'مفيش أحداث في الـ 60 يوم الجايين.' : 'ضيف دفعة تحت أو استخدم "هدف الحصاد".') + '</div>') + '</div>';
  // batches
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🐟 الدفعات</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--deep);color:#fff">'
    + ['الدفعة', 'تخزين', 'العدد', 'وزن البداية', 'النقل', 'الحصاد', 'كجم حصاد', 'الفعلي', ''].map(function(c){ return '<th style="' + th + '">' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
  R.sims.forEach(function(S, i){ var b = S.b, A = daPlanActual(st.farm, b), mv = S.ev.filter(function(e){ return e.type === 'move'; });
    h += '<tr style="border-bottom:1px solid var(--line)"><td style="' + th + ';font-weight:700">' + daEsc(b.name || '—') + '</td><td style="' + th + '">' + b.date + '</td><td style="' + th + '">' + f0(b.count) + '</td><td style="' + th + '">' + b.wt + 'g</td>'
      + '<td style="' + th + '">' + (mv.map(function(e){ return e.date; }).join('<br>') || '—') + '</td><td style="' + th + '">' + (S.harvest ? S.harvest.date + ' (' + S.harvest.d + 'ي)' : 'بعد 400 يوم') + '</td><td style="' + th + '">' + (S.harvest ? f0(S.harvest.kg) : '—') + '</td>'
      + '<td style="' + th + '">' + (A ? '<span title="' + (A.by === 'name' ? 'مربوط باسم الدفعة' : 'مربوط بالتاريخ') + '">✔ ' + f0(A.n) + ' سمكة · ' + Math.round(A.wt) + 'g' + (Math.abs(A.n - b.count) / Math.max(1, b.count) > 0.1 ? ' <b style="color:var(--amber)">(' + (A.n > b.count ? '+' : '') + Math.round((A.n / b.count - 1) * 100) + '%)</b>' : '') + '</span>' : (b.date <= today ? '<span style="color:var(--muted)">لسه متخزنتش</span>' : '—')) + '</td>'
      + '<td style="' + th + '">' + (can ? '<button onclick="daPlanDel(' + i + ')" style="border:1px solid var(--line);background:#fff;border-radius:6px;cursor:pointer;padding:2px 8px">✕</button>' : '') + '</td></tr>'; });
  h += '</tbody></table></div>';
  if(can) h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:10px">'
    + [['pl-name', 'اسم الدفعة', 'text', ''], ['pl-date', 'تاريخ التخزين', 'date', daToday()], ['pl-count', 'العدد', 'number', ''], ['pl-wt', 'وزن البداية (جم)', 'number', ''], ['pl-target', 'وزن الحصاد (جم)', 'number', daHarvestTargetFor(st.farm) || '']].map(function(f){
      return '<div class="field" style="margin:0"><label>' + f[1] + '</label><input id="' + f[0] + '" data-nodirty="1" type="' + f[2] + '" value="' + f[3] + '" style="' + inp + ';width:' + (f[2] === 'date' ? 'auto' : '110px') + '"/></div>'; }).join('')
    + '<button class="savebtn" style="width:auto;padding:8px 16px" onclick="daPlanAdd()">➕ ضيف دفعة</button></div>';
  h += '</div>';
  // goal mode
  var G = daPlanGoal(st.farm, p.goal, R.B, p);
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🎯 هدف الحصاد</div>' + (can ? '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">'
    + [['pl-gkg', 'كجم حصاد في الشهر', p.goal.kgMonth || ''], ['pl-gwt', 'وزن التخزين (جم)', p.goal.wt || ''], ['pl-gtarget', 'وزن الحصاد (جم)', p.goal.target || '']].map(function(f){ return '<div class="field" style="margin:0"><label>' + f[1] + '</label><input id="' + f[0] + '" data-nodirty="1" type="number" value="' + f[2] + '" style="' + inp + ';width:110px"/></div>'; }).join('')
    + '<button class="savebtn" style="width:auto;padding:8px 16px" onclick="daPlanSaveGoal()">احسب</button></div>' : '')
    + (G ? '<div style="font-size:13px;margin-top:10px;line-height:1.9">الدورة ~<b>' + G.days + ' يوم</b> من ' + G.wt + 'g لـ ' + G.target + 'g، والحياة ~<b>' + Math.round(G.surv * 100) + '%</b> → محتاج تخزّن <b>' + f0(G.perMonth) + ' سمكة كل شهر</b>.</div><table style="font-size:12px;border-collapse:collapse;margin-top:6px"><tr style="background:#f1f5f9"><th style="padding:5px 10px">تخزين</th><th style="padding:5px 10px">حصاد</th><th style="padding:5px 10px">العدد</th><th></th></tr>'
      + G.list.map(function(x, i){ return '<tr><td style="padding:5px 10px">' + x.stock + '</td><td style="padding:5px 10px">' + x.harvest + '</td><td style="padding:5px 10px">' + f0(x.count) + '</td><td>' + (can ? '<button id="pl-gadd-' + i + '" onclick="daPlanAddGoal(' + i + ')" style="border:1px solid var(--line);background:#fff;border-radius:6px;cursor:pointer;padding:2px 8px;font-size:11px">➕ للخطة</button>' : '') + '</td></tr>'; }).join('') + '</table>' : '<div style="font-size:12px;color:var(--muted);margin-top:6px">اكتب كام كيلو عايزين تحصدوا في الشهر، والأداة تحسب تخزّنوا إمتى وقد إيه.</div>') + '</div>';
  // feed
  var sizes = {}; R.feed.forEach(function(f){ Object.keys(f).forEach(function(k){ if(k !== 'from') sizes[k] = 1; }); }); var sz = Object.keys(sizes).sort();
  if(sz.length) h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🌾 علف الخطة — 12 أسبوع</div><div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="padding:5px 10px">الأسبوع</th>' + sz.map(function(k){ return '<th style="padding:5px 10px">' + (k === '?' ? '—' : k + ' مم') + ' (كجم)</th>'; }).join('') + '</tr>'
    + R.feed.map(function(f){ return '<tr><td style="padding:5px 10px">' + f.from + '</td>' + sz.map(function(k){ return '<td style="padding:5px 10px">' + (f[k] ? f0(f[k]) : '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div><div style="font-size:11px;color:var(--muted);margin-top:4px">علف دفعات الخطة بس — السمك الموجود في التانكات دلوقتي في توقع العلف والشراء.</div></div>';
  return h;
}
function daPlanSaveStages(){ var r = daPlanParseStages((document.getElementById('pl-stages') || {}).value); if(r.bad.length || !r.stages.length){ toast('⚠️ السطر ' + r.bad.join('، ') + ' مش مفهوم — مثال: 1-3 = تحضين | 50'); return; }
  var p = daPlanOf(window._pl.farm); p.stages = r.stages; daPlanSave(window._pl.farm, p); toast('✅ اتحفظ المسار'); show('farm-plan', true); }
function daPlanAdd(){
  var g = function(id){ return String((document.getElementById(id) || {}).value || '').trim(); }, b = {name:g('pl-name'), date:g('pl-date'), count:+g('pl-count'), wt:+g('pl-wt'), target:+g('pl-target') || 0};
  if(!b.date || !(b.count > 0) || !(b.wt > 0)){ toast('⚠️ اكتب التاريخ والعدد ووزن البداية'); return; }
  var p = daPlanOf(window._pl.farm); p.batches.push(b); p.batches.sort(function(x, y){ return x.date < y.date ? -1 : 1; }); daPlanSave(window._pl.farm, p); toast('✅ اتضافت الدفعة'); show('farm-plan', true);
}
function daPlanDel(i){ var p = daPlanOf(window._pl.farm), b = p.batches[i]; if(!b || !confirm('تشيل الدفعة ' + (b.name || b.date) + ' من الخطة؟ (مش بتمس أي بيانات فعلية)')) return; p.batches.splice(i, 1); daPlanSave(window._pl.farm, p); show('farm-plan', true); }
function daPlanSaveGoal(){ var p = daPlanOf(window._pl.farm), g = function(id){ return +((document.getElementById(id) || {}).value || 0); };
  p.goal = {kgMonth:g('pl-gkg'), wt:g('pl-gwt') || 1, target:g('pl-gtarget') || 0}; daPlanSave(window._pl.farm, p); show('farm-plan', true); }
function daPlanAddGoal(i){ var farm = window._pl.farm, p = daPlanOf(farm), G = daPlanGoal(farm, p.goal, daPlanBasis(farm), p); if(!G) return; var x = G.list[i];
  p.batches.push({name:'هدف ' + x.stock.slice(0, 7), date:x.stock, count:x.count, wt:G.wt, target:G.target}); p.batches.sort(function(a, b){ return a.date < b.date ? -1 : 1; }); daPlanSave(farm, p); toast('✅ اتضافت للخطة'); show('farm-plan', true); }
// advisory alerts (info only): plan events in the next 7 days, stage capacity overflow within 4 weeks
function daPlanAlerts(){
  var out = [], today = daToday();
  daFarms().forEach(function(farm){ if(farmFilter && farmFilter !== 'all' && farm !== farmFilter) return; var p = daPlanOf(farm); if(!p.batches.length) return;
    var R = daPlanRun(farm);
    R.sims.forEach(function(S){ S.ev.forEach(function(e){ var dd = daDaysBetween(today, e.date); if(dd < 0 || dd > 7) return;
      out.push({level:'info', icon:'🗓️', unit:'', section:farm, title:'الخطة: ' + (e.type === 'harvest' ? 'حصاد ' : 'نقل ') + (S.b.name || S.b.date) + ' خلال ' + dd + ' يوم', msg:farm + ' — ' + e.date + (e.type === 'harvest' ? ' · ~' + Math.round(e.kg).toLocaleString() + ' كجم' : ' · إلى ' + (p.stages[e.to].name || '')), action:'farm-plan'}); }); });
    R.over.forEach(function(o){ if(daDaysBetween(today, o.date) <= 28) out.push({level:'warn', icon:'🗓️', unit:'', section:farm, title:'الخطة: ' + (p.stages[o.st].name || 'مرحلة') + ' مش هتكفي', msg:farm + ' — من ' + o.date + ': ' + Math.round(o.kg).toLocaleString() + ' كجم والسعة ~' + Math.round(o.cap).toLocaleString(), action:'farm-plan'}); });
  });
  return out;
}
// ── registration ──
VIEWS['farm-plan'] = renderFarmPlan; VIEW_PERMS['farm-plan'] = 'view_growth';
(function(){ var g = DA_NAV.filter(function(x){ return x.id === 'prod'; })[0];
  if(g && !g.items.some(function(i){ return i[0] === 'farm-plan'; })) g.items.splice(0, 0, ['farm-plan', '🗓️', 'خطة المزرعة', 'Farm Plan']); })();
if(!window._daPlanWrapped){ window._daPlanWrapped = true; var _genAlertsPrePlan = generateAlerts;
  generateAlerts = function(){ var a = []; try{ a = _genAlertsPrePlan.apply(this, arguments) || []; }catch(e){ a = []; } try{ a = a.concat(daPlanAlerts()); }catch(e){ console.warn('plan alerts:', e); } return a; }; }
