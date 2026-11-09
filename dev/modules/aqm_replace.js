// ══════════════════════════════════════════════════════════
//  AQUAMANAGER IMPORT = TODAY'S PICTURE (owner, 2026-11-09)
// ══════════════════════════════════════════════════════════
// Importing a Site Overview updated the tanks that have fish in the file and left every other tank with its old numbers
// (empty or harvested tanks kept fish). Now the file is the farm's picture on its date: a tank of the same farms that is
// NOT in the file, or is in it with 0 fish, is recorded EMPTY from the file's date (an opening balance of 0, the same way
// imported tanks get theirs — the stock engines then count 0 from that day). Shown in the preview with a tick box (on by
// default). Farms not in the file are not touched; no tank is deleted.
function daAqmEmptied(p){
  if(!p || !p.aqm || !p.units) return [];
  var date = (p.stats && p.stats.openDate) || daToday(), inFile = {}, farms = {};
  p.units.forEach(function(u){ inFile[u.unit] = 1; farms[u.farm] = 1; });
  (p.emptyNames || []).forEach(function(n){ farms[String(n).split('.')[0]] = 1; });
  return RAW.filter(function(u){ return farms[u.farm] && !inFile[u.unit] && ((daStateAt(u.unit, date) || {}).fish || 0) > 0; }).map(function(u){
    return Object.assign({}, u, {fishNo:0, avgWt:0, biomass:0, density:0, feedKg:0, mortality:0, survival:100,
      open:{date:date, fish:0, wt:0, bio:0, feed:0, mort:0, fcr:0, gpd:0, days:0, stockBio:0, gain:null, source:'AquaManager (not in the file: empty)'}}); });
}
if(!window._daAqmRepWrapped){
  window._daAqmRepWrapped = true;
  var _parsePreRep = daParseAquaManager;
  daParseAquaManager = function(wb, hdr){   // also remember which farms the file's EMPTY rows belong to
    var out = _parsePreRep.apply(this, arguments), M = hdr.map, names = [];
    for(var i = hdr.row + 1; i < hdr.aoa.length; i++){ var row = hdr.aoa[i], nm = String(row[M.unit] || '').trim(); if(nm && /\d/.test(nm) && !(parseFloat(row[M.fish]) > 0)) names.push(daNormUnit(nm)); }
    out.emptyNames = names; return out;
  };
  var _prevPreRep = daShowAqmPreview;
  daShowAqmPreview = function(p){
    var r = _prevPreRep.apply(this, arguments), em = daAqmEmptied(p); p.emptied = em;
    var el = document.getElementById('imp-preview'), go = el && el.querySelector('#imp-go');
    if(em.length && go) go.insertAdjacentHTML('beforebegin', '<div id="aqm-emptied" style="margin:10px 0;padding:10px 12px;border-radius:10px;background:#fef9c3;font-size:13px">'
      + '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="aqm-empty-on" checked style="width:18px;height:18px;margin-top:2px"/><span><b>🧹 ' + em.length + ' تانك هتتسجل فاضية من ' + daEsc((p.stats && p.stats.openDate) || '') + '</b> — مش موجودة في ملف النهارده (أو فيها 0 سمك)، وفيها سمك في الأداة:<br><span dir="ltr" style="font-size:12px">'
      + em.slice(0, 24).map(function(u){ return daEsc(u.unit); }).join('، ') + (em.length > 24 ? ' …' : '') + '</span><br><span style="font-size:11px;color:var(--muted)">التانكات نفسها مش بتتمسح. المزارع اللي مش في الملف مش بتتلمس.</span></span></label></div>');
    return r;
  };
  var _runPreRep = daRunImport;
  daRunImport = async function(){
    var p = window._impParsed, on = document.getElementById('aqm-empty-on');
    if(p && p.aqm && p.emptied && p.emptied.length && (!on || on.checked)){ var have = {}; p.units.forEach(function(u){ have[u.unit] = 1; }); p.emptied.forEach(function(u){ if(!have[u.unit]) p.units.push(u); }); }
    return _runPreRep.apply(this, arguments);
  };
}
