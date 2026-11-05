
const CACHE = "dmap-v6";
const ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return;

  const navigate = e.request.mode === "navigate"
    || url.pathname === "/"
    || url.pathname === "/driver"
    || url.pathname === "/login"
    || url.pathname === "/admin"
    || url.pathname.startsWith("/driver/")
    || url.pathname.startsWith("/login/")
    || url.pathname.startsWith("/admin/");

  // Never cache-first HTML. Old `/` entries were serving the pre-PR3 passenger bundle.
  if (navigate) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
