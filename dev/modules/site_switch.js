// ══════════════════════════════════════════════════════════
//  A WORKER WITH MORE THAN ONE SITE CAN SWITCH (owner, 2026-11-22)
// ══════════════════════════════════════════════════════════
// The site lock puts a worker on his first site and the top farm menu is hidden for workers (it is an office control),
// and the entry sheets only offer a farm choice when no farm is set — so a worker given F1 and F2 was stuck on F1 in
// every sheet. Now a worker with more than one site gets "📍 F1 | F2" at the top of his entry pages; a tap switches
// every page to that site (setFarm — the same as the office menu).
var DA_SITE_PAGES = ['feed-sheet', 'wq-sheet', 'tx-sampling', 'tx-harvesting', 'tx-transfer'];
function daSiteSwitchHtml(){
  var mine = typeof daUserFarms === 'function' ? daUserFarms() : null; if(!mine || mine.length < 2) return '';
  var reg = typeof getFarmsRegistry === 'function' ? getFarmsRegistry() : {};
  return '<div id="da-site-sw" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><span style="font-size:18px">📍</span>'
    + mine.map(function(f){ var on = farmFilter === f; return '<button class="da-site" data-f="' + daEsc(f) + '" onclick="daSiteGo(&quot;' + daEsc(f) + '&quot;)" style="padding:9px 18px;border-radius:99px;border:2px solid var(--teal);font:inherit;font-weight:800;font-size:15px;cursor:pointer;background:' + (on ? 'var(--teal);color:#fff' : '#fff;color:var(--teal)') + '">' + daEsc(f) + (reg[f] && reg[f] !== f ? ' <span style="font-weight:400;font-size:12px">' + daEsc(reg[f]) + '</span>' : '') + '</button>'; }).join('') + '</div>';
}
function daSiteGo(f){
  if(farmFilter === f) return;
  if(typeof daTabDirty === 'function' && daTabDirty() && !confirm(isAr ? 'فيه حاجات مش محفوظة في الصفحة دي — تسيبها وتروح ' + f + '؟' : 'Unsaved changes on this page — leave them and go to ' + f + '?')) return;
  setFarm(f); show(currentView, true);
}
if(!window._daSiteSwWrapped){
  window._daSiteSwWrapped = true;
  var _showPreSiteSw = show;
  show = function(v){ var r = _showPreSiteSw.apply(this, arguments);
    try{ var old = document.getElementById('da-site-sw'); if(old) old.remove();
      if(currentUser && currentUserRole === 'worker' && DA_SITE_PAGES.indexOf(currentView) >= 0){ var html = daSiteSwitchHtml(), c = document.getElementById('content');
        if(html && c){ var ph = c.querySelector('.ph'); if(ph) ph.insertAdjacentHTML('afterend', html); else c.insertAdjacentHTML('afterbegin', html); } } }catch(e){}
    return r; };
}
