// ══════════════════════════════════════════════════════════
//  PHONE HEADER + UPDATES THAT REACH THE WORKERS (owner, 2026-11-08)
// ══════════════════════════════════════════════════════════
// Header: before login only the brand and EN (no farm picker / back / "login" chip — the form is on the page);
// on narrow screens one compact row. Updates: a new version applies ITSELF when nothing is at risk (no unsaved input,
// nothing waiting to sync, not typing); otherwise the banner asks to save first. A page loaded from a stale cache is
// caught at start (server's Last-Modified newer than the page's). The version (= publish time) shows on the login card
// and in the guide, so the owner can check a worker's phone.
(function(){
  var css = ''
    + 'body.da-out #user-badge,body.da-out #back-btn,body.da-out #farm-dd-wrap,body.da-out #offline-status,body.da-out #sb-status{display:none!important}'
    + '@media (max-width:560px){'
    + 'header.top{padding:6px 8px!important;gap:6px!important;flex-wrap:nowrap!important}'
    + 'header.top .brand{min-width:0;flex-shrink:1}#brand-title{font-size:15px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38vw}#sb-status{display:none!important}'
    + 'header.top .top-right{display:flex;flex-wrap:nowrap!important;align-items:center;gap:4px!important;overflow-x:auto;scrollbar-width:none;flex-shrink:0;max-width:62vw}header.top .top-right::-webkit-scrollbar{display:none}'
    + '#offline-status{padding:4px 7px!important;margin-inline-end:2px!important}'
    + '#user-badge{padding:4px 8px!important;max-width:96px;overflow:hidden;text-overflow:ellipsis;margin-inline-end:2px!important}'
    + '#back-btn{padding:5px 8px!important}#back-lbl{display:none}'
    + '#farm-dd-btn{min-width:0!important;padding:5px 8px!important;font-size:12px!important}#lang-btn{padding:4px 8px!important}'
    + '}';
  var st = document.createElement('style'); st.id = 'da-mobile-css'; st.textContent = css; document.head.appendChild(st);
})();
function daOutClass(){ document.body.classList.toggle('da-out', !currentUser); }
function daVersionText(){ var d = new Date(document.lastModified); if(isNaN(d)) return APP_VERSION;
  var p = function(n){ return ('0' + n).slice(-2); }; return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
function daUpdateSafe(){
  var dirty = typeof DA_TABS !== 'undefined' && DA_TABS.some(function(t){ return t.dirty; }), q = 0;
  try{ q = (getOfflineQueue() || []).length; }catch(e){}
  var a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  return !dirty && !q && !typing;
}
function daApplyUpdateWhenSafe(){
  if(daUpdateSafe()){ toast('🔄 بيتحدث لآخر نسخة...'); setTimeout(function(){ location.reload(); }, 1200); return true; }
  return false;
}
async function daStaleCheck(){   // the page itself came from a stale cache?
  try{ var r = await fetch(location.href.split('#')[0], {method:'HEAD', cache:'no-store'}), lm = r.headers.get('Last-Modified'); if(!lm) return;
    var server = new Date(lm), mine = new Date(document.lastModified); if(!isNaN(server) && !isNaN(mine) && server - mine > 60000) daShowUpdateBanner(); }catch(e){}
}
if(!window._daMobileWrapped){
  window._daMobileWrapped = true;
  var _uuiPreMob = updateUserUI;
  updateUserUI = function(){ var r = _uuiPreMob.apply(this, arguments); daOutClass(); return r; };
  var _bannerPreMob = daShowUpdateBanner;
  daShowUpdateBanner = function(){
    if(daApplyUpdateWhenSafe()) return;   // nothing at risk: just update
    _bannerPreMob.apply(this, arguments);
    var b = document.getElementById('upd-banner'); if(b && b.firstChild && b.firstChild.nodeType === 3) b.firstChild.nodeValue = '🔄 فيه نسخة جديدة — احفظ شغلك وبعدين اضغط ';
    if(!window._daUpdRetry) window._daUpdRetry = setInterval(function(){ if(document.getElementById('upd-banner') && daApplyUpdateWhenSafe()){ clearInterval(window._daUpdRetry); } }, 20000);   // updates as soon as it is safe
  };
  var _loginPreMob = renderLoginPage;
  renderLoginPage = function(){ var h = _loginPreMob.apply(this, arguments); return typeof h === 'string' ? h + '<div id="da-ver" style="text-align:center;font-size:11px;color:var(--muted);margin-top:-30px;padding-bottom:20px" dir="ltr">v ' + daVersionText() + '</div>' : h; };
  if(VIEWS.help){ var _helpPreMob = VIEWS.help; VIEWS.help = function(){ var h = _helpPreMob.apply(this, arguments); return typeof h === 'string' ? h + '<div style="text-align:center;font-size:11px;color:var(--muted);margin:14px 0" dir="ltr">Farm Manager v ' + daVersionText() + '</div>' : h; }; }
  setTimeout(daOutClass, 0); setTimeout(daStaleCheck, 4000);
}
