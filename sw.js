/* Ритм для iPhone: офлайн. Все файлы приложения кэшируются при установке;
   новая версия (другой VERSION) скачивается в фоне и включается со следующего открытия. */
const VERSION='ritm-ios-2.3-ffbdf9d4df';
const FILES=["./", "dengi.html", "family.js", "fonts/onest-cyrillic-400-normal.woff2", "fonts/onest-cyrillic-500-normal.woff2", "fonts/onest-cyrillic-600-normal.woff2", "fonts/onest-cyrillic-700-normal.woff2", "fonts/onest-latin-400-normal.woff2", "fonts/onest-latin-500-normal.woff2", "fonts/onest-latin-600-normal.woff2", "fonts/onest-latin-700-normal.woff2", "fonts/unbounded-cyrillic-500-normal.woff2", "fonts/unbounded-cyrillic-600-normal.woff2", "fonts/unbounded-cyrillic-700-normal.woff2", "fonts/unbounded-latin-500-normal.woff2", "fonts/unbounded-latin-600-normal.woff2", "fonts/unbounded-latin-700-normal.woff2", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/icon.svg", "index.html", "manifest.webmanifest", "pitanie.html", "ritm-ios.css", "ritm-ios.js", "semya.html", "telo.html", "tseli.html"];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url); if(u.origin!==self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(c=>c.match(r,{ignoreSearch:true}).then(hit=>{
    if(hit) return hit;
    return fetch(r).then(res=>{ if(res&&res.ok&&res.type==='basic') c.put(r,res.clone()); return res; })
      .catch(()=>r.mode==='navigate'?c.match('index.html'):Response.error());
  })));
});
