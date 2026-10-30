// ══════════════════════════════════════════════════════════
//  TABS — every opened page stays open (with what was typed in it) until its tab is closed
// ══════════════════════════════════════════════════════════
// Each tab owns a <div> pane. Only the active pane is attached to #content (so getElementById never sees a hidden page);
// hidden panes are kept detached in memory with their inputs intact. One tab per page.
// "dirty" = something was typed since the last save on that tab. Dirty tabs are never re-rendered by background
// refreshes, are kept as-is when re-opened from the menu, and ask before closing / logging out / leaving the site.
var DA_TABS = [], _daActiveTab = null, DA_TABS_MAX = 10;
function daTabsEnabled(v){ return !!(typeof currentUser !== 'undefined' && currentUser) && v !== 'login-page' && v !== 'reset-password'; }
function daTabFind(v){ for(var i = 0; i < DA_TABS.length; i++) if(DA_TABS[i].v === v) return DA_TABS[i]; return null; }
function daTabKey(){ return _dataVer + '|' + (typeof farmFilter !== 'undefined' ? farmFilter : '') + '|' + (typeof currentLang !== 'undefined' ? currentLang : ''); }
function daTabsReset(){ DA_TABS = []; _daActiveTab = null; var b = document.getElementById('da-tabbar'); if(b){ b.innerHTML = ''; b.style.display = 'none'; } }
function daTabsDirty(){ return DA_TABS.filter(function(t){ return t.dirty; }); }

