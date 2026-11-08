/**
 * Survey control / stake points from A-SurveyAdB SIMA (plane 10 → WGS84).
 * Default OFF — precise coordinates; confirm publication scope (see ACCESS.md).
 */

import { loadDataFile } from "./load.js";
import { LABEL_MIN_ZOOM } from "./config.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";

const state = {
  data: null,
  visible: false,
  available: false,
};

export async function loadSurveyPoints() {
  try {
    state.data = await loadDataFile("surveyPoints");
    state.available = !!(state.data && state.data.features && state.data.features.length);
  } catch (_) {
    state.data = { type: "FeatureCollection", features: [] };
    state.available = false;
  }
  return state;
}

export function isSurveyPointsAvailable() {
  return state.available;
}

export function isSurveyPointsVisible() {
  return state.visible;
}

export function surveyPointCount() {
  return (state.data && state.data.features && state.data.features.length) || 0;
}

export function addSurveyPointLayers(map) {
  if (!state.data) return;
  if (!map.getSource(SOURCE_IDS.surveyPoints)) {
    map.addSource(SOURCE_IDS.surveyPoints, { type: "geojson", data: state.data });
  }
  if (!map.getLayer(LAYER_IDS.surveyPointsHalo)) {
    map.addLayer({
      id: LAYER_IDS.surveyPointsHalo,
      type: "circle",
      source: SOURCE_IDS.surveyPoints,
      layout: { visibility: state.visible ? "visible" : "none" },
      paint: {
        "circle-radius": 9,
        "circle-color": "#ffffff",
        "circle-opacity": 0.85,
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.surveyPointsCircle)) {
    map.addLayer({
      id: LAYER_IDS.surveyPointsCircle,
      type: "circle",
      source: SOURCE_IDS.surveyPoints,
      layout: { visibility: state.visible ? "visible" : "none" },
      paint: {
        "circle-radius": 5.5,
        "circle-color": "#c2410c",
        "circle-stroke-width": 1.25,
        "circle-stroke-color": "#0b1216",
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.surveyPointsLabel)) {
    map.addLayer({
      id: LAYER_IDS.surveyPointsLabel,
      type: "symbol",
      source: SOURCE_IDS.surveyPoints,
      minzoom: LABEL_MIN_ZOOM,
      layout: {
        visibility: state.visible ? "visible" : "none",
        "text-field": ["coalesce", ["get", "name"], ""],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-offset": [0, 1.15],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: {
        "text-color": "#fde68a",
        "text-halo-color": "#0b1216",
        "text-halo-width": 1.4,
      },
    });
  }
  bringOverlaysFront(map);
}

export function setSurveyPointsVisible(map, on) {
  state.visible = !!on && state.available;
  const v = state.visible ? "visible" : "none";
  for (const id of [
    LAYER_IDS.surveyPointsHalo,
    LAYER_IDS.surveyPointsCircle,
    LAYER_IDS.surveyPointsLabel,
  ]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
  }
}
