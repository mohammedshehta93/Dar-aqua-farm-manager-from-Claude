// ══════════════════════════════════════════════════════════
//  OPEN IT IN CHROME (owner, 2026-11-23)
// ══════════════════════════════════════════════════════════
// A worker opened the tool in another Android browser (a "home screen" shortcut there is only a bookmark): no
// notifications ("this browser does not support notifications") and no "Install app" in its menu — the install steps
// sent him in circles. Such a browser is recognised (no service worker / push, or an in-app web view) and the worker is
// given one button: "🌐 Open in Google Chrome" (an Android intent to the same page), with "📋 Copy the link" when the
// browser blocks that. In Chrome he installs the app and turns notifications on as usual.
var DA_CHR_T = {
  ar:{title:'🌐 افتح الأداة من Google Chrome', why:'المتصفح ده مش بيقدر ينزّل التطبيق ولا يبعت إشعارات على الموبايل.', open:'🌐 افتح في Chrome', copy:'📋 انسخ اللينك', copied:'✅ اتنسخ — افتح Chrome والزقه فوق',
    then:'وفي Chrome اضغط <b>📲 نزّل التطبيق</b>، وبعدها فعّل الإشعارات. والاختصار القديم امسحه من الشاشة.', no:'لو Chrome مش موجود نزّله من Google Play.', ok:'تمام'},
  en:{title:'🌐 Open the tool in Google Chrome', why:'This browser cannot install the app or show phone notifications.', open:'🌐 Open in Chrome', copy:'📋 Copy the link', copied:'✅ Copied — open Chrome and paste it at the top',
    then:'In Chrome tap <b>📲 Install the app</b>, then turn notifications on. Remove the old shortcut from your screen.', no:'No Chrome? Get it from Google Play.', ok:'OK'},
  ur:{title:'🌐 ٹول Google Chrome میں کھولیں', why:'یہ براؤزر ایپ انسٹال نہیں کر سکتا اور فون پر اطلاعات نہیں دکھا سکتا۔', open:'🌐 Chrome میں کھولیں', copy:'📋 لنک کاپی کریں', copied:'✅ کاپی ہو گیا — Chrome کھول کر اوپر پیسٹ کریں',
    then:'Chrome میں <b>📲 ایپ انسٹال کریں</b> دبائیں، پھر اطلاعات چالو کریں۔ پرانا شارٹ کٹ اسکرین سے ہٹا دیں۔', no:'Chrome نہیں ہے تو Google Play سے لیں۔', ok:'ٹھیک ہے'}};
function daChrT(){ var l = typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); return DA_CHR_T[l] || DA_CHR_T.ar; }
function daIsAndroid(){ return /android/i.test(navigator.userAgent); }
function daWeakBrowser(){   // Android, and this browser can neither install nor notify (or it is an app's built-in web view)
  if(!daIsAndroid() || (typeof daIsInstalled === 'function' && daIsInstalled())) return false;
  var ua = navigator.userAgent;
  return !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || /; wv\)|FB_IAB|FBAN|Instagram|Line\/|MiuiBrowser|UCBrowser|UCWEB|OPR\/|Opera Mini|HeyTapBrowser|PHX\//i.test(ua);
}
function daChromeUrl(){ var l = location; return 'intent://' + l.host + l.pathname + l.search + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(l.href) + ';end'; }
function daChromeCopy(){ var u = location.origin + location.pathname, T = daChrT();
  var done = function(){ toast(T.copied); }; try{ navigator.clipboard.writeText(u).then(done, function(){ prompt(T.copy, u); }); }catch(e){ prompt(T.copy, u); } }
function daChromeButtons(){ var T = daChrT(), b = 'display:block;width:100%;padding:13px;margin-top:8px;border-radius:12px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;text-align:center;text-decoration:none;';
  return '<a id="da-chrome-open" href="' + daEsc(daChromeUrl()) + '" style="' + b + 'background:var(--teal);color:#fff;border:0">' + T.open + '</a>'
    + '<button id="da-chrome-copy" onclick="daChromeCopy()" style="' + b + 'background:#fff;color:var(--teal);border:2px solid var(--teal)">' + T.copy + '</button>'; }
function daChromeSheet(){
  var old = document.getElementById('da-install-help'); if(old) old.remove();
  var T = daChrT(), d = document.createElement('div'); d.id = 'da-install-help'; d.dir = T === DA_CHR_T.en ? 'ltr' : 'rtl';
  d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center';
  d.innerHTML = '<div style="background:#fff;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:18px 18px 26px;font-size:15px"><div style="font-weight:900;font-size:18px;margin-bottom:8px">' + T.title + '</div>'
    + '<div style="color:var(--muted);margin-bottom:6px">' + T.why + '</div>' + daChromeButtons()
    + '<div style="margin-top:12px;font-size:14px">' + T.then + '</div><div style="margin-top:6px;font-size:12px;color:var(--muted)">' + T.no + '</div>'
    + '<button onclick="document.getElementById(&quot;da-install-help&quot;).remove()" style="width:100%;margin-top:12px;padding:10px;border:0;background:#f1f5f9;border-radius:10px;font:inherit;cursor:pointer">' + T.ok + '</button></div>';
  d.onclick = function(e){ if(e.target === d) d.remove(); }; document.body.appendChild(d);
}
if(!window._daChrWrapped){
  window._daChrWrapped = true;
  if(typeof daInstallApp === 'function'){ var _instPreChr = daInstallApp; daInstallApp = function(){ if(!_daInstallEvt && daWeakBrowser()) return daChromeSheet(); return _instPreChr.apply(this, arguments); }; }
  if(typeof daPushCard === 'function'){ var _pcPreChr = daPushCard; daPushCard = async function(){ var r = await _pcPreChr.apply(this, arguments);
    try{ var card = document.getElementById('push-card'); if(card && daWeakBrowser() && !document.getElementById('da-chrome-open')){ var T = daChrT();
      card.insertAdjacentHTML('beforeend', '<div style="font-size:13px;margin-top:8px">' + T.why + '</div>' + daChromeButtons()); } }catch(e){}
    return r; }; }
}
