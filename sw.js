// Registered so phones offer "install as an app". It caches NOTHING and does not touch any request (no fetch handler):
// the app always loads fresh from the network and updates work as before. On activation it clears old caches.
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});
