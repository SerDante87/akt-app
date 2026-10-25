const V = "akt-v7";
const FILES = ["./", "index.html", "app.js", "gen.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png",
  "lib/docx.js", "lib/jszip.min.js", "lib/docx-preview.js", "lib/html2canvas.min.js", "lib/jspdf.umd.min.js"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
// сначала кэш, при удачной сети кэш обновляется в фоне
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request, { cache: "no-cache" }).then((r) => { if (r.ok) caches.open(V).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => hit);
    return hit || net;
  }));
});
