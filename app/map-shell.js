/**
 * MapLibre shell — create, fit, center/zoom, setView (GPS hook later).
 */

import { COMPACT_ATTRIBUTION } from "./attributions.js";

let map = null;

export function getMap() {
  return map;
}

export function createMap(containerId, style) {
  map = new maplibregl.Map({
    container: containerId,
    style,
    center: [140.55, 39.16],
    zoom: 10,
    maxZoom: 18,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.addControl(
    new maplibregl.AttributionControl({
      compact: true,
      customAttribution: COMPACT_ATTRIBUTION,
    }),
    "bottom-right"
  );
  return map;
}

export function getCenter() {
  if (!map) return null;
  const c = map.getCenter();
  return { lng: c.lng, lat: c.lat };
}

export function getZoom() {
  return map ? map.getZoom() : null;
}

/** Later GPS: call setView([lng, lat], zoom) and add a marker source above memos. */
export function setView(center, zoom, opts) {
  if (!map) return;
  const o = opts || {};
  map.easeTo({
    center,
    zoom: zoom != null ? zoom : map.getZoom(),
    duration: o.duration != null ? o.duration : 600,
  });
}

export function fitBounds(bounds, padding) {
  if (!map) return;
  map.fitBounds(bounds, {
    padding: padding || 40,
    maxZoom: 14,
    duration: 0,
  });
}

export function boundsFromFeatureCollection(fc, filterFn) {
  const bounds = new maplibregl.LngLatBounds();
  function walk(c) {
    if (typeof c[0] === "number") {
      bounds.extend(c);
      return;
    }
    c.forEach(walk);
  }
  const feats = (fc && fc.features) || [];
  for (const f of feats) {
    if (filterFn && !filterFn(f)) continue;
    if (f.geometry && f.geometry.coordinates) walk(f.geometry.coordinates);
  }
  return bounds.isEmpty() ? null : bounds;
}
