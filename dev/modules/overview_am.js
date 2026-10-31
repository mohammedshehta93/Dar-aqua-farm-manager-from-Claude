// ══════════════════════════════════════════════════════════
//  SITE OVERVIEW ON ANY DATE — AquaManager style (owner, 2026-10-31)
// ══════════════════════════════════════════════════════════
// One page instead of a new one: pick a date → every tank that had fish THAT day, with AquaManager's columns.
// UTD = this tank's current cycle up to the date; LTD = the whole batch (same batch name) across every tank it passed
// through. Rows: green at/above harvest weight, yellow from 75 %. Click a tank → its cycles (close a cycle there).
function daStateEnd(unit, date){   // end of the day `date` (after that day's harvest / mortality / transfers)
  var s = daSimulateUnit(unit, (daTxByUnit()[unit] || []).filter(function(t){ return String(t.date || '') <= date && !t.deleted; }));
  var ds = Object.keys(s.states).filter(function(d){ return d <= date; }).sort(), raw = s.raw || daRawUnit(unit) || {};
  if(!ds.length) return {fish:raw.fishNo || 0, wt:raw.avgWt || 0};
  var st = s.states[ds[ds.length - 1]]; return {fish:st.endFish, wt:st.endWt};
}
function daCycleTo(unit, c, D){   // this cycle's numbers from its start up to D (or its end); an imported cycle starts from its imported totals
  var to = c.end && c.end < D ? c.end : D, op = c.opening, from = op ? op.date : c.start, feed = op ? op.feed : 0, dead = op ? op.dead : 0, outKg = 0, inKg = 0, st = daStateEnd(unit, to);
  (daTxByUnit()[unit] || []).forEach(function(t){ var d = String(t.date || ''); if(t.deleted || d < from || d > to) return;
    if(t.type === 'feeding') feed += parseFloat(t.kg) || 0;
    else if(t.type === 'mortality') dead += parseInt(t.count) || 0;
    else if((t.type === 'stocking' || t.type === 'transfer_in') && d > c.start) inKg += (parseInt(t.fishNo) || 0) * (parseFloat(t.avgWt) || 0) / 1000;
    else if(t.type === 'harvesting' || t.type === 'transfer_out'){ var n = parseInt(t.fishNo) || 0, kg = parseFloat(t.kg) || 0; outKg += kg || n * (parseFloat(t.avgWt) || st.wt) / 1000; } });
  var stockKg = c.fish0 * c.wt0 / 1000, bio = (st.fish || 0) * (st.wt || 0) / 1000, deadKg = dead * ((c.wt0 + (st.wt || c.wt0)) / 2) / 1000, gain;
  if(op && op.gain !== null){   // gain up to the import (AquaManager) + gain since: biomass change, dead since import, out − in
    var deadSince = dead - op.dead; gain = op.gain + (bio - op.bio) + deadSince * (st.wt || c.wt0) / 1000 + outKg - inKg;
  } else gain = bio - stockKg + deadKg + outKg - inKg;
  return {feed:feed, dead:dead, gain:gain, stockKg:stockKg + inKg, bio:bio, st:st, fcr:feed > 0 && gain > 0 ? feed / gain : null, days:Math.max(0, daDaysBetween(c.start, to))};
}
function daOverviewRows(D, farm){
  var units = _txLiveRows().filter(function(r){ return (!farm || farm === 'all' || r.farm === farm || String(r.unit).indexOf(farm + '.') === 0) && daTankNo(r.unit); });
  var all = {}, lots = {};
  units.forEach(function(r){ all[r.unit] = daUnitCycles(r.unit); all[r.unit].forEach(function(c){ if(c.batch && c.start <= D) (lots[c.batch] = lots[c.batch] || []).push({u:r.unit, c:c}); }); });
  var lotMemo = {};
  var lotOf = function(b){ if(lotMemo[b]) return lotMemo[b]; var f = 0, g = 0, s0 = null;
    (lots[b] || []).forEach(function(x){ var k = daCycleTo(x.u, x.c, D); f += k.feed; g += k.gain; if(!s0 || x.c.start < s0) s0 = x.c.start; });
    return (lotMemo[b] = {fcr:f > 0 && g > 0 ? f / g : null, start:s0}); };
  var target = {}, out = [];
  units.forEach(function(r){
    var cs = all[r.unit], c = null; for(var i = cs.length - 1; i >= 0; i--) if(cs[i].start <= D && (!cs[i].end || cs[i].end > D)){ c = cs[i]; break; }
    if(!c) return; var k = daCycleTo(r.unit, c, D); if(!(k.st.fish > 0)) return;
    var vol = (daRawUnit(r.unit) || {}).volume || r.volume || 0, lot = c.batch ? lotOf(c.batch) : null, farmId = r.farm || String(r.unit).split('.')[0];
    if(target[farmId] === undefined) target[farmId] = daHarvestTargetFor(farmId) || 0;
    out.push({unit:r.unit, farm:farmId, batch:c.batch || '', cycle:c, start:c.start, fish:k.st.fish, wt0:c.wt0, wt:k.st.wt, bio:k.bio, dens:vol ? k.bio / vol : null, dead:k.dead, feed:k.feed,
      fcr:k.fcr, lfcr:lot ? lot.fcr : k.fcr, gday:k.days > 0 ? (k.st.wt - c.wt0) / k.days : 0, stock:k.stockKg, days:k.days, ldays:lot && lot.start ? daDaysBetween(lot.start, D) : k.days, target:target[farmId]});
  });
  return out;
}
var DA_OV_COLS = [
  ['unit', 'Unit'], ['start', 'Unit Start Date'], ['fish', 'Fish No'], ['wt0', 'UTD Start Av. Wt.'], ['wt', 'Av. Wt.'], ['bio', 'Biomass'], ['dens', 'Fish Density (Kg/m3)'],
  ['dead', 'UTD Mortality No'], ['feed', 'UTD Feed Kg'], ['fcr', 'UTD Biol. FCR'], ['lfcr', 'LTD Biol. FCR'], ['gday', 'UTD Av.Wt Growth/Day (gr)'], ['stock', 'UTD Stocking Biomass (Kg)'],
  ['days', 'UTD Production Time'], ['ldays', 'LTD Production Time'], ['batch', 'Batch']];
