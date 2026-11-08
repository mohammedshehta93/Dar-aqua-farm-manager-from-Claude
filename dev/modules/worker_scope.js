// ══════════════════════════════════════════════════════════
//  WORKERS SEE ONLY WHAT THEY WERE GIVEN (owner, 2026-11-08)
// ══════════════════════════════════════════════════════════
// Several planning pages share an entry permission (feeding regime / schedule / print are under input_feeding), so a
// worker with "feeding" saw them too. For the worker role each entry permission now opens exactly its entry page;
// view / manage / export permissions open their pages as before; the guide is always there (worker part only).
// Office-only buttons (AquaManager copy, print, photo, feed-type and entry-mode settings) are hidden from workers.
var DA_WORKER_PAGES = {input_feeding:['feed-sheet'], input_mortality:['feed-sheet'], input_wq:['wq-sheet'], input_sampling:['tx-sampling'],
  input_harvest:['tx-harvesting', 'tx-transfer'], approve_data:['review-queue']};
var DA_WORKER_ALWAYS = ['help', 'account', 'login-page', 'legal'];
function daWorkerAllows(v){
  if(DA_WORKER_ALWAYS.indexOf(v) >= 0) return true;
  if(Object.keys(DA_WORKER_PAGES).some(function(p){ return DA_WORKER_PAGES[p].indexOf(v) >= 0 && hasPerm(p); })) return true;
  var need = VIEW_PERMS[v]; if(need === 'input_health') return hasPerm(need);   // treatments: the health pages themselves
  return !!need && /^(view_|manage_|export_)/.test(need) && hasPerm(need);
}
(function(){ var st = document.createElement('style'); st.id = 'da-worker-css';
  st.textContent = 'body.da-worker #fs-aqx,body.da-worker #fs-print,body.da-worker #fs-photo,body.da-worker #fs-mode,body.da-worker #wqs-aqx,body.da-worker #wqs-print,body.da-worker #wqs-photo,body.da-worker #sp-print,body.da-worker #sp-photo,'
    + 'body.da-worker .field:has(> [id^="fs-prod-"]){display:none!important}'; document.head.appendChild(st); })();
function daWorkerClass(){ document.body.classList.toggle('da-worker', !!currentUser && currentUserRole === 'worker'); }
if(!window._daWorkerWrapped){
  window._daWorkerWrapped = true;
  var _canPreWorker = canAccessView;
  canAccessView = function(v){ if(currentUser && currentUserRole === 'worker' && !daWorkerAllows(v)) return false; return _canPreWorker.apply(this, arguments); };
  var _homePreWorker = homeView;
  homeView = function(){ if(currentUser && currentUserRole === 'worker'){ var order = ['feed-sheet', 'wq-sheet', 'tx-sampling', 'tx-harvesting', 'review-queue', 'help'];
      for(var i = 0; i < order.length; i++) if(canAccessView(order[i])) return order[i]; } return _homePreWorker.apply(this, arguments); };
  var _uuiPreWorker = updateUserUI;
  updateUserUI = function(){ var r = _uuiPreWorker.apply(this, arguments); daWorkerClass(); return r; };
  var _tabsPreWorker = daTabs;   // the guide shows each role its own part (worker: worker; engineer: + engineer)
  daTabs = function(t, tabs, varName){
    if(varName === 'window._helpTab' && currentUser){ if(currentUserRole === 'worker') return ''; if(currentUserRole === 'engineer') tabs = tabs.filter(function(x){ return x[0] !== 'admin'; }); }
    return _tabsPreWorker.call(this, t, tabs, varName);
  };
  var _helpPreWorker = renderHelp;
  renderHelp = function(){ if(currentUser && currentUserRole === 'worker') window._helpTab = 'worker'; else if(currentUser && currentUserRole === 'engineer' && window._helpTab === 'admin') window._helpTab = 'engineer';
    return _helpPreWorker.apply(this, arguments); };
  if(VIEWS.help && !VIEWS.help._daW){ var _vh = VIEWS.help; VIEWS.help = function(){ if(currentUser && currentUserRole === 'worker') window._helpTab = 'worker'; return _vh.apply(this, arguments); }; VIEWS.help._daW = true; }
  var _toastPreWorker = toast;   // alert pop-ups about the farm are for the office, not for a worker without the alerts page
  toast = function(m){ if(currentUser && currentUserRole === 'worker' && /التنبيهات الذكية|تنبيه حرج/.test(String(m)) && !canAccessView('smart')) return; return _toastPreWorker.apply(this, arguments); };
  setTimeout(daWorkerClass, 0);
}
