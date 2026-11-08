/**
 * Optional georeferenced image overlays (GeoTIFF → JPEG via geotiff_processor).
 *
 * index.json layers:
 * {
 *   "id": "ortho-1",
 *   "name": "オルソ",
 *   "image": "data/raster/foo.jpg",
 *   "coordinates": [ [lng,lat], [lng,lat], [lng,lat], [lng,lat] ]  // TL,TR,BR,BL WGS84
 * }
 * or planeCorners: { upperLeft:[X,Y], upperRight:[X,Y], lowerRight:[X,Y], lowerLeft:[X,Y] }
 * in EPSG:6678 metres (converted with plane10ToLngLat).
 */

import { loadDataFile, loadManifest } from "./load.js";
import { plane10ToLngLat } from "./plane.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";

const state = {
  index: null,
  layers: [],
  enabled: new Set(),
  available: false,
};

function cornersFromPlane(pc) {
  if (!pc) return null;
  const order = ["upperLeft", "upperRight", "lowerRight", "lowerLeft"];
  const out = [];
  for (const key of order) {
    const xy = pc[key];
    if (!xy || xy.length < 2) return null;
    const ll = plane10ToLngLat(+xy[0], +xy[1]);
    if (!ll) return null;
    out.push([ll.lng, ll.lat]);
  }
  return out;
}

function normalizeLayer(raw, i) {
  const id = String(raw.id || `raster-${i}`);
  const name = raw.name || id;
  const image = raw.image;
  if (!image) return null;
  let coordinates = raw.coordinates;
  if (!coordinates || coordinates.length !== 4) {
    coordinates = cornersFromPlane(raw.planeCorners);
  }
  if (!coordinates || coordinates.length !== 4) return null;
  return {
    id,
    name,
    image,
    coordinates,
    opacity: raw.opacity != null ? Number(raw.opacity) : 0.85,
    defaultOn: !!raw.defaultOn,
  };
}

async function imageUrl(relPath) {
  const rel = "./" + String(relPath).replace(/^\.\//, "");
  const url = new URL(rel, window.location.href);
  try {
    const manifest = await loadManifest();
    if (manifest && manifest.version) url.searchParams.set("v", manifest.version);
  } catch (_) {}
  return url.href;
}

export async function loadRaster() {
  try {
    state.index = await loadDataFile("rasterIndex");
  } catch (_) {
    state.index = { layers: [] };
  }
  const rawLayers = (state.index && state.index.layers) || [];
  state.layers = [];
  state.enabled = new Set();
  for (let i = 0; i < rawLayers.length; i++) {
    const layer = normalizeLayer(rawLayers[i], i);
    if (!layer) continue;
    state.layers.push(layer);
    if (layer.defaultOn) state.enabled.add(layer.id);
  }
  state.available = state.layers.length > 0;
  return state;
}

export function isRasterAvailable() {
  return state.available;
}

export function rasterLegends() {
  return state.layers.map((l) => ({ id: l.id, name: l.name }));
}

export function enabledRasterIds() {
  return Array.from(state.enabled);
}

function sourceId(id) {
  return `${SOURCE_IDS.rasterPrefix}${id}`;
}

function mapLayerId(id) {
  return `${LAYER_IDS.rasterPrefix}${id}`;
}

export async function addRasterLayers(map) {
  for (const layer of state.layers) {
    const sid = sourceId(layer.id);
    const lid = mapLayerId(layer.id);
    if (!map.getSource(sid)) {
      const url = await imageUrl(layer.image);
      map.addSource(sid, {
        type: "image",
        url,
        coordinates: layer.coordinates,
      });
    }
    if (!map.getLayer(lid)) {
      map.addLayer({
        id: lid,
        type: "raster",
        source: sid,
        layout: {
          visibility: state.enabled.has(layer.id) ? "visible" : "none",
        },
        paint: {
          "raster-opacity": layer.opacity,
          "raster-fade-duration": 0,
        },
      });
    }
  }
  bringOverlaysFront(map);
}

export function setRasterLegend(map, id, on) {
  if (on) state.enabled.add(id);
  else state.enabled.delete(id);
  const lid = mapLayerId(id);
  if (map.getLayer(lid)) {
    map.setLayoutProperty(lid, "visibility", on ? "visible" : "none");
  }
}

