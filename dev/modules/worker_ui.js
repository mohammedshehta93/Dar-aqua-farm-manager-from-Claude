// ══════════════════════════════════════════════════════════
//  A SIMPLE SCREEN FOR WORKERS (owner, 2026-11-08)
// ══════════════════════════════════════════════════════════
// Workers get big buttons for their own pages instead of the menu + tab strip, a calm header (no farm picker / back),
// their name on the user chip, and a date control that speaks the app's language (the phone's date field follows the
// PHONE's language): ◀ day ▶ · Today, tapping the date opens the calendar. The date control is used on the entry
// sheets for everyone.
var DA_WBAR = [['feed-sheet', '📋', 'العلف', 'Feed'], ['wq-sheet', '🧪', 'المياه', 'Water'], ['tx-sampling', '🔬', 'العينات', 'Samples'],
  ['tx-harvesting', '🎣', 'الحصاد', 'Harvest'], ['tx-transfer', '🔄', 'النقل', 'Transfer'], ['review-queue', '✔️', 'المراجعة', 'Review'], ['help', '❓', 'الدليل', 'Guide']];
(function(){ var st = document.createElement('style'); st.id = 'da-wui-css';
  st.textContent = 'body.da-worker #topnav,body.da-worker #da-tabbar,body.da-worker #farm-dd-wrap,body.da-worker #back-btn,body.da-worker #mob-nav{display:none!important}'
    + '#da-wbar{display:none}body.da-worker #da-wbar{display:flex;gap:6px;padding:8px;background:#fff;border-bottom:1px solid var(--line);overflow-x:auto;position:sticky;top:0;z-index:50;scrollbar-width:none}'
    + '#da-wbar::-webkit-scrollbar{display:none}#da-wbar button{flex:0 0 auto;min-height:46px;padding:6px 11px;border-radius:12px;border:2px solid var(--line);background:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap}'
    + '#da-wbar button.on{background:var(--teal);border-color:var(--teal);color:#fff}#da-wbar .rf{margin-inline-start:auto;color:var(--teal);position:sticky;inset-inline-end:0;box-shadow:-6px 0 8px -4px rgba(0,0,0,.15)}'
    + '.fs-tot .fs-sumh,.fs-tot .fs-sum{display:none}'   // daily-total mode: the total column repeats the quantity
    + '.da-dctl{display:inline-flex;align-items:stretch;gap:4px}.da-dctl button{min-width:40px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;font-size:16px;cursor:pointer}'
    + '.da-dctl .lbl{position:relative;display:flex;align-items:center;padding:7px 12px;border:1.5px solid var(--line);border-radius:8px;background:#fff;font-weight:700;font-size:14px;white-space:nowrap;cursor:pointer;min-width:140px;justify-content:center}'
    + '.da-dctl .lbl input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;border:0;padding:0}.da-dctl .today{font-size:13px;padding:0 10px}';
  document.head.appendChild(st); })();
