// ══════════════════════════════════════════════════════════
//  PHONE NOTIFICATIONS (owner, 2026-11-12) — even with the app closed
// ══════════════════════════════════════════════════════════
// A worker turns them on once ("🔔 turn on notifications": the phone asks permission, the subscription is kept in
// Supabase push_subs with the worker's sites and language). When a supervisor gives a work order the app tells the
// farm-push Worker, which notifies that site's workers; every 10 minutes the Worker also reminds them of routine items
// whose time came. Tapping the notification opens the orders page. iPhone: only once the app is on the home screen.
var DA_PUSH_URL = 'https://farm-push.mohammedshehta86.workers.dev';
var DA_VAPID_PUBLIC = 'BE6TQwMw_89usqeEipmG_KpsDrcXfl0Ruvb66wQfXweRyGoz9jFQpY1RgBDZuouXjL0HjWDnNKhXPvfMnMPeuGw';   // public by design (the private half lives only in the Worker)
var DA_PUSH_T = {
  ar:{title:'🔔 الإشعارات على الموبايل', on:'🔔 فعّل الإشعارات', ok:'✅ الإشعارات شغالة على الموبايل ده', test:'جرّب إشعار', denied:'الموبايل رافض الإشعارات — افتح إعدادات المتصفح ← الإشعارات ← اسمح للموقع', ios:'على الآيفون: نزّل التطبيق على الشاشة الرئيسية الأول (📲)، وافتحه منها، وبعدين فعّل الإشعارات', unsup:'المتصفح ده مش بيدعم الإشعارات', why:'بيوصلك إشعار بأوامر الشغل والروتين حتى لو التطبيق مقفول', sent:'📨 اتبعت — هيوصل خلال ثواني', fail:'⚠️ مقدرتش أفعّلها — جرّب تاني', nosql:'⚠️ جدول الإشعارات مش موجود لسه — المدير لازم يشغّل ملف push_notifications.sql في Supabase', rls:'⚠️ Supabase رافض الحفظ — اتأكد إن ملف push_notifications.sql اتشغّل كله', nosub:'⚠️ الموبايل مش قابل الاشتراك — اتأكد إن Chrome محدّث ومفتوح من التطبيق المتثبت'},
  en:{title:'🔔 Phone notifications', on:'🔔 Turn on notifications', ok:'✅ Notifications are on for this phone', test:'Test', denied:'This phone blocks notifications — browser settings → Notifications → allow this site', ios:'On iPhone: add the app to the home screen first (📲), open it from there, then turn on notifications', unsup:'This browser does not support notifications', why:'Get work orders and routine reminders even when the app is closed', sent:'📨 Sent — it arrives in a few seconds', fail:'⚠️ Could not turn them on — try again', nosql:'⚠️ The notifications table is not set up yet — ask the manager', rls:'⚠️ The server refused — ask the manager', nosub:'⚠️ This phone refused the subscription — update Chrome and open the installed app'},
  ur:{title:'🔔 فون پر اطلاعات', on:'🔔 اطلاعات چالو کریں', ok:'✅ اس فون پر اطلاعات چالو ہیں', test:'آزمائیں', denied:'فون نے اطلاعات بند کی ہیں — براؤزر کی سیٹنگ ← اطلاعات ← اجازت دیں', ios:'آئی فون پر: پہلے ایپ ہوم اسکرین پر لگائیں (📲)، وہاں سے کھولیں، پھر اطلاعات چالو کریں', unsup:'یہ براؤزر اطلاعات نہیں دیتا', why:'ایپ بند ہو تب بھی کام کی ہدایات اور روزانہ کام کی اطلاع ملے گی', sent:'📨 بھیج دیا — چند سیکنڈ میں آئے گی', fail:'⚠️ چالو نہیں ہو سکیں — دوبارہ کوشش کریں', nosql:'⚠️ اطلاعات کا نظام ابھی تیار نہیں — مینیجر سے کہیں', rls:'⚠️ سرور نے انکار کیا — مینیجر سے کہیں', nosub:'⚠️ فون نے سبسکرپشن قبول نہیں کی — کروم اپڈیٹ کریں اور انسٹال ایپ سے کھولیں'}};
