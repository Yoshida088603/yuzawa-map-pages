import { loadDataFile } from "./load.js";
import { LABEL_MIN_ZOOM, LASER_TAG_COLORS } from "./config.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";

const state = {
  data: null,
  byId: new Map(),
  visible: true,
};

function ensureColors(fc) {
  const feats = (fc && fc.features) || [];
  for (const f of feats) {
    const p = f.properties || {};
    if (!p.color && p.laser_tag) {
      p.color = LASER_TAG_COLORS[p.laser_tag] || "#e8eef2";
    }
    if (!p.name) {
      const tags = [p.laser_tag, p.shinrin_tag].filter(Boolean).join("/");
      const text = (p.text || "").trim();
      p.name = tags && text ? `[${tags}] ${text}` : tags ? `[${tags}]` : text || "メモ";
    }
    if (p.id == null && f.id != null) p.id = f.id;
    f.properties = p;
  }
  return fc;
}

export async function loadMemos() {
  if (!state.data) {
    state.data = ensureColors(await loadDataFile("memos"));
    state.byId.clear();
    for (const f of state.data.features || []) {
      const id = f.properties && f.properties.id;
      if (id != null) state.byId.set(String(id), f);
    }
  }
  return state;
}

export function addMemoLayers(map) {
  if (!state.data) throw new Error("memos not loaded");
  if (!map.getSource(SOURCE_IDS.memos)) {
    map.addSource(SOURCE_IDS.memos, { type: "geojson", data: state.data });
  }
  if (!map.getLayer(LAYER_IDS.memosHalo)) {
    map.addLayer({
      id: LAYER_IDS.memosHalo,
      type: "circle",
      source: SOURCE_IDS.memos,
      paint: {
        "circle-radius": 12,
        "circle-color": "#ffffff",
        "circle-opacity": 0.9,
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.memosCircle)) {
    map.addLayer({
      id: LAYER_IDS.memosCircle,
      type: "circle",
      source: SOURCE_IDS.memos,
      paint: {
        "circle-radius": 8,
        "circle-color": ["coalesce", ["get", "color"], "#0d9488"],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#0b1216",
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.memosLabel)) {
    map.addLayer({
      id: LAYER_IDS.memosLabel,
      type: "symbol",
      source: SOURCE_IDS.memos,
      minzoom: LABEL_MIN_ZOOM,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ""],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-max-width": 12,
        "text-optional": true,
      },
      paint: {
        "text-color": "#f5f8fa",
        "text-halo-color": "#0b1216",
        "text-halo-width": 1.5,
      },
    });
  }
  setMemosVisible(map, state.visible);
  bringOverlaysFront(map);
}

export function setMemosVisible(map, on) {
  state.visible = !!on;
  const v = state.visible ? "visible" : "none";
  for (const id of [LAYER_IDS.memosHalo, LAYER_IDS.memosCircle, LAYER_IDS.memosLabel]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
  }
}

export function isMemosVisible() {
  return state.visible;
}

export function getMemoById(id) {
  return state.byId.get(String(id)) || null;
}

export function featureAtPoint(map, point) {
  if (!map.getLayer(LAYER_IDS.memosCircle)) return null;
  const hits = map.queryRenderedFeatures(point, {
    layers: [LAYER_IDS.memosCircle, LAYER_IDS.memosHalo],
  });
  if (!hits.length) return null;
  const id = hits[0].properties && hits[0].properties.id;
  return id != null ? getMemoById(id) : null;
}

export function memoCoords(feature) {
  const c = feature && feature.geometry && feature.geometry.coordinates;
  if (!c) return null;
  return { lng: c[0], lat: c[1] };
}

export const MEMO_CIRCLE_LAYER = LAYER_IDS.memosCircle;
