// Network-first for Opu's own files (edits show up immediately); cached copy only when offline.
// Never touches cross-origin requests, so API calls and keys are unaffected.
const C = "opu-v2";
const SHELL = ["./", "index.html", "style.css", "app.js", "conversation.js", "personality.js", "emotion.js", "memory.js", "provider.js", "config.js", "tools.js", "icon.js", "manifest.json", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { const copy = res.clone(); caches.open(C).then(c => c.put(r, copy)); return res; }).catch(() => caches.match(r)));
});