function daPushT(){ var l = typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); return DA_PUSH_T[l] || DA_PUSH_T.ar; }
function daPushSupported(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function daPushIOSNeedsInstall(){ return (typeof daIsIOS === 'function' && daIsIOS()) && !(typeof daIsInstalled === 'function' && daIsInstalled()); }
function daPushKey(){ var s = DA_VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/'); s += '==='.slice((s.length + 3) % 4); var r = atob(s), a = new Uint8Array(r.length); for(var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
function daPushUid(){ try{ return JSON.parse(atob(SB_TOKEN.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; }catch(e){ return currentUser && (currentUser.id || currentUser.uid) || ''; } }
async function daPushSaveLang(){ try{ var c = await caches.open('da-meta'); await c.put('/lang', new Response(typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'))); }catch(e){} }
async function daPushState(){
  if(!daPushSupported()) return daPushIOSNeedsInstall() ? 'ios' : 'unsup';
  if(Notification.permission === 'denied') return 'denied';
  try{ var reg = await navigator.serviceWorker.getRegistration(); var sub = reg && await reg.pushManager.getSubscription(); return sub && Notification.permission === 'granted' ? 'on' : 'off'; }catch(e){ return 'off'; }
}
async function daPushEnable(){   // each step says what failed, so a setup problem is named, not guessed
  var T = daPushT(), step = 'permission';
  try{
    var p = await Notification.requestPermission(); if(p !== 'granted'){ toast(T.denied); daPushCard(); return false; }
    step = 'service'; var reg = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('sw.js'); reg = await navigator.serviceWorker.ready;
    step = 'subscribe'; var sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:daPushKey()});
    step = 'save'; var h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint)))).map(function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
    var r = await sbFetch('push_subs?on_conflict=id', {method:'POST', headers:{Prefer:'resolution=merge-duplicates'}, body:JSON.stringify({id:h, farm_id:SB_FARM_ID, user_id:daPushUid(), role:currentUserRole,
      sites:(typeof daUserFarms === 'function' ? daUserFarms() : null), lang:(typeof daLangNow === 'function' ? daLangNow() : 'ar'), endpoint:sub.endpoint, updated_at:new Date().toISOString()})});
    if(r && r.ok === false){ var tx = ''; try{ tx = await r.text(); }catch(x){} throw new Error('HTTP ' + r.status + ' ' + tx.slice(0, 160)); }
    await daPushSaveLang(); toast(T.ok); daPushCard(); return true;
  }catch(e){
    var m = String((e && e.message) || e), why = step === 'save' && /push_subs|relation|42P01|404|PGRST2/i.test(m) ? T.nosql : step === 'save' && /401|403|42501|row-level/i.test(m) ? T.rls : step === 'subscribe' ? T.nosub : '';
    toast((why || T.fail) + ' [' + step + ']'); window._daPushErr = step + ': ' + m; try{ daReportError && daReportError('push-enable ' + step, e); }catch(x){} return false; }
}
async function daPushCall(path, body){   // {ok, status, data, err} — so a test can say what went wrong
  try{ if(typeof sbRefreshToken === 'function' && SB_TOKEN) await sbRefreshToken(false);
    var r = await fetch(DA_PUSH_URL + path, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer ' + (SB_TOKEN || '')}, body:JSON.stringify(body || {})});
    var d = null; try{ d = await r.json(); }catch(x){} return {ok:r.ok, status:r.status, data:d}; }
  catch(e){ return {ok:false, status:0, err:String((e && e.message) || e)}; }
}
function daPushNotify(farm){ daPushCall('/notify', {farm:farm}); }
async function daPushTest(){
  var T = daPushT(), r = await daPushCall('/test', {}), d = r.data || {}, msg;
  if(r.ok && d.sent) msg = T.sent;
  else if(r.status === 0) msg = '⚠️ الخدمة مش بترد — اتأكد إن عنوان الـ Worker هو ' + DA_PUSH_URL.replace('https://', '') + ' وإنه اتعمله Deploy';
  else if(r.status === 401) msg = '⚠️ الخدمة مش عارفة الحساب — اخرج وادخل تاني وجرّب';
  else if(r.status === 403 && /profile/.test(d.error || '')) msg = '⚠️ الخدمة مش قادرة تقرا Supabase — SUPABASE_SERVICE_KEY غلط (لازم service_role)';
  else if(r.status >= 500) msg = '⚠️ الخدمة وقفت: ' + String(d.error || r.status).slice(0, 120) + ' — غالباً سر VAPID_PRIVATE_JWK اتلزق ناقص';
  else if(r.ok && !d.total) msg = '⚠️ الخدمة مش لاقية اشتراك الموبايل ده — غالباً SUPABASE_SERVICE_KEY غلط (لازم service_role)';
  else if(r.ok && !d.sent) msg = '⚠️ خدمة الإشعارات رفضت (' + (d.codes || []).join(',') + ') — غالباً VAPID_PUBLIC مش نفس اللي في الملف';
  else msg = '⚠️ ' + (d.error || ('HTTP ' + r.status));
  toast(msg); window._daPushTest = r;
}
async function daPushCard(){   // the card on the worker's orders page and on "my account"
  var host = document.querySelector('#content .ph'); if(!host || !currentUser) return; var T = daPushT(), st = await daPushState(), old = document.getElementById('push-card'); if(old) old.remove();
  if(currentView !== 'wo-mine' && currentView !== 'account') return; if(st === 'on' && currentView === 'wo-mine') return;
  var inner = st === 'on' ? '<span style="font-weight:800;color:var(--green)">' + T.ok + '</span> <button id="push-test" onclick="daPushTest()" style="padding:6px 12px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">' + T.test + '</button>'
    : st === 'off' ? '<button id="push-on" class="savebtn" style="width:auto;padding:11px 20px;font-size:15px" onclick="daPushEnable()">' + T.on + '</button><div style="font-size:12px;color:var(--muted);margin-top:4px">' + T.why + '</div>'
    : '<div style="font-size:13px">' + (st === 'ios' ? T.ios : st === 'denied' ? T.denied : T.unsup) + '</div>';
  host.insertAdjacentHTML('afterend', '<div class="card" id="push-card" style="margin-bottom:12px;border:2px solid var(--teal)"><div class="card-title">' + T.title + '</div>' + inner + '</div>');
}
if(!window._daPushWrapped){
  window._daPushWrapped = true;
  var _showPrePush = show;
  show = function(v){ var r = _showPrePush.apply(this, arguments); if(currentView === 'wo-mine' || currentView === 'account') setTimeout(daPushCard, 0); return r; };
  if(typeof daWoSave === 'function'){ var _woSavePrePush = daWoSave; daWoSave = function(){ var f = (window._wo || {}).farm, n0 = daWoAll().length; var r = _woSavePrePush.apply(this, arguments); if(daWoAll().length > n0 && f) daPushNotify(f); return r; }; }
  if(typeof daLangPick === 'function'){ var _lpPrePush = daLangPick; daLangPick = function(){ var r = _lpPrePush.apply(this, arguments); daPushSaveLang(); return r; }; }
  try{ navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', function(e){ if(e.data && e.data.da === 'open-orders' && currentUser) show('wo-mine'); }); }catch(e){}
  if(/[?&]wo=1/.test(location.search)){ var _woOpen = setInterval(function(){ if(currentUser && window._cloudSyncDone){ clearInterval(_woOpen); try{ history.replaceState(null, '', location.pathname + location.hash); }catch(e){} show('wo-mine'); } }, 500); setTimeout(function(){ clearInterval(_woOpen); }, 60000); }
}
