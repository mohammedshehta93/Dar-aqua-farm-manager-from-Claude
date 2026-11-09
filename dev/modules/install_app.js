// ══════════════════════════════════════════════════════════
//  INSTALL AS AN APP (owner, 2026-11-09)
// ══════════════════════════════════════════════════════════
// The app has a manifest and icons but no install button, and its service worker was never registered (some phones
// then never offer installing). Now: sw.js is registered (it only passes requests through — nothing cached, updates
// unaffected); Android / Chrome: "📲 Install the app" opens the phone's own install prompt; iPhone (no prompt there):
// three clear steps (Share → Add to Home Screen → Add). The button sits on the login page and in the worker's bar and
// disappears once the app runs installed.
var _daInstallEvt = null;
var DA_INST_T = {   // written in each language (the bold words split sentences, so they are not translated afterwards)
  ar:{btn:'📲 نزّل التطبيق', title:'📲 نزّل التطبيق على الموبايل', ok:'تمام', done:'✅ التطبيق بيتنزل — هتلاقيه على الشاشة الرئيسية', inst:'✅ اتنزل التطبيق — افتحه من الشاشة الرئيسية',
    ios:['اضغط زرار <b>المشاركة</b> ⬆️ تحت في Safari', 'اختار <b>إضافة إلى الشاشة الرئيسية</b> ➕', 'اضغط <b>إضافة</b> — الأيقونة هتظهر على الشاشة'],
    and:['افتح <b>قايمة المتصفح</b> ⋮ (فوق)', 'اختار <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>', 'اضغط <b>تثبيت</b> — الأيقونة هتظهر على الشاشة']},
  en:{btn:'📲 Install the app', title:'📲 Install the app on your phone', ok:'OK', done:'✅ Installing — you will find it on your home screen', inst:'✅ Installed — open it from your home screen',
    ios:['Tap the <b>Share</b> button ⬆️ at the bottom of Safari', 'Choose <b>Add to Home Screen</b> ➕', 'Tap <b>Add</b> — the icon appears on your screen'],
    and:['Open the <b>browser menu</b> ⋮ (top)', 'Choose <b>Install app</b> or <b>Add to Home screen</b>', 'Tap <b>Install</b> — the icon appears on your screen']},
  ur:{btn:'📲 ایپ انسٹال کریں', title:'📲 ایپ فون پر انسٹال کریں', ok:'ٹھیک ہے', done:'✅ ایپ انسٹال ہو رہی ہے — ہوم اسکرین پر ملے گی', inst:'✅ ایپ انسٹال ہو گئی — ہوم اسکرین سے کھولیں',
    ios:['Safari میں نیچے <b>شیئر</b> ⬆️ بٹن دبائیں', '<b>Add to Home Screen</b> ➕ چنیں', '<b>Add</b> دبائیں — آئیکن اسکرین پر آ جائے گا'],
    and:['براؤزر کا <b>مینو</b> ⋮ کھولیں (اوپر)', '<b>Install app</b> یا <b>Add to Home screen</b> چنیں', '<b>Install</b> دبائیں — آئیکن اسکرین پر آ جائے گا']}};
function daInstT(){ var l = typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); return DA_INST_T[l] || DA_INST_T[isAr ? 'ar' : 'en']; }
function daIsInstalled(){ try{ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }catch(e){ return false; } }
function daIsIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function daInstallBtnHtml(id, big){
  if(daIsInstalled()) return '';
  return '<button id="' + id + '" class="da-install" onclick="daInstallApp()" style="' + (big ? 'width:100%;padding:12px;margin-top:10px;font-size:15px;' : 'padding:6px 11px;font-size:14px;')
    + 'border:2px solid var(--teal);background:#f0fdfa;color:var(--teal);border-radius:12px;font-family:inherit;font-weight:800;cursor:pointer">' + daInstT().btn + '</button>';
}
async function daInstallApp(){
  if(_daInstallEvt){ var e = _daInstallEvt; _daInstallEvt = null; e.prompt(); try{ var c = await e.userChoice; if(c && c.outcome === 'accepted') toast(daInstT().done); }catch(x){} return; }
  var old = document.getElementById('da-install-help'); if(old) old.remove();
  var ios = daIsIOS(), T = daInstT(), d = document.createElement('div'); d.id = 'da-install-help'; d.dir = T === DA_INST_T.en ? 'ltr' : 'rtl';
  d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center';
  var step = function(n, t){ return '<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #e2e8f0"><span style="flex:0 0 34px;height:34px;border-radius:50%;background:var(--teal);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">' + n + '</span><span style="font-size:15px">' + t + '</span></div>'; };
  d.innerHTML = '<div style="background:#fff;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:18px 18px 26px;box-shadow:0 -10px 30px rgba(0,0,0,.2)">'
    + '<div style="font-weight:800;font-size:17px;margin-bottom:6px">' + T.title + '</div>' + (ios ? T.ios : T.and).map(function(x, i){ return step(i + 1, x); }).join('')
    + '<button onclick="document.getElementById(&quot;da-install-help&quot;).remove()" style="width:100%;margin-top:14px;padding:12px;border:0;border-radius:12px;background:var(--teal);color:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer">' + T.ok + '</button></div>';
  d.addEventListener('click', function(ev){ if(ev.target === d) d.remove(); });
  document.body.appendChild(d);
}
function daInstallPlace(){   // login card + the worker's bar
  if(daIsInstalled()){ document.querySelectorAll('.da-install').forEach(function(b){ b.remove(); }); return; }
  var card = document.getElementById('auth-btn'); if(card && !document.getElementById('inst-login')) card.insertAdjacentHTML('afterend', daInstallBtnHtml('inst-login', true));
  var bar = document.getElementById('da-wbar'), rf = bar && bar.querySelector('.rf'); if(rf && !document.getElementById('inst-bar')) rf.insertAdjacentHTML('beforebegin', daInstallBtnHtml('inst-bar', false));
}
if(!window._daInstWrapped){
  window._daInstWrapped = true;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); _daInstallEvt = e; daInstallPlace(); });
  window.addEventListener('appinstalled', function(){ _daInstallEvt = null; toast(daInstT().inst); document.querySelectorAll('.da-install').forEach(function(b){ b.remove(); }); });
  if('serviceWorker' in navigator && location.protocol !== 'file:') try{ navigator.serviceWorker.register('sw.js').catch(function(){}); }catch(e){}
  var _showPreInst = show;
  show = function(){ var r = _showPreInst.apply(this, arguments); daInstallPlace(); return r; };
  if(typeof daWorkerBar === 'function'){ var _wbPreInst = daWorkerBar; daWorkerBar = function(){ var r = _wbPreInst.apply(this, arguments); daInstallPlace(); return r; }; }
  setTimeout(daInstallPlace, 0);
}
