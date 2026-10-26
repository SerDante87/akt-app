const V = "akt-v21";
const FILES = ["./", "index.html", "app.js", "gen.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png",
  "lib/docx.js", "lib/jszip.min.js", "lib/docx-preview.js", "lib/html2canvas.min.js", "lib/jspdf.umd.min.js", "lib/jsQR.js"];
// cache: "reload" — мимо HTTP-кэша GitHub Pages, иначе в новую версию попадут старые файлы
self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
// только кэш своей версии: файлы меняются все сразу вместе с V, старый index.html не встретится с новым app.js
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.open(V).then((c) => c.match(e.request)).then((hit) => hit || fetch(e.request)));
});
