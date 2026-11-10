/* NES Playlog v8 offline app shell. User data remains local in browser. */
const CACHE='nes-playlog-static-v8';
const SHELL=['./','./index.html','./archive.html','./collection.html','./passport.html','./styles.css','./app.js','./favicon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('nes-playlog-')&&name!==CACHE).map(name=>caches.delete(name)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try {const response=await fetch(req);if(response.ok)cache.put(req,response.clone());return response;}
  catch(err){return (await cache.match(req,{ignoreSearch:true}))||(req.mode==='navigate'?await cache.match('./index.html'):Response.error());}
 })());
});