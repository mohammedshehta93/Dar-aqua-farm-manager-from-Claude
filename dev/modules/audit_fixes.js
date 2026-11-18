// ══════════════════════════════════════════════════════════
//  AUDIT FIXES (2026-11-14) — names called but never defined
// ══════════════════════════════════════════════════════════
// Found by a static check of the whole script: "unit transactions" (unit-tx, in the menu) called getUnitLive and broke
// on open; the log book called wqLabel for water entries (would break as soon as one exists).
function getUnitLive(uid){   // the tank today, in the shape the old pages expect
  var s = (typeof daStateAt === 'function' ? daStateAt(uid, daToday()) : null) || {}, fish = s.fish || 0, wt = s.wt || 0;
  return {unit:uid, fishNo:fish, avgWt:wt, biomass:fish * wt / 1000};
}
function wqLabel(kind, v){ var x = parseFloat(v); if(isNaN(x)) return '—'; return String(+x.toFixed(kind === 'ph' || kind === 'amm' ? 2 : 1)); }
if(!window._daAuditFixWrapped){   // the audit log names the newer record kinds instead of showing their code names
  window._daAuditFixWrapped = true;
  if(typeof DA_TYPE !== 'undefined') Object.assign(DA_TYPE, {work_order:'📋 أمر شغل', routine:'📅 روتين', feed_day:'🌾 العلف اليومي', purchase:'🛒 طلب شرا', stock_count:'📦 جرد المخزن', adjustment:'⚖️ تسوية'});
}
function daDashWtTrend(){   // the dashboard's weight trend from the samples: per week, the latest sample of each tank, averaged
  var S = getTX().filter(function(t){ return t.type === 'sampling' && !t.deleted && !t.link && parseFloat(t.avgWt) > 0 && (!farmFilter || farmFilter === 'all' || String(t.unit).indexOf(farmFilter + '.') === 0); }), out = [];
  for(var k = 7; k >= 0; k--){ var to = daAddDays(daToday(), -7 * k), from = daAddDays(to, -6), last = {};
    S.forEach(function(t){ if(t.date >= from && t.date <= to && (!last[t.unit] || t.date >= last[t.unit].date)) last[t.unit] = t; });
    var v = Object.keys(last).map(function(u){ return parseFloat(last[u].avgWt); }); if(v.length) out.push({date:to, val:Math.round(v.reduce(function(a, b){ return a + b; }, 0) / v.length)}); }
  return out;
}
