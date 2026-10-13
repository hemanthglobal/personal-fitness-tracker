/*
 * Service worker:
 *  - Offline support: app files are cached on first load and served stale-while-revalidate,
 *    so the app opens offline and picks up new deploys next visit. Supabase requests (other
 *    origins) are never cached here; data offline comes from the app's own local cache.
 *  - Reminders: shows Web Push notifications sent by the send-reminders Edge Function, and
 *    opens the right screen when one is tapped.
 */
const CACHE = "ft-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-192.png"];
const DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (DEV) return; // never cache the dev server's modules
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    // Network first for the page so deploys show up; fall back to the cached shell offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); }
          return res;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

/* ---------------------------- Push notifications ---------------------------- */

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : "" }; }
  const title = data.title || "60 Days Tracker";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: data.tag || "reminder",
    renotify: true,
    data: { url: data.url || "#/today" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || "#/today";
  const target = new URL(self.registration.scope);
  target.hash = hash.replace(/^#/, "");
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        return w.navigate(target.href).catch(() => {});
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
