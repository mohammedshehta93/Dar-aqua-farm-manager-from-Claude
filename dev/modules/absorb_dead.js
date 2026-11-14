// ══════════════════════════════════════════════════════════
//  DEAD FISH RECORDED AFTER THE TANK WAS MOVED OUT (owner, 2026-11-14)
// ══════════════════════════════════════════════════════════
// A tank transferred (or harvested) whole on a day, then dead fish of that day or earlier entered later: the transfer
// said 1000 (what the tool had), the dead were 5 — refused as "dead + moves (1005) > fish (1000)". In reality the dead
// were taken out first and 995 moved. Now the move is reduced by the smallest number that makes the tank's history
// right (the receiving tank gets the same number less), and the dead are saved. Only when that is small (≤ 20 % of the
// move) — a bigger gap is more likely a wrong number and is still refused for a person to look at.
var DA_ABSORB_MAX = 0.2;
function daAbsorbPlan(unit, fromDate, maxN, extra){
  var outs = (daTxByUnit()[unit] || []).filter(function(x){ return !x.deleted && ['transfer_out', 'harvesting', 'harvest'].indexOf(x.type) >= 0 && x.date >= fromDate && (parseInt(x.fishNo) || 0) > 0; })
    .sort(function(a, b){ return a.date.localeCompare(b.date); });
  var ok = function(){ return extra && (extra.add || extra.remove) ? !daTimelineCheck(unit, extra).length : !daNegStock(unit); };
  for(var i = 0; i < outs.length; i++){ var E = outs[i], n0 = parseInt(E.fishNo) || 0, cap = Math.min(maxN, Math.floor(n0 * DA_ABSORB_MAX));
    if(cap < 1) continue;
    var tryK = function(k){ E.fishNo = n0 - k; _dataVer++; try{ return ok(); }finally{ E.fishNo = n0; _dataVer++; } };   // results are memoised per data version
    if(!tryK(cap)) continue;
    var lo = 1, hi = cap; while(lo < hi){ var mid = (lo + hi) >> 1; if(tryK(mid)) hi = mid; else lo = mid + 1; }   // the smallest reduction that works
    return {out:E, k:lo, unit:unit};
  }
  return null;
}
function daNegStock(unit){   // the whole history of the tank: is any day more out than in? (daTimelineCheck needs a change to look at)
  var r = daSimulateUnit(unit, (daTxByUnit()[unit] || []).slice()); return (r.probs || []).some(function(p){ return /^neg\|/.test(p.key); });
}
function daAbsorbApply(plan){
  var E = plan.out, k = plan.k, n0 = parseInt(E.fishNo) || 0, now = new Date().toISOString(), note = 'نقص ' + k + ' بسبب نافق اتسجل بعد';
  updateTX(E.id, {fishNo:n0 - k, absorbedDead:(E.absorbedDead || 0) + k, absorbNote:note, absorbAt:now});
  if(E.type === 'transfer_out' && E.txGroup){ var ins = getTX().filter(function(x){ return x.type === 'transfer_in' && !x.deleted && x.txGroup === E.txGroup; }).sort(function(a, b){ return (parseInt(b.fishNo) || 0) - (parseInt(a.fishNo) || 0); });
    if(ins[0]) updateTX(ins[0].id, {fishNo:(parseInt(ins[0].fishNo) || 0) - k, absorbedDead:(ins[0].absorbedDead || 0) + k, absorbNote:note, absorbAt:now}); }
  _dataVer++;
  var lbl = typeof daTankNo === 'function' && daTankNo(plan.unit) ? daTankNo(plan.unit).label : plan.unit;
  return lbl + ': ' + (E.type === 'transfer_out' ? 'النقل' : 'الحصاد') + ' ' + E.date + ' بقى ' + (n0 - k) + ' بدل ' + n0;
}
if(!window._daAbsorbWrapped){
  window._daAbsorbWrapped = true;
  window._daAbsorbQ = [];
  var _vtPreAb = validateTX;
  validateTX = function(t){
    var x = _vtPreAb.apply(this, arguments);
    if(x.level === 'block' && t && t.type === 'mortality' && t.unit && (parseInt(t.count) || 0) > 0 && !x.msgs.some(function(m){ return /المستقبل|أكبر من صفر/.test(m); })){
      var plan = daAbsorbPlan(t.unit, t.date, parseInt(t.count) || 0, {add:t});
      if(plan){ window._daAbsorbQ.push({plan:plan, mortId:t.id}); return {level:'ok', msgs:[]}; }
    }
    return x;
  };
  var _fsSavePreAb = daFsSave;
  daFsSave = function(){
    window._daAbsorbQ = [];
    var st = window._fs, r = _fsSavePreAb.apply(this, arguments);
    var done = function(){ var notes = [];
      window._daAbsorbQ.forEach(function(q){ if(getTX().some(function(t){ return t.id === q.mortId && !t.deleted; })){ var E = getTX().filter(function(t){ return t.id === q.plan.out.id; })[0]; if(E){ q.plan.out = E; notes.push(daAbsorbApply(q.plan)); } } });
      // a dead count raised on an existing record (an edit, not checked when saved): same rule
      if(st && st.rows) st.rows.forEach(function(row){ if(!row.unit || !daRawUnit(row.unit)) return;
        if(daNegStock(row.unit)){ var p = daAbsorbPlan(row.unit, st.date, 100000, null); if(p) notes.push(daAbsorbApply(p)); } });
      window._daAbsorbQ = [];
      if(notes.length){ setTimeout(function(){ toast('🔄 ' + notes.join(' · ')); }, 400); if(currentView === 'feed-sheet') show('feed-sheet', true); } };
    if(r && typeof r.then === 'function') return r.then(function(v){ done(); return v; }, function(e){ done(); throw e; });
    done(); return r;
  };
}
