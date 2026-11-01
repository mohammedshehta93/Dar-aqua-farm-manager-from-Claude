// ══════════════════════════════════════════════════════════
//  FEED HISTORY FOLLOWS THE FISH (partial transfers / harvests)
// ══════════════════════════════════════════════════════════
// When part of a tank leaves (graded, weighed), the tank's history — feed eaten, starting biomass, dead biomass — is
// split by BIOMASS share: the fish that leave take their share (and carry it into the tank they enter), the fish that
// stay keep the rest. Nothing is lost or counted twice. UTD = the fish now in this tank, since they entered it;
// LTD = the same fish since they were first stocked (whatever tanks they passed through).
function daOutWt(t){ var w = parseFloat(t.avgWt) || 0, n = parseInt(t.fishNo) || 0, kg = parseFloat(t.kg) || 0; return w > 0 ? w : (kg > 0 && n > 0 ? kg * 1000 / n : 0); }
function daRemainWt(fish, wt, n, w){   // average of the fish that stay after n fish of weight w leave
  if(!(w > 0) || !(wt > 0) || fish - n <= 0) return wt;
  var nw = (fish * wt - n * w) / (fish - n); return nw >= 0.3 * wt && nw <= 3 * wt ? +nw.toFixed(3) : wt;
}
var _allocMemo = {v:-1};
function daAlloc(){
  if(_allocMemo.v === _dataVer) return _allocMemo;
  var U = {}, series = {}, byDate = {}, packets = {};
  var fresh = function(){ return {fish:0, wt:0, F:0, S:0, Dk:0, Fi:0, S0:0, Di:0}; };
  _txLiveRows().forEach(function(r){ var raw = daRawUnit(r.unit) || {}, base = raw.open ? raw.open.date : (raw.startDate || ''), u = U[r.unit] = fresh(); u.base = base;
    if((raw.fishNo || 0) > 0){ var o = raw.open || {}, bio = raw.fishNo * (raw.avgWt || 0) / 1000; u.fish = raw.fishNo; u.wt = raw.avgWt || 0; u.F = +o.feed || 0;
      u.S = o.gain > 0 ? bio - o.gain : (raw.stockBio || (raw.stockFish || raw.fishNo) * (raw.startWt || u.wt) / 1000); u.S0 = u.S;
      (series[r.unit] = []).push(Object.assign({date:base || '0000'}, u)); } });
  getTX().forEach(function(t){ if(t.deleted || !U[t.unit]) return; var d = String(t.date || ''); if(U[t.unit].base && d < U[t.unit].base) return; ((byDate[d] = byDate[d] || {})[t.unit] = byDate[d][t.unit] || []).push(t); });
  var snap = function(unit, d){ (series[unit] = series[unit] || []).push(Object.assign({date:d}, U[unit])); };
  Object.keys(byDate).sort().forEach(function(d){
    var day = byDate[d], deferred = [];
    Object.keys(day).forEach(function(unit){
      var u = U[unit], ev = day[unit].slice().sort(daTxOrder), adds = 0, subs = 0;
      ev.forEach(function(t){ if(t.type === 'stocking' || t.type === 'transfer_in') adds += parseInt(t.fishNo) || 0; var f = DA_SUB_FIELD[t.type]; if(f) subs += parseInt(t[f]) || 0; });
      var addIn = function(){ ev.forEach(function(t){ if(t.type !== 'stocking' && t.type !== 'transfer_in') return; var n = parseInt(t.fishNo) || 0, w = parseFloat(t.avgWt) || u.wt; if(n <= 0) return;
        if(u.fish <= 0){ var keep = u.base; U[unit] = u = fresh(); u.base = keep; }
        u.wt = u.fish + n > 0 ? (u.fish * u.wt + n * w) / (u.fish + n) : w; if(parseFloat(t.newWt) > 0) u.wt = parseFloat(t.newWt); u.fish += n; u.S += n * w / 1000;
        if(t.type === 'transfer_in' && t.txGroup) deferred.push({unit:unit, g:t.txGroup, kg:n * w / 1000}); else u.S0 += n * w / 1000; }); };
      var out = function(){ ev.forEach(function(t){ var f = DA_SUB_FIELD[t.type]; if(!f) return; var n = parseInt(t[f]) || 0; if(n <= 0 || u.fish <= 0) return; n = Math.min(n, u.fish);
        if(t.type === 'mortality' || t.type === 'adjustment'){ u.Dk += n * u.wt / 1000; u.fish -= n; return; }
        var w = daOutWt(t) || u.wt, rw = parseFloat(t.remainWt) > 0 && u.fish - n > 0 ? parseFloat(t.remainWt) : 0, kg = n * w / 1000,
          bio = rw ? kg + (u.fish - n) * rw / 1000 : u.fish * u.wt / 1000, sh = bio > 0 ? Math.min(1, kg / bio) : 1;   // both parts weighed → split on what was measured
        if(t.type === 'transfer_out' && t.txGroup){ var P = packets[t.txGroup] = packets[t.txGroup] || {F:0, S0:0, D:0}; P.F += (u.F + u.Fi) * sh; P.S0 += u.S0 * sh; P.D += (u.Dk + u.Di) * sh; }
        ['F', 'S', 'Dk', 'Fi', 'S0', 'Di'].forEach(function(k){ u[k] *= (1 - sh); });
        u.wt = rw || daRemainWt(u.fish, u.wt, n, w); u.fish -= n; }); };
      var mid = function(){ ev.forEach(function(t){ if(t.type === 'feeding') u.F += parseFloat(t.kg) || 0; else if(t.type === 'sampling' && parseFloat(t.avgWt) > 0 && !t.link) u.wt = parseFloat(t.avgWt); }); };
      if(u.fish > 0 && adds > 0 && subs >= u.fish){ out(); addIn(); mid(); } else { addIn(); mid(); out(); }   // emptied and restocked the same day: old fish leave first
      if(u.fish <= 0){ var b = u.base; U[unit] = fresh(); U[unit].base = b; }
    });
    // fish that entered other tanks today carry their share of the history, split by the biomass each tank received
    var tot = {}; deferred.forEach(function(x){ tot[x.g] = (tot[x.g] || 0) + x.kg; });
    deferred.forEach(function(x){ var P = packets[x.g]; if(!P) { U[x.unit].S0 += x.kg; return; } var r = tot[x.g] > 0 ? x.kg / tot[x.g] : 0, u = U[x.unit]; u.Fi += P.F * r; u.S0 += P.S0 * r; u.Di += P.D * r; });
    Object.keys(day).forEach(function(unit){ snap(unit, d); });
  });
  _allocMemo = {v:_dataVer, series:series}; return _allocMemo;
}
function daAllocAt(unit, D){
  var s = (daAlloc().series[unit] || []), z = null; for(var i = s.length - 1; i >= 0; i--) if(s[i].date <= D){ z = s[i]; break; }
  if(!z || !(z.fish > 0)) return null;
  var bio = z.fish * z.wt / 1000, g = bio - z.S + z.Dk, gl = bio - z.S0 + z.Dk + z.Di;
  return {fish:z.fish, wt:z.wt, bio:bio, feed:z.F, stock:z.S, fcr:z.F > 0 && g > 0 ? z.F / g : null, lfcr:z.F + z.Fi > 0 && gl > 0 ? (z.F + z.Fi) / gl : null, lfeed:z.F + z.Fi};
}