function renderOverviewAM(){
  var st = window._ov = window._ov || {}; if(!st.date) st.date = daToday(); if(!st.sort) st.sort = 'unit';
  var D = st.date, rows = daOverviewRows(D, farmFilter), q = String(st.q || '').trim().toLowerCase();
  if(q) rows = rows.filter(function(r){ return r.unit.toLowerCase().indexOf(q) >= 0 || r.batch.toLowerCase().indexOf(q) >= 0; });
  var key = st.sort, dir = st.desc ? -1 : 1;
  rows.sort(function(a, b){ if(key === 'unit'){ var x = daTankNo(a.unit), y = daTankNo(b.unit); return dir * (a.farm.localeCompare(b.farm) || x.s - y.s || x.t - y.t); }
    var va = a[key], vb = b[key]; if(va === null || va === undefined) return 1; if(vb === null || vb === undefined) return -1; return dir * (va > vb ? 1 : va < vb ? -1 : 0); });
  var inp = 'padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px', past = D < daToday();
  var fx = function(v, d){ return v === null || v === undefined || isNaN(v) ? '' : (+v).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d}); };
  var h = '<div class="ph"><div><h2>📊 Site Overview</h2><p style="font-size:11px;color:var(--muted)">التانكات اللي كان فيها سمك في التاريخ المختار — زي الأكوامانجر</p></div></div>';
  h += '<div class="card" style="margin-bottom:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end" dir="ltr">'
    + '<div class="field" style="margin:0"><label>Date</label><input type="date" id="ov-date" data-nodirty="1" value="' + D + '" max="' + daToday() + '" style="' + inp + '" onchange="window._ov.date=this.value;show(&quot;site-overview&quot;,true)"/></div>'
    + '<button id="ov-refresh" onclick="daTabRefresh()" style="' + inp + ';background:#fff;cursor:pointer">🔄 Refresh</button>'
    + (past ? '<button onclick="window._ov.date=daToday();show(&quot;site-overview&quot;,true)" style="' + inp + ';background:#fff;cursor:pointer">Today</button>' : '')
    + '<div class="field" style="margin:0"><label>Filter</label><input id="ov-q" data-nodirty="1" value="' + daEsc(st.q || '') + '" placeholder="Unit / batch" style="' + inp + ';width:150px" onchange="window._ov.q=this.value;show(&quot;site-overview&quot;,true)"/></div>'
    + '<button onclick="window.print()" style="' + inp + ';background:#fff;cursor:pointer">🖨️ Print</button>'
    + '<span style="flex:1"></span><b style="font-size:18px">' + rows.length + ' units</b>'
    + (past ? '<span style="color:var(--amber);font-weight:700;font-size:12px" dir="rtl">⏪ المزرعة يوم ' + D + '</span>' : '') + '</div>';
  if(window._tc && window._tc.unit) h += daCyclesCard(window._tc.unit, ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0);
  var th = 'padding:6px 7px;white-space:nowrap;cursor:pointer;border-right:1px solid #cbd5e1;font-weight:600;font-size:11px';
  h += '<div class="card" style="padding:0;overflow:hidden"><div style="overflow:auto;max-height:72vh" dir="ltr"><table id="ov-t" style="border-collapse:collapse;font-size:12px;width:100%"><thead><tr style="background:#e2e8f0;position:sticky;top:0;z-index:1">'
    + DA_OV_COLS.map(function(c){ return '<th data-k="' + c[0] + '" onclick="window._ov.desc=window._ov.sort===this.dataset.k?!window._ov.desc:false;window._ov.sort=this.dataset.k;show(&quot;site-overview&quot;,true)" style="' + th + ';text-align:' + (c[0] === 'unit' || c[0] === 'batch' || c[0] === 'start' ? 'left' : 'right') + '">' + c[1] + (st.sort === c[0] ? (st.desc ? ' ▼' : ' ▲') : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
  var tot = {fish:0, bio:0, fcr:[], lfcr:[]};
  rows.forEach(function(r){
    var bg = r.target && r.wt >= r.target ? '#86efac' : r.target && r.wt >= r.target * 0.75 ? '#fef08a' : '';
    tot.fish += r.fish; tot.bio += r.bio; if(r.fcr) tot.fcr.push(r.fcr); if(r.lfcr) tot.lfcr.push(r.lfcr);
    var td = function(v, al){ return '<td style="padding:4px 7px;white-space:nowrap;border-right:1px solid #e2e8f0;text-align:' + (al || 'right') + '">' + v + '</td>'; };
    h += '<tr data-u="' + daEsc(r.unit) + '" onclick="window._tc=window._tc||{};window._tc.unit=this.dataset.u;show(&quot;site-overview&quot;,true)" style="cursor:pointer;border-bottom:1px solid #e2e8f0' + (bg ? ';background:' + bg : '') + '">'
      + td(daEsc(r.unit), 'left') + td(r.start, 'left') + td(fx(r.fish, 0)) + td(fx(r.wt0, 2)) + td('<b>' + fx(r.wt, 2) + '</b>') + td(fx(r.bio, 2)) + td(fx(r.dens, 2))
      + td(fx(r.dead, 0)) + td(fx(r.feed, 2)) + td(fx(r.fcr, 2)) + td(fx(r.lfcr, 2)) + td(fx(r.gday, 3)) + td(fx(r.stock, 2)) + td(fx(r.days, 0)) + td(fx(r.ldays, 0)) + td(daEsc(r.batch), 'left') + '</tr>';
  });
  var avg = function(a){ return a.length ? 'AVG=' + (a.reduce(function(s, v){ return s + v; }, 0) / a.length).toFixed(2) : ''; };
  h += '</tbody><tfoot><tr style="background:#f1f5f9;font-weight:700;position:sticky;bottom:0">' + ['', '', fx(tot.fish, 0), '', tot.fish ? fx(tot.bio / tot.fish * 1000, 2) : '', fx(tot.bio, 2), '', '', '', avg(tot.fcr), avg(tot.lfcr), '', '', '', '', ''].map(function(v){ return '<td style="padding:6px 7px;text-align:right;white-space:nowrap">' + v + '</td>'; }).join('') + '</tr></tfoot></table></div></div>';
  if(!rows.length) h += '<div class="card" style="text-align:center;padding:30px;color:var(--muted)">مفيش تانكات فيها سمك في التاريخ ده.</div>';
  return h;
}
// ── registration: the existing Site Overview page becomes the dated one; the separate page goes away ──
VIEWS['site-overview'] = renderOverviewAM;
VIEWS['tank-cycles'] = function(){ if(window._tc && window._tc.date){ window._ov = window._ov || {}; window._ov.date = window._tc.date; } return renderOverviewAM(); };
DA_NAV.forEach(function(g){ g.items = g.items.filter(function(i){ return i[0] !== 'tank-cycles'; }); });
