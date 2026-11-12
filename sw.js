// Registered so phones offer "install as an app" and receive notifications. It caches NOTHING and does not touch any
// request (no fetch handler): the app always loads fresh and updates work as before. On activation it clears old caches
// (except "da-meta", where the app keeps the worker's language for the notification text).
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== 'da-meta'; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});
var DA_PUSH_TEXT = {
  ar:{t:'🔔 Dar Aqua', b:'فيه أمر شغل أو روتين — افتح التطبيق'},
  en:{t:'🔔 Dar Aqua', b:'A work order or routine task — open the app'},
  ur:{t:'🔔 Dar Aqua', b:'نئی کام کی ہدایت یا روزانہ کام — ایپ کھولیں'}};
self.addEventListener('push', function(e){
  e.waitUntil(caches.open('da-meta').then(function(c){ return c.match('/lang'); }).then(function(r){ return r ? r.text() : 'ar'; }).catch(function(){ return 'ar'; })
    .then(function(l){ var T = DA_PUSH_TEXT[l] || DA_PUSH_TEXT.ar;
      return self.registration.showNotification(T.t, {body:T.b, icon:'icon-192.png', badge:'icon-192.png', tag:'da-orders', renotify:true, vibrate:[200, 100, 200], data:{url:self.registration.scope + '?wo=1'}}); }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close(); var url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
    for(var i = 0; i < list.length; i++){ if(list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]){ list[i].postMessage({da:'open-orders'}); return list[i].focus(); } }
    return self.clients.openWindow(url); }));
});
