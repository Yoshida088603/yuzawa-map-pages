/**
 * Administrative / koaza boundary lines — default OFF, zoom-dependent.
 */

import { loadDataFile } from "./load.js";
import { BOUNDARIES_MIN_ZOOM, BOUNDARIES_LABEL_MIN_ZOOM } from "./config.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";

const state = {
  data: null,
  visible: false,
  available: false,
};

export async function loadBoundaries() {
  try {
    state.data = await loadDataFile("boundaries");
    state.available = !!(state.data && state.data.features && state.data.features.length);
  } catch (_) {
    state.data = { type: "FeatureCollection", features: [] };
    state.available = false;
  }
  return state;
}

export function isBoundariesAvailable() {
  return state.available;
}

export function isBoundariesVisible() {
  return state.visible;
}

export function addBoundariesLayers(map) {
  if (!state.data) return;
  if (!map.getSource(SOURCE_IDS.boundaries)) {
    map.addSource(SOURCE_IDS.boundaries, { type: "geojson", data: state.data });
  }
  if (!map.getLayer(LAYER_IDS.boundariesLine)) {
    map.addLayer({
      id: LAYER_IDS.boundariesLine,
      type: "line",
      source: SOURCE_IDS.boundaries,
      minzoom: BOUNDARIES_MIN_ZOOM,
      filter: ["==", ["get", "kind"], "boundary"],
      layout: {
        visibility: state.visible ? "visible" : "none",
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#c4b59a",
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 15, 1.4],
        "line-opacity": 0.85,
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.boundariesLabel)) {
    map.addLayer({
      id: LAYER_IDS.boundariesLabel,
      type: "symbol",
      source: SOURCE_IDS.boundaries,
      minzoom: BOUNDARIES_LABEL_MIN_ZOOM,
      filter: ["==", ["get", "kind"], "label"],
      layout: {
        visibility: state.visible ? "visible" : "none",
        "text-field": ["coalesce", ["get", "name"], ""],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-optional": true,
        "symbol-placement": "point",
      },
      paint: {
        "text-color": "#e8eef2",
        "text-halo-color": "#0b1216",
        "text-halo-width": 1.2,
      },
    });
  }
  bringOverlaysFront(map);
}

export function setBoundariesVisible(map, on) {
  state.visible = !!on && state.available;
  const v = state.visible ? "visible" : "none";
  for (const id of [LAYER_IDS.boundariesLine, LAYER_IDS.boundariesLabel]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
  }
}