// called by show() before rendering; returns true when the existing pane is kept (no render)
function daTabsActivate(v){
  if(!daTabsEnabled(v)){ daTabsReset(); return false; }
  var prev = _daActiveTab, t = daTabFind(v), same = !!prev && prev === t;
  if(prev && !same){ prev.scroll = window.scrollY || 0; }
  if(!t){ t = {v:v, el:document.createElement('div'), dirty:false, rendered:false, key:'', scroll:0}; t.el.className = 'da-pane'; DA_TABS.push(t); }
  t.used = Date.now(); _daActiveTab = t;
  daTabsTrim();
  var keep = t.rendered && (same ? (window._daBgRender && t.dirty)
                                 : (t.dirty || (window._daTabClick && t.key === daTabKey())));
  var el = document.getElementById('content');
  if(el && t.el.parentNode !== el){ while(el.firstChild) el.removeChild(el.firstChild); el.appendChild(t.el); }
  if(keep){ var y = t.scroll || 0; setTimeout(function(){ try{ window.scrollTo(0, y); }catch(e){} }, 0); }
  return keep;
}
function daTabsSetHtml(el, html){
  var t = _daActiveTab;
  if(!t || !daTabsEnabled(t.v) || t.v !== currentView){ if(el) el.innerHTML = html; return; }
  t.el.innerHTML = html; t.rendered = true; t.dirty = false; t.key = daTabKey();
}
function daTabsTrim(){
  while(DA_TABS.length > DA_TABS_MAX){
    var home = typeof homeView === 'function' ? homeView() : '', c = DA_TABS.filter(function(t){ return !t.dirty && t !== _daActiveTab && t.v !== home; })
      .sort(function(a, b){ return a.used - b.used; })[0];
    if(!c) break;                                 // everything left has unsaved input — keep it
    DA_TABS.splice(DA_TABS.indexOf(c), 1);
  }
}
function daTabClick(v){ window._daTabClick = true; try{ show(v); }finally{ window._daTabClick = false; } }
function daTabClose(v, ev){
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  var t = daTabFind(v); if(!t) return;
  if(t.dirty && !confirm('فيه بيانات اتكتبت في "' + daTabTitle(t) + '" ومتحفظتش. تقفل التاب من غير حفظ؟')) return;
  DA_TABS.splice(DA_TABS.indexOf(t), 1);
  if(t === _daActiveTab){
    _daActiveTab = null;
    var next = DA_TABS.slice().sort(function(a, b){ return b.used - a.used; })[0];
    daTabClick(next ? next.v : homeView());
  } else daRenderTabBar();
}
function daTabCloseOthers(){
  var d = daTabsDirty().filter(function(t){ return t !== _daActiveTab; });
  if(d.length && !confirm(d.length + ' تاب فيهم بيانات متحفظتش. تقفلهم برضه؟')) return;
  DA_TABS = DA_TABS.filter(function(t){ return t === _daActiveTab; }); daRenderTabBar();
}
function daNavItem(v){
  var r = null, a = DA_NAV_ALIAS[v];
  DA_NAV.forEach(function(g){ g.items.forEach(function(i){ if(!r && i[0] === v) r = i; }); });
  if(!r && a) DA_NAV.forEach(function(g){ g.items.forEach(function(i){ if(!r && i[0] === a) r = i; }); });
  return r;
}
function daTabTitle(t){
  var it = daNavItem(t.v); if(it) return it[2];
  var h = t.el && t.el.querySelector('h2'); if(h){ var x = h.textContent.replace(/^[^\u0600-\u06FFA-Za-z0-9]+/, '').trim().slice(0, 28); if(x) return x; }
  return t.v;
}
function daTabIcon(t){ var it = daNavItem(t.v); return it ? it[1] : '📄'; }
function daRenderTabBar(){
  var nav = document.getElementById('topnav'), b = document.getElementById('da-tabbar');
  if(!b && nav){ b = document.createElement('div'); b.id = 'da-tabbar'; b.className = 'no-print'; nav.parentNode.insertBefore(b, nav.nextSibling); }
  if(!b) return;
  if(!_daActiveTab || !daTabsEnabled(_daActiveTab.v)){ b.innerHTML = ''; b.style.display = 'none'; return; }
  b.style.display = '';
  var hdr = document.querySelector('header.top'), off = (hdr ? hdr.offsetHeight : 56) + (nav && nav.style.display !== 'none' ? nav.offsetHeight : 0);
  b.style.top = off + 'px';
  var home = homeView(), list = DA_TABS.slice();
  if(!daTabFind(home)) list.unshift({v:home, el:document.createElement('div'), virtual:true});
  else list.sort(function(a, b2){ return (a.v === home ? -1 : 0) - (b2.v === home ? -1 : 0); });
  var h = '<div class="dt-row">' + list.map(function(t){
    var on = t === _daActiveTab, pin = t.v === home;
    return '<div class="dt' + (on ? ' on' : '') + (t.dirty ? ' dirty' : '') + '" data-tab="' + daEsc(t.v) + '" onclick="daTabClick(this.dataset.tab)" title="' + daEsc(daTabTitle(t)) + (t.dirty ? ' — فيه بيانات متحفظتش' : '') + '">'
      + '<span class="dt-ic">' + daTabIcon(t) + '</span><span class="dt-t">' + daEsc(daTabTitle(t)) + '</span>'
      + (t.dirty ? '<span class="dt-dot">●</span>' : '')
      + (pin ? '' : '<button class="dt-x" data-tab="' + daEsc(t.v) + '" onclick="daTabClose(this.dataset.tab, event)" title="قفل">×</button>') + '</div>';
  }).join('') + '</div>';
  h += '<button id="dt-refresh" class="dt-all" onclick="daTabRefresh()" title="تحديث الصفحة — يجيب آخر بيانات ويعرضها" style="font-size:13px;color:var(--teal);font-weight:700">🔄 تحديث</button>';
  if(DA_TABS.length > 2) h += '<button class="dt-all" onclick="daTabCloseOthers()" title="قفل كل التابات التانية">⨯⨯</button>';
  b.innerHTML = h;
  var on = b.querySelector('.dt.on'); if(on && on.scrollIntoView) try{ on.scrollIntoView({block:'nearest', inline:'nearest'}); }catch(e){}
}
function daTabMarkDirty(t, d){ if(!t || t.dirty === d) return; t.dirty = d; daRenderTabBar(); }
// 🔄 refresh: pull what others entered, then redraw this page (asks first if it holds unsaved input)
async function daTabRefresh(){
  var t = _daActiveTab; if(!t) return;
  if(t.dirty && !confirm('فيه بيانات اتكتبت في "' + daTabTitle(t) + '" ومتحفظتش. التحديث هيمسحها. تكمل؟')) return;
  var b = document.getElementById('dt-refresh'); if(b){ b.disabled = true; b.textContent = '⏳'; }
  try{ if(typeof daRealtimePull === 'function' && sbReady && navigator.onLine) await daRealtimePull(); }catch(e){}
  _dataVer++; t.dirty = false; show(currentView, true); toast('🔄 اتحدثت');
}

