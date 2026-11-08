// ══════════════════════════════════════════════════════════
//  TANKS ADDED IN THE TOOL COUNT LIKE IMPORTED ONES (owner, 2026-11-08 — the hatchery)
// ══════════════════════════════════════════════════════════
// The stock engines read a tank's starting fish / weight / date from the imported list only, so a tank added in Farm
// setup (with its fish count) looked empty that day and the feed sheet locked it. Now the tank's own setup data is used
// when it is not in the imported list.
if(!window._daCustomUnitsWrapped){
  window._daCustomUnitsWrapped = true;
  var _rawUnitPreCU = daRawUnit;
  daRawUnit = function(u){
    var r = _rawUnitPreCU.apply(this, arguments); if(r) return r;
    var c = (typeof getFarmUnits === 'function' ? getFarmUnits() : []).filter(function(x){ return x.name === u; })[0]; if(!c) return null;
    var aw = parseFloat(c.avgWt) || parseFloat(c.startWt) || 0;
    return {unit:c.name, farm:c.farm || String(c.name).split('.')[0], section:c.section || String(c.name).split('.').slice(0, 2).join('.'), fishNo:parseInt(c.fishNo) || 0,
      avgWt:aw, startWt:parseFloat(c.startWt) || aw, startDate:c.stockDate || c.startDate || '', vol:parseFloat(c.vol || c.volume) || 0, custom:true};
  };
}
