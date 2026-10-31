/* yuzawa-map-pages Service Worker — L1 offline: shell + memos + laser + shinrin outline */
const SHELL_CACHE = "yuzawa-shell-v3";
const DATA_CACHE = "yuzawa-data-v1";
const PARCEL_CACHE = "yuzawa-parcels-v1";

const SHELL_URLS = [
  "./",
  "./index.html",
  "./app/main.js",
  "./app/config.js",
  "./app/styles.css",
  "./app/basemap.js",
  "./app/map-shell.js",
  "./app/hud.js",
  "./app/load.js",
  "./app/laser.js",
  "./app/shinrin.js",
  "./app/memos.js",
  "./app/sheets.js",
  "./app/gestures.js",
  "./app/actions.js",
  "./app/aist-3ddb.js",
  "./app/attributions.js",
  "./app/layer-order.js",
  "./app/pmtiles-protocol.js",
  "./app/store.js",
  "./app/queue.js",
  "./app/photos.js",
  "./app/sync-export.js",
  "./app/gps.js",
  "./app/plane.js",
  "./app/boundaries.js",
  "./app/offline.js",
  "./app/qr-public.png",
  "./vendor/maplibre-gl/maplibre-gl.js",
  "./vendor/maplibre-gl/maplibre-gl.css",
  "./vendor/pmtiles/pmtiles.js",
  "./data/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_URLS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, DATA_CACHE, PARCEL_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isDataRequest(url) {
  return url.pathname.includes("/data/") && !url.pathname.endsWith(".pmtiles");
}

function isParcelRequest(url) {
  return url.pathname.endsWith(".pmtiles") || url.pathname.includes("shinrin-parcels");
}

function isShellish(url) {
  const p = url.pathname;
  return (
    p.endsWith("/") ||
    p.endsWith(".html") ||
    p.includes("/app/") ||
    p.includes("/vendor/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Let Range requests for PMTiles pass through unless fully cached
  if (req.headers.get("range") && isParcelRequest(url)) {
    event.respondWith(parcelOrNetwork(req, url));
    return;
  }

  if (isParcelRequest(url)) {
    event.respondWith(parcelOrNetwork(req, url));
    return;
  }

  if (isDataRequest(url) || url.pathname.endsWith("manifest.json")) {
    event.respondWith(networkFirstData(req));
    return;
  }

  if (isShellish(url)) {
    event.respondWith(cacheFirstShell(req));
    return;
  }
});

async function cacheFirstShell(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) {
    fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
      })
      .catch(() => {});
    return hit;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (_) {
    if (req.mode === "navigate") {
      const index = await cache.match("./index.html");
      if (index) return index;
    }
    throw new Error("offline");
  }
}

async function networkFirstData(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (_) {
    const hit = await cache.match(req) || (await cache.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    throw new Error("offline data");
  }
}

async function parcelOrNetwork(req, url) {
  const cache = await caches.open(PARCEL_CACHE);
  const bare = url.pathname;
  const hit =
    (await cache.match(req)) ||
    (await cache.match(bare)) ||
    (await cache.match(req, { ignoreSearch: true }));
  if (hit && !req.headers.get("range")) return hit;
  // If full file cached and Range requested, serve from network if possible;
  // otherwise fall through to network (online) or fail offline.
  try {
    return await fetch(req);
  } catch (_) {
    if (hit) return hit;
    throw new Error("offline parcels");
  }
}
