// ══════════════════════════════════════════════════════════
//  MORTALITY CAUSES (optional) + HARVEST-SOON ALERT (14 days)
// ══════════════════════════════════════════════════════════
// Causes: one farm-wide list (synced key, prefix daracqua_settings_v2). Cause is never required:
// the first option is blank. New entries store the Arabic label; old keys (disease, oxygen…) are mapped for display.
var DA_CAUSE_KEY = 'daracqua_settings_v2_mortcauses';
var DA_CAUSE_DEFAULT = ['نقص أكسجين', 'مرض', 'إجهاد', 'جودة مياه', 'تداول', 'إصابة', 'طبيعي', 'أخرى'];
var DA_CAUSE_LEGACY = {unknown:'غير محدد', oxygen:'نقص أكسجين', disease:'مرض', stress:'إجهاد', handling:'تداول', other:'أخرى'};
function daCauseList(){
  try{ var a = JSON.parse(localStorage.getItem(DA_CAUSE_KEY) || 'null'); if(Array.isArray(a) && a.length) return a; }catch(e){}
  return DA_CAUSE_DEFAULT.slice();
}
function daSetCauseList(list){
  var seen = {}, out = [];
  (list || []).forEach(function(c){ c = String(c || '').trim(); if(c && !seen[c]){ seen[c] = 1; out.push(c); } });
  if(out.length) localStorage.setItem(DA_CAUSE_KEY, JSON.stringify(out)); else localStorage.removeItem(DA_CAUSE_KEY);
  return daCauseList();
}
function daCauseLabel(c){ c = String(c || '').trim(); return c ? (DA_CAUSE_LEGACY[c] || c) : 'غير محدد'; }
// <option>s for a cause <select>; keeps a saved value that is no longer in the list so re-saving never loses it.
function daCauseOptions(cur){
  var lbl = cur ? daCauseLabel(cur) : '', list = daCauseList();
  if(lbl && list.indexOf(lbl) < 0) list.push(lbl);
  return '<option value="">— بدون سبب —</option>' + list.map(function(c){
    return '<option value="' + daEsc(c) + '"' + (c === lbl ? ' selected' : '') + '>' + daEsc(c) + '</option>'; }).join('');
}
function daCauseEditorCard(){
  return '<div class="card" style="margin-bottom:14px"><div class="card-title">💀 أسباب النفوق <span style="font-size:11px;font-weight:400;color:var(--muted)">(اختيارية — سبب في كل سطر)</span></div>'
    + '<textarea id="da-causes" rows="6" style="width:100%;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px">' + daEsc(daCauseList().join('\n')) + '</textarea>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:4px">القايمة واحدة لكل المزارع. تسجيل النفوق من غير سبب مسموح دايماً. السجلات القديمة مش بتتغير.</div></div>';
}
function daSaveCauseEditor(){
  var el = document.getElementById('da-causes'); if(!el) return;
  daSetCauseList(el.value.split('\n'));
}

// ── harvest-soon alert ──
// Per unit: SGR from the last sample and an earlier sample ≥7 days before it (else stocking weight/date),
// projected from the LAST SAMPLE DATE (back-dated entries stay correct), compared to the farm's harvest target.
function daHarvestTargetFor(farm){
  return parseFloat((getSettings(farm) || {}).harvestTargetWt) || parseFloat((getSettings('all') || {}).harvestTargetWt) || 0;
}
function daHarvestProjection(r, samples, today){
  var target = daHarvestTargetFor(r.farm);
  if(!target) return null;
  var s = (samples || []).filter(function(t){ return (t.avgWt || 0) > 0 && t.date && t.date <= today; })
    .sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  if(!s.length) return null;
  var last = s[s.length - 1], w = last.avgWt, base = null;
  for(var i = s.length - 2; i >= 0; i--){ if(daDaysBetween(s[i].date, last.date) >= 7){ base = {wt:s[i].avgWt, date:s[i].date}; break; } }
  if(!base){ var u = daRawUnit(r.unit) || {}; if(u.startWt > 0 && u.startDate && daDaysBetween(u.startDate, last.date) >= 7) base = {wt:u.startWt, date:u.startDate}; }
  if(!base || w >= target) return null;                     // no growth data, or already at target (the "ready" alert covers it)
  var sgr = computeSGR(base.wt, w, daDaysBetween(base.date, last.date));
  if(!(sgr > 0 && sgr <= 6)) return null;                     // no growth / implausible
  var date = daAddDays(last.date, Math.ceil(Math.log(target / w) / (sgr / 100)));
  return {unit:r.unit, target:target, wt:w, sgr:sgr, date:date, days:daDaysBetween(today, date), sampleAge:daDaysBetween(last.date, today), fish:r.fishNo || 0};
}
function daHarvestSoon(windowDays){
  var today = daToday(), W = windowDays == null ? 14 : windowDays, byUnit = {};
  getTX().forEach(function(t){ if(t.type === 'sampling' && t.unit) (byUnit[t.unit] = byUnit[t.unit] || []).push(t); });
  var secs = {};
  daRows().forEach(function(r){
    if(daIsBrood(r.unit)) return;
    var p = daHarvestProjection(r, byUnit[r.unit], today);
    if(!p || p.days > W) return;
    var sec = r.section || (daRawUnit(r.unit) || {}).section || r.farm || '—';
    (secs[sec] = secs[sec] || {section:sec, farm:r.farm || '', units:[]}).units.push(p);
  });
  return Object.keys(secs).sort().map(function(k){
    var g = secs[k]; g.units.sort(function(a, b){ return a.days - b.days; });
    g.minDays = g.units[0].days; g.date = g.units[0].date;
    g.fish = g.units.reduce(function(s, u){ return s + u.fish; }, 0);
    g.kg = g.units.reduce(function(s, u){ return s + u.fish * u.target / 1000; }, 0);
    return g;
  });
}
function daHarvestSoonAlerts(){
  return daHarvestSoon(14).map(function(g){
    var when = g.minDays <= 0 ? 'غالباً وصل الوزن — اعمل عينة للتأكيد' : 'خلال ' + g.minDays + ' يوم (' + g.date + ')';
    var old = g.units.filter(function(u){ return u.sampleAge > 21; }).length;
    return {level:g.minDays <= 7 ? 'warn' : 'info', icon:'🎣', title:'حصاد قريب — ' + g.section, unit:'', section:g.section,
      msg:g.section + ': ' + g.units.length + ' تانك · ' + when + ' · ~' + Math.round(g.kg).toLocaleString() + ' كجم (' + g.fish.toLocaleString() + ' سمكة) — '
        + g.units.map(function(u){ return u.unit + ' ' + (u.days <= 0 ? 'الآن' : u.days + 'ي'); }).join('، ')
        + (old ? ' · ⚠️ ' + old + ' تانك آخر عينة أقدم من 3 أسابيع' : ''),
      action:'harvest-planner'};
  });
}
if(!window._daHarvestSoonWrapped){
  window._daHarvestSoonWrapped = true;
  var _genAlertsPreHarvest = generateAlerts;
  generateAlerts = function(){
    var a = [];
    try{ a = _genAlertsPreHarvest.apply(this, arguments) || []; }catch(e){ a = []; }
    try{ a = a.concat(daHarvestSoonAlerts()); }catch(e){ console.warn('harvest-soon alerts:', e); }
    return a;
  };
}
