const CACHE='laes-playlog-v10-repair';
const APP=['./','./index.html','./collection.html','./passport.html','./archive.html','./global.css','./hub.js','./shared/nes-data.js','./shared/cartridges.js','./shared/cartridges.css','./nes/index.html','./nes/archive.html','./nes/styles.css','./nes/app.js','./favicon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('laes-playlog-')||k.startsWith('nes-playlog-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(req);if(response.ok)cache.put(req,response.clone());return response;}catch(e){return(await cache.match(req,{ignoreSearch:true}))||(req.mode==='navigate'?await cache.match('./index.html'):Response.error());}})());
});
