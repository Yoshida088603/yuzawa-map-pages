/** LP21 roof RGB overlays (MapLibre image) + RMSE / survey points. */

import { getVersionedUrl, loadJson } from "./load.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";

const META_PATH = "./data/roof/overlay-meta.json";
const EXTRA_LAYER_PREFIX = "yuzawa-roof-dsm-image-";
const EXTRA_SOURCE_PREFIX = "yuzawa-roof-dsm-image-src-";

const state = {
  meta: null,
  points: null,
  visible: true,
  pointsVisible: true,
  tileLayerIds: [],
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

function tilesFromMeta(meta) {
  if (Array.isArray(meta?.tiles) && meta.tiles.length > 0) {
    return meta.tiles;
  }
  if (meta?.preview && Array.isArray(meta?.coordinates)) {
    return [
      {
        id: meta.id || "LP21A",
        preview: meta.preview,
        coordinates: meta.coordinates,
      },
    ];
  }
  return [];
}

function allTileCoordinates(meta) {
  const tiles = tilesFromMeta(meta);
  const out = [];
  for (const t of tiles) {
    if (Array.isArray(t.coordinates)) out.push(...t.coordinates);
  }
  if (!out.length && Array.isArray(meta?.coordinates)) {
    out.push(...meta.coordinates);
  }
  return out;
}

export function roofDsmBounds() {
  const coords = allTileCoordinates(state.meta);
  if (!coords.length) return null;
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
 * Fly to the roof RGB coverage at high zoom (default from meta.fitZoom).
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

function previewUrlFromTile(tile, meta) {
  const path = String(tile?.preview || "").replace(/^\.\//, "");
  if (!path) {
    throw new Error("overlay-meta tile に preview がありません");
  }
  const rel = "./" + path;
  const url = new URL(rel, window.location.href);
  url.searchParams.set("v", String(meta.cacheVersion || meta.gridResM || "0"));
  return url.href;
}

function layerIdForTile(tile, index) {
  if (index === 0) return LAYER_IDS.roofDsmImage;
  return EXTRA_LAYER_PREFIX + String(tile.id || index);
}

function sourceIdForTile(tile, index) {
  if (index === 0) return SOURCE_IDS.roofDsmImage;
  return EXTRA_SOURCE_PREFIX + String(tile.id || index);
}

export async function addRoofDsmLayers(map) {
  await loadRoofDsm();
  const meta = state.meta;
  const tiles = tilesFromMeta(meta);
  if (!tiles.length) {
    throw new Error("overlay-meta.json に tiles / preview がありません");
  }

  state.tileLayerIds = [];

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (!Array.isArray(tile.coordinates) || tile.coordinates.length < 4) {
      throw new Error(`tile ${tile.id || i} の coordinates が不正です`);
    }
    const sourceId = sourceIdForTile(tile, i);
    const layerId = layerIdForTile(tile, i);
    const previewUrl = tile.preview
      ? previewUrlFromTile(tile, meta)
      : await getVersionedUrl("roofDsmPreview");

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "image",
        url: previewUrl,
        coordinates: tile.coordinates,
      });
    }
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
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
    state.tileLayerIds.push(layerId);
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
  // Extra tile rasters are not in layer-order.js (#6 衝突回避)。境界線の直前へ寄せる。
  const before = LAYER_IDS.boundariesLine;
  for (const id of state.tileLayerIds) {
    if (id === LAYER_IDS.roofDsmImage) continue;
    if (map.getLayer(id) && map.getLayer(before)) {
      try {
        map.moveLayer(id, before);
      } catch (_) {}
    }
  }
}

function setLayerVisibility(map, id, on) {
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }
}

export function setRoofDsmVisible(map, on) {
  state.visible = !!on;
  const ids = state.tileLayerIds.length
    ? state.tileLayerIds
    : [LAYER_IDS.roofDsmImage];
  for (const id of ids) {
    setLayerVisibility(map, id, state.visible);
  }
}

export function setRoofPointsVisible(map, on) {
  state.pointsVisible = !!on;
  setLayerVisibility(map, LAYER_IDS.roofRmseHalo, state.pointsVisible);
  setLayerVisibility(map, LAYER_IDS.roofRmseCircle, state.pointsVisible);
  setLayerVisibility(map, LAYER_IDS.roofRmseLabel, state.pointsVisible);
}
