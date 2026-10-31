import { PLANE_CRS } from "./config.js";

/**
 * External link builders. Each kind returns an ordered URL list;
 * minimum implementation opens the first https URL only.
 * comgooglemaps:// and maps:// are kept as commented next candidates.
 */
export function mapsOpenUrls(lat, lng) {
  const q = encodeURIComponent(`${lat},${lng}`);
  return [
    `https://www.google.com/maps/search/?api=1&query=${q}`,
    // `comgooglemaps://?q=${lat},${lng}`,
    // `maps://?q=${lat},${lng}`,
  ];
}

export function streetViewUrls(lat, lng) {
  const vp = encodeURIComponent(`${lat},${lng}`);
  return [
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${vp}`,
    // `comgooglemaps://?center=${lat},${lng}&mapmode=streetview`,
  ];
}

export function routeUrls(lat, lng) {
  const dest = encodeURIComponent(`${lat},${lng}`);
  return [
    `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`,
    // `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
  ];
}

export function openFirstHttps(urls) {
  const url = (urls || []).find((u) => typeof u === "string" && u.startsWith("https://"));
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export function openMaps(lat, lng) {
  return openFirstHttps(mapsOpenUrls(lat, lng));
}

export function openStreetView(lat, lng) {
  return openFirstHttps(streetViewUrls(lat, lng));
}

export function openRoute(lat, lng) {
  return openFirstHttps(routeUrls(lat, lng));
}

export function formatLatLng(lat, lng) {
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

export function formatLngLat(lat, lng) {
  return `${Number(lng).toFixed(6)}, ${Number(lat).toFixed(6)}`;
}

/** Stub for plane rectangular coords (EPSG:6678). Returns null until wired. */
export function planeXy(_lng, _lat) {
  return null;
}

export function planeCrs() {
  return PLANE_CRS;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch (_) {}
  return { ok: false, text };
}
