// 핀톡(도면 핀) 앱: 오프라인에서도 열리도록 앱 파일을 저장해 둔다 (도면·핀 기록은 IndexedDB에 따로 저장됨)
const CACHE="pintalk-v139";
const FILES=["./","./index.html","./manifest.webmanifest","./icon-180.png","./icon-192.png","./icon-512.png","./dwg2pdf.js","./sample.pdf","lib/pdfjs.min.js","lib/pdfjs.worker.min.js","lib/pdf-lib.min.js","lib/fontkit.umd.min.js","fonts/KoPubDotum-Medium.ttf","fonts/PretendardVariable.woff2","lib/exceljs.min.js","tpl/crack.xlsx","lib/firebase-app-compat.js","lib/firebase-messaging-compat.js","try/","manifest-try.webmanifest"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(u=>new Request(u,{cache:"reload"})))));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("pintalk-")&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin) return;
  const key=url.origin+url.pathname;
  e.respondWith(fetch(e.request,{cache:"no-cache"}).then(r=>{ if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(key,c));} return r;})
    .catch(()=>caches.match(key).then(r=>r||caches.match(e.request,{ignoreSearch:true})).then(r=>r||caches.match(new URL("./index.html",self.registration.scope).href))));
});

/* 3.95 휴대폰 알림: 서버가 FCM으로 보낸 데이터 메시지를 받아 알림으로 띄운다 */
self.addEventListener("push",e=>{
  let d={}; try{ const j=e.data?e.data.json():{}; d=j.data||j; }catch(x){ d={body:e.data?e.data.text():""}; }
  e.waitUntil((async()=>{
    const cs=await clients.matchAll({type:"window",includeUncontrolled:true}); cs.forEach(c=>c.postMessage({type:"push"}));   // 열려 있는 앱은 알림 목록을 새로 받는다
    await self.registration.showNotification(d.title||"핀톡",{body:d.body||"",icon:"icon-192.png",badge:"icon-192.png",data:{go:d.drawingId||"",pin:d.pinId||""}});
  })());
});
self.addEventListener("notificationclick",e=>{
  e.notification.close(); const d=e.notification.data||{};
  const url=new URL("./?go="+encodeURIComponent(d.go||"")+"&pin="+encodeURIComponent(d.pin||""),self.registration.scope).href;
  e.waitUntil((async()=>{
    const cs=await clients.matchAll({type:"window",includeUncontrolled:true});
    for(const c of cs){ if("focus" in c){ try{ await c.focus(); }catch(x){} c.postMessage({type:"go",go:d.go||"",pin:d.pin||""}); return; } }
    if(clients.openWindow) await clients.openWindow(url);
  })());
});
