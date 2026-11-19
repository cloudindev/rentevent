/* Rentevent worker app service worker: offline shell for /m and agenda pages. */
const VERSION = "rv-m-v1";
const SHELL = ["/m", "/m/fichar", "/m/escanear", "/m/perfil", "/manifest.webmanifest", "/brand/rentevent-mark.png", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { credentials: "include" })).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets: cache first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Worker app pages and their RSC payloads: network first, cached copy offline
  if (url.pathname === "/m" || url.pathname.startsWith("/m/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !url.pathname.startsWith("/m/foto")) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (hit) =>
              hit ||
              caches.match("/m").then(
                (shell) =>
                  shell ||
                  new Response("<!doctype html><meta charset=utf-8><title>Sin conexión</title><body style='font-family:sans-serif;padding:24px'><h1>Sin conexión</h1><p>Abre la app con conexión al menos una vez para usarla sin cobertura.</p>", {
                    headers: { "Content-Type": "text/html; charset=utf-8" },
                  }),
              ),
          ),
        ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Rentevent", body: "", url: "/m" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* plain text */
  }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: data.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/m";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) if ("focus" in c) return c.navigate(url).then((w) => w && w.focus());
      return self.clients.openWindow(url);
    }),
  );
});
