const PREFIX='maxim-math:'+self.registration.scope+':';
const CACHE=PREFIX+'v0.9.0';
const ASSETS=['./','./app.mjs','./config.mjs','./instructor.mjs','./style.css','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'].map(p=>new URL(p,self.registration.scope).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k))))));
// Only public shell files; never authentication, tasks, hints, results or offline submissions.
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!ASSETS.includes(e.request.url))return;
 e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match(e.request))));});
