// ══════════════════════════════════════════════════════════
//  SPEED (owner, 2026-11-08: "make it faster") — same results, less repeated work
// ══════════════════════════════════════════════════════════
// Measured with a year of data (60k records) at phone speed: opening ≈ 4.4 s. The repeated work removed here:
// farm alerts computed twice at opening and on workers' phones (who never see them) → one cached result per data
// version, no alert monitor for users without the alerts page; tank look-ups scanning the whole list every call →
// an index; the dashboard drawn again after sync even when nothing changed → skipped.
var _daAlertsMemo = null;
var _daRawIdx = {ref:null, len:-1, map:null}, _daCustIdx = {ver:-1, map:null};
function daRawIndex(){
  if(_daRawIdx.ref !== RAW || _daRawIdx.len !== RAW.length || _daRawIdx.ver !== _dataVer){ var m = {}; for(var i = 0; i < RAW.length; i++){ var u = RAW[i] && RAW[i].unit; if(u && !(u in m)) m[u] = RAW[i]; } _daRawIdx = {ref:RAW, len:RAW.length, ver:_dataVer, map:m}; }
  return _daRawIdx.map;
}
function daCustomIndex(){
  if(_daCustIdx.ver !== _dataVer || !_daCustIdx.map){ var m = {}; (typeof getFarmUnits === 'function' ? getFarmUnits() : []).forEach(function(c){ if(c && c.name && !(c.name in m)) m[c.name] = c; }); _daCustIdx = {ver:_dataVer, map:m}; }
  return _daCustIdx.map;
}
if(!window._daPerfWrapped){
  window._daPerfWrapped = true;
  // tank look-up: index instead of a scan (imported list, then tanks added in setup — same answer as before)
  daRawUnit = function(u){
    var r = daRawIndex()[u]; if(r) return r;
    var c = daCustomIndex()[u]; if(!c) return null;
    var aw = parseFloat(c.avgWt) || parseFloat(c.startWt) || 0;
    return {unit:c.name, farm:c.farm || String(c.name).split('.')[0], section:c.section || String(c.name).split('.').slice(0, 2).join('.'), fishNo:parseInt(c.fishNo) || 0,
      avgWt:aw, startWt:parseFloat(c.startWt) || aw, startDate:c.stockDate || c.startDate || '', vol:parseFloat(c.vol || c.volume) || 0, custom:true};
  };
  // farm alerts: one result per data version (the dashboard and the alert monitor asked for it separately)
  var _genAlertsPrePerf = generateAlerts;
  generateAlerts = function(){
    var key = _dataVer + '|' + daToday() + '|' + new Date().getHours() + '|' + farmFilter + '|' + isAr + '|' + (typeof currentUserRole !== 'undefined' ? currentUserRole : '');
    if(_daAlertsMemo && _daAlertsMemo.key === key) return _daAlertsMemo.res.slice();
    var res = _genAlertsPrePerf.apply(this, arguments); _daAlertsMemo = {key:key, res:res}; return res.slice();
  };
  // feed sheet: per-tank index instead of scanning every record (same answers)
  daFwDefaultFeed = function(r){
    var last = null; (daTxByUnit()[r.unit] || []).forEach(function(t){ if(t.type === 'feeding' && t.feed && (!last || t.date > last.date)) last = t; });
    if(last) return last.feed;
    var bands = daPlanCfg().bands;
    for(var i = 0; i < bands.length; i++) if((r.avgWt || 0) < bands[i].max || i === bands.length - 1) return bands[i].inv || bands[i].label;
    return '';
  };
  var _defProdMemo = {};
  var _defProdPrePerf = daSheetDefaultProduct;
  daSheetDefaultProduct = function(farm, size){ var k = _dataVer + '|' + farm + '|' + size; if(!(k in _defProdMemo)){ if(Object.keys(_defProdMemo).length > 50) _defProdMemo = {}; _defProdMemo[k] = _defProdPrePerf.apply(this, arguments); } return _defProdMemo[k]; };
  daFsRows = function(farm, date){
    var units = {}; _txLiveRows().forEach(function(r){ if(r.farm === farm || String(r.unit).indexOf(farm + '.') === 0) units[r.unit] = r; });
    Object.keys(daTxByUnit()).forEach(function(u){ if(u && String(u).indexOf(farm + '.') === 0 && !units[u] && daTankNo(u)) units[u] = {unit:u, farm:farm}; });
    return Object.keys(units).filter(daTankNo).sort(function(a, b){ var x = daTankNo(a), y = daTankNo(b); return x.s - y.s || x.t - y.t; })
      .map(function(u){ return {unit:u, no:daTankNo(u), fish:(daStateAt(u, date) || {}).fish || 0}; });
  };
  // no alert monitor where nobody can see the alerts (workers' phones)
  var _monPrePerf = startAlertMonitor;
  startAlertMonitor = function(){ if(currentUser && !(canAccessView('smart') || canAccessView('alarms') || canAccessView('dashboard'))) return; return _monPrePerf.apply(this, arguments); };
  // after the opening sync: draw the page again only if the data changed since it was drawn
  window._daShownVer = {};
  var _showPrePerf = show;
  show = function(v){ var r = _showPrePerf.apply(this, arguments); window._daShownVer[currentView] = _dataVer; return r; };
  var _bgPrePerf = daBgRefresh;
  daBgRefresh = function(v){ var k = v || currentView; if(window._daShownVer[k] === _dataVer) return; return _bgPrePerf.apply(this, arguments); };
}
