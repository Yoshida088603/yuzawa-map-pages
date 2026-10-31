import { loadDataFile } from "./load.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";
import { INITIAL_LASER_LEGEND_ID, LASER_LABEL_MAX_ZOOM } from "./config.js";
import { boundsFromFeatureCollection, fitBounds } from "./map-shell.js";

const state = {
  data: null,
  labelData: null,
  index: null,
  enabled: new Set(),
};

export async function loadLaser() {
  if (!state.data) {
    state.index = await loadDataFile("laserIndex");
    state.data = await loadDataFile("laser");
    state.labelData = buildLaserLabelPoints(state.data);
    for (const lg of state.index.legends || []) {
      if (lg.default_on) state.enabled.add(lg.id);
    }
  }
  return state;
}

/**
 * MapLibre places one symbol per polygon part (geojson-vt flattens
 * MultiPolygon). Build one Point per Feature so year labels stay singular.
 */
function buildLaserLabelPoints(fc) {
  const features = [];
  for (const f of fc.features || []) {
    const coords = representativePoint(f.geometry);
    if (!coords) continue;
    const p = f.properties || {};
    features.push({
      type: "Feature",
      properties: {
        legend_id: p.legend_id,
        year: p.year,
        color: p.color,
      },
      geometry: { type: "Point", coordinates: coords },
    });
  }
  return { type: "FeatureCollection", features };
}

function representativePoint(geom) {
  if (!geom || !geom.type || !geom.coordinates) return null;
  if (geom.type === "Polygon") {
    return polygonLabelPoint(geom.coordinates);
  }
  if (geom.type === "MultiPolygon") {
    let best = null;
    let bestArea = -1;
    for (const poly of geom.coordinates) {
      const pt = polygonLabelPoint(poly);
      const area = Math.abs(ringSignedArea(poly[0] || []));
      if (pt && area > bestArea) {
        bestArea = area;
        best = pt;
      }
    }
    return best;
  }
  if (geom.type === "Point") return geom.coordinates;
  return null;
}

/** Exterior-ring centroid (falls back to first vertex). */
function polygonLabelPoint(coords) {
  const ring = coords && coords[0];
  if (!ring || ring.length < 1) return null;
  const a = ringSignedArea(ring);
  if (Math.abs(a) < 1e-18) {
    return [ring[0][0], ring[0][1]];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = ring[i][0];
    const y1 = ring[i][1];
    const x2 = ring[i + 1][0];
    const y2 = ring[i + 1][1];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

function ringSignedArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
}

function filterExpr() {
  const ids = [...state.enabled];
  if (!ids.length) return ["==", ["get", "legend_id"], "__none__"];
  return ["match", ["get", "legend_id"], ids, true, false];
}

function applyLaserFilter(map) {
  const filter = filterExpr();
  const vis = state.enabled.size ? "visible" : "none";
  for (const id of [LAYER_IDS.laserFill, LAYER_IDS.laserLabel]) {
    if (map.getLayer(id)) {
      map.setFilter(id, filter);
      map.setLayoutProperty(id, "visibility", vis);
    }
  }
}

export function addLaserLayers(map) {
  if (!state.data) throw new Error("laser not loaded");
  if (!state.labelData) {
    state.labelData = buildLaserLabelPoints(state.data);
  }
  if (!map.getSource(SOURCE_IDS.laser)) {
    map.addSource(SOURCE_IDS.laser, { type: "geojson", data: state.data });
  }
  if (!map.getSource(SOURCE_IDS.laserLabels)) {
    map.addSource(SOURCE_IDS.laserLabels, {
      type: "geojson",
      data: state.labelData,
    });
  }
  if (!map.getLayer(LAYER_IDS.laserFill)) {
    map.addLayer({
      id: LAYER_IDS.laserFill,
      type: "fill",
      source: SOURCE_IDS.laser,
      paint: {
        "fill-color": ["coalesce", ["get", "color"], "#0d9488"],
        "fill-opacity": 0.35,
      },
      filter: filterExpr(),
    });
  }
  if (!map.getLayer(LAYER_IDS.laserLabel)) {
    map.addLayer({
      id: LAYER_IDS.laserLabel,
      type: "symbol",
      source: SOURCE_IDS.laserLabels,
      maxzoom: LASER_LABEL_MAX_ZOOM,
      filter: filterExpr(),
      layout: {
        "text-field": [
          "concat",
          "航空機レーザー\n",
          ["to-string", ["get", "year"]],
          "年度",
        ],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 12, 14],
        "text-anchor": "center",
        "text-justify": "center",
        "text-line-height": 1.2,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "symbol-placement": "point",
      },
      paint: {
        "text-color": ["coalesce", ["get", "color"], "#e8eef2"],
        "text-halo-color": "#0b1216",
        "text-halo-width": 1.6,
        "text-halo-blur": 0.2,
      },
    });
  }
  bringOverlaysFront(map);
}

export function setLaserLegend(map, legendId, on) {
  if (on) state.enabled.add(legendId);
  else state.enabled.delete(legendId);
  applyLaserFilter(map);
}

export function legends() {
  return (state.index && state.index.legends) || [];
}

export function enabledIds() {
  return [...state.enabled];
}

export function fitInitialYear(map, padding) {
  const bounds = boundsFromFeatureCollection(
    state.data,
    (f) =>
      f.properties &&
      (f.properties.legend_id === INITIAL_LASER_LEGEND_ID ||
        String(f.properties.year) === "2021")
  );
  if (bounds) fitBounds(bounds, padding);
}