// typing in a data field marks the active tab dirty (selects, dates, search/filter boxes don't)
document.addEventListener('input', function(e){
  var x = e.target, t = _daActiveTab; if(!t || !x || !t.el.contains(x)) return;
  var tag = x.tagName, ty = String(x.type || '').toLowerCase();
  if(!(tag === 'TEXTAREA' || (tag === 'INPUT' && ['', 'text', 'number', 'tel', 'email'].indexOf(ty) >= 0))) return;
  if(x.closest('[data-nodirty]') || /search|filter|query|بحث/i.test((x.id || '') + ' ' + (x.placeholder || ''))) return;
  daTabMarkDirty(t, true);
}, true);
// a real save (the transaction store actually changed) clears the active tab's dirty mark
['addTX', 'updateTX', 'deleteTX'].forEach(function(name){
  var f = window[name]; if(typeof f !== 'function' || f._daTabWrapped) return;
  var w = function(){ var v0 = _dataVer, r = f.apply(this, arguments); if(_dataVer !== v0) daTabMarkDirty(_daActiveTab, false); return r; };
  w._daTabWrapped = true; window[name] = w;
});
if(typeof saveSettings === 'function' && !saveSettings._daTabWrapped){
  var _saveSettingsPreTabs = saveSettings;   // every settings page saves through here (alerts, standards, harvest …)
  saveSettings = function(){ var r = _saveSettingsPreTabs.apply(this, arguments); daTabMarkDirty(_daActiveTab, false); return r; };   // (saveSettings itself already bumps _dataVer)
  saveSettings._daTabWrapped = true;
}
if(typeof applySettings === 'function' && !applySettings._daTabWrapped){
  var _applySettingsPreTabs = applySettings;
  applySettings = function(){ var r = _applySettingsPreTabs.apply(this, arguments); daTabMarkDirty(_daActiveTab, false); return r; };
  applySettings._daTabWrapped = true;
}
// background refreshes (auto-refresh, sync, other users' entries) never wipe unsaved input
function daBgRefresh(v){ window._daBgRender = true; try{ show(v || currentView, true); }finally{ window._daBgRender = false; } }
window.addEventListener('beforeunload', function(e){ if(daTabsDirty().length){ e.preventDefault(); e.returnValue = ''; return ''; } });
if(!window._daTabsWrapped){
  window._daTabsWrapped = true;
  var _showPreTabs = show;
  show = function(v, skip){ var r = _showPreTabs(v, skip); try{ daRenderTabBar(); }catch(e){} return r; };
  var _logoutPreTabs = doLogout;
  doLogout = async function(skipConfirm){
    var d = daTabsDirty();
    if(!skipConfirm && d.length && !confirm('فيه بيانات متحفظتش في: ' + d.map(daTabTitle).join('، ') + '. تخرج وتضيعها؟')) return;
    return _logoutPreTabs.apply(this, arguments);
  };
  if(typeof daWipeLocalTenant === 'function'){
    var _wipePreTabs = daWipeLocalTenant;
    daWipeLocalTenant = async function(){ daTabsReset(); return _wipePreTabs.apply(this, arguments); };
  }
}
(function(){
  if(document.getElementById('da-tabs-css')) return;
  var c = document.createElement('style'); c.id = 'da-tabs-css';
  c.textContent = '#da-tabbar{position:sticky;z-index:48;background:#eef2f5;border-bottom:1px solid var(--line);display:flex;align-items:flex-end;gap:4px;padding:4px 8px 0}'
    + '#da-tabbar .dt-row{display:flex;gap:2px;overflow-x:auto;flex:1;scrollbar-width:thin;-webkit-overflow-scrolling:touch}'
    + '#da-tabbar .dt{display:flex;align-items:center;gap:5px;padding:6px 8px 6px 10px;border:1px solid var(--line);border-bottom:0;border-radius:8px 8px 0 0;background:#e2e8f0;font-size:12px;color:var(--muted);cursor:pointer;white-space:nowrap;max-width:190px;user-select:none}'
    + '#da-tabbar .dt.on{background:#fff;color:var(--deep);font-weight:700;border-top:3px solid var(--teal);margin-bottom:-1px;padding-bottom:7px}'
    + '#da-tabbar .dt-t{overflow:hidden;text-overflow:ellipsis}#da-tabbar .dt-dot{color:var(--amber);font-size:14px;line-height:1}'
    + '#da-tabbar .dt-x{border:0;background:transparent;font-size:16px;line-height:1;color:var(--muted);cursor:pointer;padding:0 2px;border-radius:4px}#da-tabbar .dt-x:hover{background:#fee2e2;color:#b91c1c}'
    + '#da-tabbar .dt-all{border:0;background:transparent;color:var(--muted);font-size:11px;cursor:pointer;padding:6px}'
    + '@media(max-width:700px){#da-tabbar .dt{max-width:140px;padding:5px 6px 5px 8px}#da-tabbar .dt-x{font-size:18px;padding:0 4px}}'
    + '@media print{#da-tabbar{display:none!important}}';
  document.head.appendChild(c);
})();
