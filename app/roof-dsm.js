/** LP21A roof DSM preview (MapLibre image) + RMSE survey/pick points. */

import { getVersionedUrl, loadJson } from "./load.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";

const META_PATH = "./data/roof/overlay-meta.json";

const state = {
  meta: null,
  points: null,
  visible: true,
  pointsVisible: true,
};

export function isRoofDsmVisible() {
  return state.visible;
}

export function isRoofPointsVisible() {
  return state.pointsVisible;
}

export async function loadRoofDsm() {
  if (!state.meta) {
    state.meta = await loadJson(META_PATH);
  }
  if (!state.points) {
    const pointsPath = "./" + String(state.meta.points || "").replace(/^\.\//, "");
    state.points = await loadJson(pointsPath);
  }
  return state;
}

export function roofDsmBounds() {
  const coords = state.meta?.coordinates;
  if (!Array.isArray(coords) || coords.length < 4) return null;
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export function roofDsmCenter() {
  const b = roofDsmBounds();
  if (!b) return null;
  return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
}

/**
 * Fly to the DSM sample at high zoom (default 21).
 * @param {import("maplibre-gl").Map} map
 * @param {{ zoom?: number, duration?: number, padding?: object }} [opts]
 */
export function fitRoofDsm(map, opts = {}) {
  if (!map || !state.meta) return;
  const center = roofDsmCenter();
  if (!center) return;
  const zoom = opts.zoom != null ? opts.zoom : Number(state.meta.fitZoom) || 21;
  map.flyTo({
    center,
    zoom,
    duration: opts.duration != null ? opts.duration : 900,
    padding: opts.padding,
  });
}

function previewUrlFromMeta(meta) {
  const path = String(meta?.preview || "").replace(/^\.\//, "");
  if (!path) {
    throw new Error("overlay-meta.json に preview がありません");
  }
  const rel = "./" + path;
  const url = new URL(rel, window.location.href);
  url.searchParams.set("v", String(meta.cacheVersion || meta.gridResM || "0"));
  return url.href;
}

export async function addRoofDsmLayers(map) {
  await loadRoofDsm();
  const meta = state.meta;
  // Prefer overlay-meta.preview so PNG 差し替えが #6 の manifest/sw と衝突しない
  const previewUrl = meta?.preview
    ? previewUrlFromMeta(meta)
    : await getVersionedUrl("roofDsmPreview");

  if (!map.getSource(SOURCE_IDS.roofDsmImage)) {
    map.addSource(SOURCE_IDS.roofDsmImage, {
      type: "image",
      url: previewUrl,
      coordinates: meta.coordinates,
    });
  }
  if (!map.getLayer(LAYER_IDS.roofDsmImage)) {
    map.addLayer({
      id: LAYER_IDS.roofDsmImage,
      type: "raster",
      source: SOURCE_IDS.roofDsmImage,
      paint: {
        // alpha チャンネルで透過するため全体不透明度は 1
        "raster-opacity": 1,
        "raster-resampling": "nearest",
      },
      layout: {
        visibility: state.visible ? "visible" : "none",
      },
    });
  }

  if (!map.getSource(SOURCE_IDS.roofRmsePoints)) {
    map.addSource(SOURCE_IDS.roofRmsePoints, {
      type: "geojson",
      data: state.points,
    });
  }
  if (!map.getLayer(LAYER_IDS.roofRmseHalo)) {
    map.addLayer({
      id: LAYER_IDS.roofRmseHalo,
      type: "circle",
      source: SOURCE_IDS.roofRmsePoints,
      paint: {
        "circle-radius": 9,
        "circle-color": "#0b1216",
        "circle-opacity": 0.45,
      },
      layout: {
        visibility: state.pointsVisible ? "visible" : "none",
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.roofRmseCircle)) {
    map.addLayer({
      id: LAYER_IDS.roofRmseCircle,
      type: "circle",
      source: SOURCE_IDS.roofRmsePoints,
      paint: {
        "circle-radius": 6,
        "circle-color": [
          "match",
          ["get", "role"],
          "laz_picked",
          "#38bdf8",
          "survey_query",
          "#fbbf24",
          "#e8eef2",
        ],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#0b1216",
      },
      layout: {
        visibility: state.pointsVisible ? "visible" : "none",
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.roofRmseLabel)) {
    map.addLayer({
      id: LAYER_IDS.roofRmseLabel,
      type: "symbol",
      source: SOURCE_IDS.roofRmsePoints,
      filter: ["==", ["get", "role"], "survey_query"],
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-font": ["Noto Sans Regular"],
        visibility: state.pointsVisible ? "visible" : "none",
      },
      paint: {
        "text-color": "#e8eef2",
        "text-halo-color": "#0b1216",
        "text-halo-width": 1.5,
      },
    });
  }

  bringOverlaysFront(map);
}

function setLayerVisibility(map, id, on) {
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }
}

export function setRoofDsmVisible(map, on) {
  state.visible = !!on;
  setLayerVisibility(map, LAYER_IDS.roofDsmImage, state.visible);
}

export function setRoofPointsVisible(map, on) {
  state.pointsVisible = !!on;
  setLayerVisibility(map, LAYER_IDS.roofRmseHalo, state.pointsVisible);
  setLayerVisibility(map, LAYER_IDS.roofRmseCircle, state.pointsVisible);
  setLayerVisibility(map, LAYER_IDS.roofRmseLabel, state.pointsVisible);
}
