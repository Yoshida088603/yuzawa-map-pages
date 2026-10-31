/**
 * Service Worker registration + optional parcel prefetch helpers.
 */

import { getVersionedUrl, loadManifest } from "./load.js";

const SW_URL = "./sw.js";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "unsupported" };
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: "./" });
    return { ok: true, reg };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

/** Download full parcels PMTiles into Cache Storage for offline (Wi‑Fi recommended). */
export async function prefetchParcelsForOffline() {
  if (!("caches" in window)) return { ok: false, reason: "Cache API 非対応" };
  try {
    const url = await getVersionedUrl("shinrinParcels");
    const cache = await caches.open("yuzawa-parcels-v1");
    const res = await fetch(url);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    await cache.put(url, res.clone());
    // Also cache without query for Range-less fallbacks
    const bare = url.split("?")[0];
    await cache.put(bare, res);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

export async function listL1CacheUrls() {
  const manifest = await loadManifest();
  const files = manifest.files || {};
  const v = manifest.version || "0";
  const keys = ["memos", "laser", "laserIndex", "shinrin", "shinrinIndex"];
  const urls = ["./", "./index.html", "./data/manifest.json"];
  for (const k of keys) {
    if (files[k]) urls.push(`./${files[k]}?v=${encodeURIComponent(v)}`);
  }
  return urls;
}
