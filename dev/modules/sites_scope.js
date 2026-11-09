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
function daSiteBadges(){
  if(typeof _umProfiles === 'undefined') return; var rows = document.querySelectorAll('#content table tbody tr');
  _umProfiles.forEach(function(p, i){ var tr = rows[i]; if(!tr || tr.querySelector('.um-site')) return; var td = tr.cells[2]; if(!td) return;
    var f = (p.role === 'admin' ? [] : (p.perms || []).filter(function(x){ return String(x).indexOf('farm:') === 0; }).map(function(x){ return x.slice(5); }));
    var b = document.createElement('div'); b.className = 'um-site'; b.style.cssText = 'font-size:12px;margin-top:3px;font-weight:700;color:' + (f.length ? 'var(--teal)' : 'var(--muted)');
    b.textContent = '📍 ' + (f.length ? f.join('، ') : 'كل الأماكن'); td.appendChild(b); });
}
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
  // the sites in their own, clearly marked box (not lost at the end of the permissions grid)
  var _permsHtmlPreSite = umPermsHTML;
  umPermsHTML = function(prefix, checked){
    var all = getPermsList(), base = all.filter(function(p){ return String(p.id).indexOf('farm:') !== 0; }), sites = all.filter(function(p){ return String(p.id).indexOf('farm:') === 0; });
    var _gp = getPermsList; getPermsList = function(){ return base; }; var h; try{ h = _permsHtmlPreSite.call(this, prefix, checked); } finally { getPermsList = _gp; }
    if(!sites.length) return h;
    return h + '<div class="um-sites" style="margin-top:14px;padding:12px 14px;border:2px solid var(--teal);border-radius:12px;background:#f0fdfa">'
      + '<div style="font-weight:800;font-size:15px;margin-bottom:2px">📍 المكان — يشتغل فين؟</div><div style="font-size:12px;color:var(--muted);margin-bottom:10px">سيبها فاضية = يشوف كل الأماكن. علّم مكانه بس = يشوفه هو بس، ومش هيقدر يفتح غيره.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + sites.map(function(p){ var nm = p.label.replace(/^(الموقع: |Site: )/, '');
        return '<label style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:#fff;border:1.5px solid var(--line);border-radius:10px;cursor:pointer;font-size:15px;font-weight:700"><input type="checkbox" id="' + prefix + p.id + '"' + (checked.indexOf(p.id) >= 0 ? ' checked' : '') + ' style="width:18px;height:18px"/>📍 ' + daEsc(nm) + '</label>'; }).join('') + '</div></div>';
  };
  var _farmListPreSite = getFarmList;
  getFarmList = function(){ var o = _farmListPreSite.apply(this, arguments), a = daUserFarms(); if(!a) return o;
    var r = {}; Object.keys(o).forEach(function(k){ if(k !== 'all' && a.indexOf(k) >= 0) r[k] = o[k]; }); if(a.length > 1) r = Object.assign({all:o.all}, r); return r; };
  var _farmsPreSite = daFarms;
  daFarms = function(){ return _farmsPreSite.apply(this, arguments).filter(daSiteOk); };
  var _loadUsersPreSite = adminLoadUsers;   // the users list shows where each one works
  adminLoadUsers = async function(){ var r = await _loadUsersPreSite.apply(this, arguments); daSiteBadges(); return r; };
  var _uuiPreSite = updateUserUI;
  updateUserUI = function(){ daEnforceSite(); return _uuiPreSite.apply(this, arguments); };
  var _setFarmPreSite = setFarm;
  setFarm = function(f){ if(f !== 'all' && !daSiteOk(f)) return; if(f === 'all' && daUserFarms() && daUserFarms().length === 1) return; return _setFarmPreSite.apply(this, arguments); };
  // new farms / tanks reach the phones
  if(typeof daTabRefresh === 'function'){ var _refPreSite = daTabRefresh;
    daTabRefresh = async function(){ try{ if(typeof daPullSettings === 'function' && sbReady && navigator.onLine) await daPullSettings(); }catch(e){}
      try{ if(typeof daCheckUpdate === 'function'){ if(_verTag === null) await daCheckUpdate(); await daCheckUpdate(); } }catch(e){}   // 🔄 also brings a newer version of the tool
      return _refPreSite.apply(this, arguments); }; }
  var _pullPreSite = daRealtimePull;
  daRealtimePull = async function(){ var v0 = _dataVer, r = await _pullPreSite.apply(this, arguments);
    if(_dataVer !== v0 && ['feed-sheet', 'wq-sheet', 'tx-sampling'].indexOf(currentView) >= 0 && !(window._daActiveTab && window._daActiveTab.dirty)){
      var a = document.activeElement; if(!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && document.getElementById('content').contains(a))) show(currentView, true); }
    return r; };
}
