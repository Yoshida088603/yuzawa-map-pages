import { loadDataFile } from "./load.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";

const state = {
  data: null,
  index: null,
  enabled: new Set(),
};

export async function loadShinrin() {
  if (!state.data) {
    state.index = await loadDataFile("shinrinIndex");
    state.data = await loadDataFile("shinrin");
    for (const lg of state.index.legends || []) {
      if (lg.default_on) state.enabled.add(lg.id);
    }
  }
  return state;
}

function filterExpr() {
  const ids = [...state.enabled];
  if (!ids.length) return ["==", ["get", "layer_id"], "__none__"];
  return ["match", ["get", "layer_id"], ids, true, false];
}

export function addShinrinLayers(map) {
  if (!state.data) throw new Error("shinrin not loaded");
  if (!map.getSource(SOURCE_IDS.shinrin)) {
    map.addSource(SOURCE_IDS.shinrin, { type: "geojson", data: state.data });
  }
  if (!map.getLayer(LAYER_IDS.shinrinFill)) {
    map.addLayer({
      id: LAYER_IDS.shinrinFill,
      type: "fill",
      source: SOURCE_IDS.shinrin,
      paint: {
        "fill-color": ["coalesce", ["get", "color"], "#0000ff"],
        "fill-opacity": 0.35,
      },
      filter: filterExpr(),
    });
  }
  bringOverlaysFront(map);
}

export function setShinrinLegend(map, layerId, on) {
  if (on) state.enabled.add(layerId);
  else state.enabled.delete(layerId);
  if (map.getLayer(LAYER_IDS.shinrinFill)) {
    map.setFilter(LAYER_IDS.shinrinFill, filterExpr());
    map.setLayoutProperty(
      LAYER_IDS.shinrinFill,
      "visibility",
      state.enabled.size ? "visible" : "none"
    );
  }
}

export function legends() {
  return (state.index && state.index.legends) || [];
}

export function enabledIds() {
  return [...state.enabled];
}
