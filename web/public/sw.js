/* Liar Sudoku service worker: makes the game installable and playable offline.
 * Scope-aware (works at / or in a sub-folder). Bump VERSION to force a refresh. */
const VERSION = "v1";
const CACHE = `liar-sudoku-${VERSION}`;
const SCOPE = new URL("./", self.location).pathname;
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map((u) => cache.add(u).catch(() => {})));
    // Precache every asset the page references so the first offline launch works.
    try {
      const html = await (await fetch("./index.html", { cache: "reload" })).text();
      const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg|png|woff2?))"/g)].map((m) => m[1]);
      await Promise.all(refs.map((r) => cache.add(new URL(r, self.location.href).href).catch(() => {})));
      // Warm Google Fonts (CSS and the font files it points to) so type looks right offline.
      for (const m of html.matchAll(/https:\/\/fonts\.googleapis\.com[^"')\s]+/g)) await warmFont(cache, m[0]);
    } catch (_) {}
    self.skipWaiting();
  })());
});

async function warmFont(cache, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    await cache.put(url, res.clone());
    const css = await res.text();
    const files = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
    await Promise.all(files.map((f) => cache.add(f).catch(() => {})));
  } catch (_) {}
}

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("liar-sudoku-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) { event.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), timeout(3500)]);
        if (res.ok) cache.put("./index.html", res.clone());
        return res;
      } catch (_) {
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith(SCOPE + "assets/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});
