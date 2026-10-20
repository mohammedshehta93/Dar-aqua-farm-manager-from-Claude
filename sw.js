const CACHE = 'daraqua-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  // Network first for API calls, cache first for assets
  if(e.request.url.includes('/api/') || e.request.url.includes('supabase') || e.request.url.includes('anthropic')){
    e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request);}));
  } else {
    e.respondWith(
      caches.match(e.request).then(function(cached){
        return cached || fetch(e.request).then(function(resp){
          var clone = resp.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
          return resp;
        });
      })
    );
  }
});
