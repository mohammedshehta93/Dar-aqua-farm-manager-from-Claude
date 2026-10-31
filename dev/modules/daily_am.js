// ══════════════════════════════════════════════════════════
//  DAILY OVERVIEW FROM THE RECORDS (replaces frozen snapshots)
// ══════════════════════════════════════════════════════════
// The old page showed snapshots taken when the app was opened: entries made later (the farm enters feed at the end of
// the week) never reached them, and days the app was not opened did not exist. Now every day is computed from the
// records: stock at the end of the day, feed / dead / harvest of that day, and how many stocked tanks have feed entered.
function daUnitEndSeries(unit, days){   // end-of-day state for several days with ONE replay of the tank
  var last = days[days.length - 1], s = daSimulateUnit(unit, (daTxByUnit()[unit] || []).filter(function(t){ return String(t.date || '') <= last && !t.deleted; }));
  var ds = Object.keys(s.states).sort(), raw = s.raw || daRawUnit(unit) || {}, out = {}, j = -1;
  days.forEach(function(d){ while(j + 1 < ds.length && ds[j + 1] <= d) j++;
    out[d] = j < 0 ? {fish:raw.fishNo || 0, wt:raw.avgWt || 0} : {fish:s.states[ds[j]].endFish, wt:s.states[ds[j]].endWt}; });
  return out;
}
function daDailyStats(end, n, farm){
  var days = []; for(var i = n - 1; i >= 0; i--) days.push(daAddDays(end, -i));
  var rows = {}; days.forEach(function(d){ rows[d] = {date:d, fish:0, bio:0, tanks:0, feed:0, fed:{}, dead:0, harvKg:0, harvFish:0, fasted:0}; });
  var inFarm = function(u){ return !farm || farm === 'all' || String(u).indexOf(farm + '.') === 0; };
  _txLiveRows().forEach(function(r){ if(!inFarm(r.unit) || !daTankNo(r.unit)) return; var S = daUnitEndSeries(r.unit, days);
    days.forEach(function(d){ var x = S[d]; if(x.fish > 0){ rows[d].fish += x.fish; rows[d].bio += x.fish * (x.wt || 0) / 1000; rows[d].tanks++; } }); });
  getTX().forEach(function(t){ var R = rows[t.date]; if(!R || t.deleted || !inFarm(t.unit)) return;
    if(t.type === 'feeding'){ R.feed += parseFloat(t.kg) || 0; R.fed[t.unit] = 1; if(t.fasted) R.fasted++; }
    else if(t.type === 'mortality') R.dead += parseInt(t.count) || 0;
    else if(t.type === 'harvesting'){ R.harvKg += parseFloat(t.kg) || 0; R.harvFish += parseInt(t.fishNo) || 0; } });
  return days.map(function(d){ var R = rows[d]; R.fedTanks = Object.keys(R.fed).length; R.done = R.tanks ? Math.min(1, R.fedTanks / R.tanks) : 1; return R; });
}
function renderDailyAM(){
  var st = window._do = window._do || {}; if(!st.date) st.date = daToday(); var n = st.n || 14;
  var S = daDailyStats(st.date, n, farmFilter), T = S[S.length - 1], P = S[S.length - 2] || null, f0 = function(v, d){ return (+v || 0).toLocaleString('en-US', {minimumFractionDigits:d || 0, maximumFractionDigits:d || 0}); };
  var dl = function(k, d){ if(!P) return ''; var x = T[k] - P[k]; return '<span style="font-size:11px;display:block;color:' + (x > 0 ? 'var(--green)' : x < 0 ? 'var(--red)' : 'var(--muted)') + '">' + (x > 0 ? '+' : '') + f0(x, d) + '</span>'; };
  var inp = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px';
  var h = '<div class="ph"><div><h2>📅 التقرير اليومي</h2><p style="font-size:11px;color:var(--muted)">' + daEsc(daFarmName()) + ' — محسوب من السجلات لكل يوم، فأي إدخال متأخر بيظهر في يومه</p></div></div>';
  h += '<div class="card" style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><div class="field" style="margin:0"><label>اليوم</label><input type="date" id="do-date" data-nodirty="1" value="' + st.date + '" max="' + daToday() + '" style="' + inp + '" onchange="window._do.date=this.value;show(&quot;daily-overview&quot;,true)"/></div>'
    + '<div class="field" style="margin:0"><label>عدد الأيام</label><select id="do-n" style="' + inp + '" onchange="window._do.n=+this.value;show(&quot;daily-overview&quot;,true)">' + [7, 14, 30].map(function(v){ return '<option value="' + v + '"' + (v === n ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:16px">'
    + daKpi('🐟', 'الأسماك', f0(T.fish), 'var(--deep)', dl('fish')) + daKpi('⚖️', 'Biomass (طن)', f0(T.bio / 1000, 3), 'var(--deep)', '')
    + daKpi('🏊', 'تانكات فيها سمك', f0(T.tanks), 'var(--deep)', '') + daKpi('🌾', 'علف اليوم (كجم)', f0(T.feed, 1), 'var(--deep)', T.tanks ? 'متسجل لـ ' + T.fedTanks + ' من ' + T.tanks + ' تانك' : '')
    + daKpi('💀', 'نفوق اليوم', f0(T.dead), T.dead ? 'var(--red)' : 'var(--deep)', '') + daKpi('🎣', 'حصاد اليوم (كجم)', f0(T.harvKg, 1), 'var(--deep)', T.harvFish ? f0(T.harvFish) + ' سمكة' : '') + '</div>';
  var mx = Math.max.apply(null, S.map(function(r){ return r.feed; }).concat([1]));
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🌾 العلف اليومي — آخر ' + n + ' يوم</div><div style="display:flex;align-items:flex-end;gap:4px;height:120px" dir="ltr">'
    + S.map(function(r){ return '<div title="' + r.date + ': ' + f0(r.feed, 1) + ' كجم" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%"><div style="width:100%;background:' + (r.date === st.date ? 'var(--teal)' : '#94a3b8') + ';height:' + Math.max(2, r.feed / mx * 100) + '%;border-radius:4px 4px 0 0"></div><div style="font-size:9px;color:var(--muted)">' + r.date.slice(5) + '</div></div>'; }).join('') + '</div></div>';
  var th = 'padding:7px 8px;white-space:nowrap';
  h += '<div class="card"><div style="overflow-x:auto"><table id="do-t" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f1f5f9">'
    + ['التاريخ', 'الأسماك', 'Biomass (طن)', 'تانكات فيها سمك', 'علف (كجم)', 'العلف متسجل لـ', 'نفوق', 'حصاد (كجم)'].map(function(x){ return '<th style="' + th + '">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
  S.slice().reverse().forEach(function(r){
    h += '<tr data-d="' + r.date + '" style="border-bottom:1px solid var(--line);cursor:pointer' + (r.date === st.date ? ';background:#f0fdfa;font-weight:700' : '') + '" onclick="window._do.date=this.dataset.d;show(&quot;daily-overview&quot;,true)">'
      + '<td style="' + th + '">' + r.date + '</td><td style="' + th + '">' + f0(r.fish) + '</td><td style="' + th + '">' + f0(r.bio / 1000, 3) + '</td><td style="' + th + '">' + r.tanks + '</td>'
      + '<td style="' + th + '">' + f0(r.feed, 1) + '</td><td style="' + th + ';color:' + (r.done >= 0.95 ? 'var(--green)' : r.done >= 0.5 ? 'var(--amber)' : 'var(--red)') + '">' + r.fedTanks + ' / ' + r.tanks + '</td>'
      + '<td style="' + th + '">' + f0(r.dead) + '</td><td style="' + th + '">' + (r.harvKg ? f0(r.harvKg, 1) : '') + '</td></tr>'; });
  h += '</tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:6px">"العلف متسجل لـ" = كام تانك فيه سمك ليه علف (أو "متأكلش") متسجل في اليوم ده — الأحمر يعني اليوم لسه متسجلش.</div></div>';
  return h;
}
VIEWS['daily-overview'] = renderDailyAM;
VIEWS['all-units'] = renderOverviewAM;   // legacy alias of Site Overview → the dated page too
