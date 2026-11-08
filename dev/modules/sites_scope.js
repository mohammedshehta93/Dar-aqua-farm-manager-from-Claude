// ══════════════════════════════════════════════════════════
//  EACH USER SEES ONLY THEIR SITE(S) (owner, 2026-11-08)
// ══════════════════════════════════════════════════════════
// Sites are extra items in the permission list ("farm:F1", "farm:F2", …), so they appear as tick boxes in the add /
// edit user forms and are saved with the permissions (no database change). No site ticked = every site (as before).
// With sites ticked, the user only ever sees those: farm lists, sheets, the farm filter ("all" removed).
// Also: a new farm / tanks added on one device reach open sheets on the others (🔄 pulls the farm settings too, and a
// sheet with nothing typed redraws when tanks or farms change).
function daSessionPerms(){ var s = getSession(); return s && Array.isArray(s.perms) && s.perms.length ? s.perms : getRoleDefaults(currentUserRole || 'viewer'); }
function daUserFarms(){   // null = no restriction
  if(!currentUser || currentUserRole === 'admin') return null;
  var f = daSessionPerms().filter(function(p){ return String(p).indexOf('farm:') === 0; }).map(function(p){ return p.slice(5); });
  return f.length ? f : null;
}
function daSiteOk(f){ var a = daUserFarms(); return !a || a.indexOf(f) >= 0; }
function daEnforceSite(){
  var a = daUserFarms(), who = currentUser ? currentUser.email : '';
  if(!a){   // no restriction: never keep a farm forced for someone else on this device; workers (no farm picker on top) start on "all"
    if((window._daSiteForcedFor && window._daSiteForcedFor !== who) || (currentUser && currentUserRole === 'worker' && window._daSiteLastUser !== who)) farmFilter = 'all';
    window._daSiteForcedFor = null; window._daSiteLastUser = who; return; }
  window._daSiteLastUser = who;
  if(farmFilter === 'all' || a.indexOf(farmFilter) < 0){ farmFilter = a[0]; window._daSiteForcedFor = who; }
  ['_fs', '_wqs', '_sp', '_tw', '_pl', '_mc'].forEach(function(k){ if(window[k] && window[k].farm && a.indexOf(window[k].farm) < 0) window[k].farm = a[0]; });
}
if(!window._daSitesWrapped){
  window._daSitesWrapped = true;
  var _permsPreSite = getPermsList;
  getPermsList = function(){ var list = _permsPreSite.apply(this, arguments), reg = {};
    try{ reg = getFarmsRegistry() || {}; }catch(e){}
    var farms = Object.keys(_farmListPreSite ? _farmListPreSite() : {}).filter(function(k){ return k !== 'all'; }).sort();
    return list.concat(farms.map(function(f){ return {id:'farm:' + f, icon:'📍', label:(isAr ? 'الموقع: ' : 'Site: ') + (reg[f] && reg[f] !== f ? reg[f] + ' (' + f + ')' : f)}; })); };
  var _farmListPreSite = getFarmList;
  getFarmList = function(){ var o = _farmListPreSite.apply(this, arguments), a = daUserFarms(); if(!a) return o;
    var r = {}; Object.keys(o).forEach(function(k){ if(k !== 'all' && a.indexOf(k) >= 0) r[k] = o[k]; }); if(a.length > 1) r = Object.assign({all:o.all}, r); return r; };
  var _farmsPreSite = daFarms;
  daFarms = function(){ return _farmsPreSite.apply(this, arguments).filter(daSiteOk); };
  var _uuiPreSite = updateUserUI;
  updateUserUI = function(){ daEnforceSite(); return _uuiPreSite.apply(this, arguments); };
  var _setFarmPreSite = setFarm;
  setFarm = function(f){ if(f !== 'all' && !daSiteOk(f)) return; if(f === 'all' && daUserFarms() && daUserFarms().length === 1) return; return _setFarmPreSite.apply(this, arguments); };
  // new farms / tanks reach the phones
  if(typeof daTabRefresh === 'function'){ var _refPreSite = daTabRefresh;
    daTabRefresh = async function(){ try{ if(typeof daPullSettings === 'function' && sbReady && navigator.onLine) await daPullSettings(); }catch(e){} return _refPreSite.apply(this, arguments); }; }
  var _pullPreSite = daRealtimePull;
  daRealtimePull = async function(){ var v0 = _dataVer, r = await _pullPreSite.apply(this, arguments);
    if(_dataVer !== v0 && ['feed-sheet', 'wq-sheet', 'tx-sampling'].indexOf(currentView) >= 0 && !(window._daActiveTab && window._daActiveTab.dirty)){
      var a = document.activeElement; if(!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && document.getElementById('content').contains(a))) show(currentView, true); }
    return r; };
}
