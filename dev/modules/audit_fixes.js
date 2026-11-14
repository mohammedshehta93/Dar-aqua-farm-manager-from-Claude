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
