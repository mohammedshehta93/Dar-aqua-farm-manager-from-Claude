// Clear all caches and unregister
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});
// No caching - always fetch from network
self.addEventListener('fetch', function(e){
  e.respondWith(fetch(e.request));
});