function daWorkerBar(){
  var b = document.getElementById('da-wbar'); if(!b){ b = document.createElement('div'); b.id = 'da-wbar'; b.className = 'no-print'; var hd = document.querySelector('header.top'); if(!hd) return; hd.parentNode.insertBefore(b, hd.nextSibling); }
  if(!(currentUser && currentUserRole === 'worker')){ b.innerHTML = ''; return; }
  b.innerHTML = DA_WBAR.filter(function(x){ return canAccessView(x[0]); }).map(function(x){ return '<button data-v="' + x[0] + '" class="' + (x[0] === currentView ? 'on' : '') + '">' + x[1] + ' ' + (isAr ? x[2] : x[3]) + '</button>'; }).join('')
    + '<button class="rf" data-v="__refresh" title="' + (isAr ? 'تحديث' : 'Refresh') + '">🔄</button>';
  b.querySelectorAll('button').forEach(function(x){ x.onclick = function(){ if(x.dataset.v === '__refresh'){ if(typeof daTabRefresh === 'function') daTabRefresh(); else show(currentView, true); } else show(x.dataset.v); }; });
}
function daCompactStatus(){
  var e = document.getElementById('offline-status'); if(!e) return; var full = e.dataset.full && e.textContent.length <= 6 ? e.dataset.full : e.textContent;
  if(window.innerWidth <= 560){ var m = full.match(/^\s*(\S+)/), n = full.match(/\d+/); e.dataset.full = full; e.title = daEn ? daEn(full) : full; e.textContent = (m ? m[1] : '•') + (n ? ' ' + n[0] : ''); e.style.maxWidth = 'none'; }
  else if(e.dataset.full){ e.textContent = e.dataset.full; delete e.dataset.full; }
}
function daFixEmptySheet(){   // a sheet opened before the tanks arrived from the cloud has no farm: pick one and redraw (nothing typed yet)
  if(['feed-sheet', 'wq-sheet'].indexOf(currentView) < 0) return;   // nothing to fix unless a sheet is open
  var farms = daFarms(); if(!farms.length) return; var dirty = window._daActiveTab && window._daActiveTab.dirty;
  [['feed-sheet', '_fs'], ['wq-sheet', '_wqs']].forEach(function(x){ var st = window[x[1]];
    if(currentView === x[0] && !dirty && (!st || farms.indexOf(st.farm) < 0)){ window[x[1]] = Object.assign(st || {}, {farm:farmFilter && farmFilter !== 'all' && farms.indexOf(farmFilter) >= 0 ? farmFilter : farms[0]}); show(x[0], true); } });
}
function daCalOpen(inp, anchor, set){
  var old = document.getElementById('da-cal'); if(old){ old.remove(); if(old._for === inp) return; }
  var L = isAr ? 'ar' : 'en', full = {en:['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], ar:DA_MONTHS.ar};
  var cur = (inp.value || daToday()).split('-'), y = +cur[0], m = +cur[1] - 1, c = document.createElement('div'); c.id = 'da-cal'; c._for = inp; c.dir = isAr ? 'rtl' : 'ltr';
  c.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:10px;width:290px;font-size:14px';
  var draw = function(){
    var first = new Date(Date.UTC(y, m, 1)).getUTCDay(), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), max = inp.max || '9999-12-31', p2 = function(n){ return ('0' + n).slice(-2); };
    var hh = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><button data-k="-1" style="border:0;background:#f1f5f9;border-radius:8px;width:40px;height:36px;font-size:16px;cursor:pointer">' + (isAr ? '▶' : '◀') + '</button>'
      + '<b>' + full[L][m] + ' ' + y + '</b><button data-k="1" style="border:0;background:#f1f5f9;border-radius:8px;width:40px;height:36px;font-size:16px;cursor:pointer"' + (y + '-' + p2(m + 1) >= max.slice(0, 7) ? ' disabled' : '') + '>' + (isAr ? '◀' : '▶') + '</button></div>'
      + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center">' + DA_DAYS[L].map(function(d){ return '<div style="font-size:11px;color:var(--muted)">' + d.slice(0, isAr ? 5 : 2) + '</div>'; }).join('');
    for(var i = 0; i < first; i++) hh += '<div></div>';
    for(var d = 1; d <= days; d++){ var v = y + '-' + p2(m + 1) + '-' + p2(d), dis = v > max || (inp.min && v < inp.min), on = v === inp.value, td = v === daToday();
      hh += '<button data-d="' + v + '"' + (dis ? ' disabled' : '') + ' style="height:36px;border-radius:8px;cursor:' + (dis ? 'default' : 'pointer') + ';font:inherit;border:' + (td ? '2px solid var(--teal)' : '1px solid transparent') + ';background:' + (on ? 'var(--teal)' : '#fff') + ';color:' + (on ? '#fff' : dis ? '#cbd5e1' : 'inherit') + '">' + d + '</button>'; }
    c.innerHTML = hh + '</div>';
  };
  draw(); document.body.appendChild(c);
  var r = anchor.getBoundingClientRect(); c.style.top = Math.min(r.bottom + 6, window.innerHeight - c.offsetHeight - 8) + 'px'; c.style.left = Math.max(6, Math.min(r.left, window.innerWidth - 296)) + 'px';
  c.addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b || b.disabled) return; e.stopPropagation();
    if(b.dataset.k){ m += +b.dataset.k; if(m < 0){ m = 11; y--; } if(m > 11){ m = 0; y++; } draw(); return; }
    if(b.dataset.d){ c.remove(); set(b.dataset.d); } });
  setTimeout(function(){ document.addEventListener('mousedown', function off(e){ if(!c.contains(e.target) && !anchor.contains(e.target)){ c.remove(); document.removeEventListener('mousedown', off, true); } }, true); }, 0);
}
var DA_DAYS = {en:['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ar:['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت']};
var DA_MONTHS = {en:['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], ar:['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']};
function daFmtDate(v){ var p = String(v || '').split('-'); if(p.length !== 3) return v || '—'; var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])), L = isAr ? 'ar' : 'en';
  return DA_DAYS[L][d.getUTCDay()] + ' ' + (+p[2]) + ' ' + DA_MONTHS[L][+p[1] - 1] + ' ' + p[0] + (v === daToday() ? (isAr ? ' (النهارده)' : ' (today)') : ''); }
var DA_DCTL_IDS = ['fs-date', 'wqs-date', 'wqw-date', 'sp-date', 'rf-date'];
function daDateCtl(root){
  DA_DCTL_IDS.forEach(function(id){ var inp = (root || document).querySelector ? (root || document).querySelector('#' + id) : null; if(!inp || inp.dataset.dctl) return; inp.dataset.dctl = '1';
    var w = document.createElement('span'); w.className = 'da-dctl'; w.dir = isAr ? 'rtl' : 'ltr';
    var prev = document.createElement('button'), lbl = document.createElement('span'), next = document.createElement('button'), today = document.createElement('button');
    prev.type = next.type = today.type = 'button'; prev.textContent = isAr ? '▶' : '◀'; next.textContent = isAr ? '◀' : '▶'; prev.title = isAr ? 'اليوم اللي قبله' : 'Previous day'; next.title = isAr ? 'اليوم اللي بعده' : 'Next day';
    today.className = 'today'; today.textContent = isAr ? 'النهارده' : 'Today'; lbl.className = 'lbl';
    inp.parentNode.insertBefore(w, inp); lbl.appendChild(document.createTextNode('')); lbl.appendChild(inp); w.appendChild(prev); w.appendChild(lbl); w.appendChild(next); w.appendChild(today);
    var paint = function(){ lbl.firstChild.nodeValue = daFmtDate(inp.value); next.disabled = !!inp.max && inp.value >= inp.max; today.style.display = inp.value === daToday() ? 'none' : ''; };
    var set = function(v){ if(!v || (inp.max && v > inp.max) || (inp.min && v < inp.min)) return; inp.value = v; paint(); inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true})); };
    prev.onclick = function(){ set(daAddDays(inp.value || daToday(), -1)); }; next.onclick = function(){ set(daAddDays(inp.value || daToday(), 1)); }; today.onclick = function(){ set(daToday()); };
    inp.style.pointerEvents = 'none'; inp.tabIndex = -1;   // the phone's calendar speaks the phone's language: ours speaks the app's
    lbl.addEventListener('click', function(){ daCalOpen(inp, lbl, set); });
    inp.addEventListener('change', paint); inp.addEventListener('input', paint); paint();
  });
}
if(!window._daWuiWrapped){
  window._daWuiWrapped = true;
  var _showPreWui = show;
  show = function(){ var r = _showPreWui.apply(this, arguments); daWorkerBar(); daDateCtl(document.getElementById('content'));
    if(currentUser && currentUserRole === 'worker' && currentView === 'account') document.querySelectorAll('#content input[type=password]').forEach(function(i){ var c = i.closest('.card'); if(c) c.style.display = 'none'; });   // passwords: the admin's job
    return r; };
  var _uuiPreWui = updateUserUI;
  updateUserUI = function(){ var r = _uuiPreWui.apply(this, arguments); daWorkerBar();
    var b = document.getElementById('user-badge'); if(b && currentUser && currentUserRole === 'worker'){ var nm = (getSession() || {}).name || daShowLogin(currentUser.email); b.textContent = '👤 ' + nm; }
    return r; };
  var _rawPreWui = daSetRAW;
  daSetRAW = function(){ var r = _rawPreWui.apply(this, arguments); setTimeout(daFixEmptySheet, 0); return r; };
  var _offPreWui = updateOfflineStatus;   // narrow phone: the status shows its dot (and a waiting count), full text on hover
  updateOfflineStatus = function(){ var r = _offPreWui.apply(this, arguments); daCompactStatus(); return r; };
  window.addEventListener('resize', daCompactStatus);
  var _tlPreWui = toggleLang;
  toggleLang = function(){ var r = _tlPreWui.apply(this, arguments); daWorkerBar(); updateUserUI(); return r; };
  new MutationObserver(function(){ var c = document.getElementById('content'); if(!c) return; daDateCtl(c);   // cheap: only the pages that show accounts are searched for internal addresses
    if(typeof daHideWorkerEmails === 'function' && (currentView === 'account' || currentView === 'user-management')) daHideWorkerEmails(c); })
    .observe(document.getElementById('content') || document.body, {childList:true, subtree:true});
}
