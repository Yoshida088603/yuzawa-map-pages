import { loadDataFile } from "./load.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";
import { INITIAL_LASER_LEGEND_ID } from "./config.js";
import { boundsFromFeatureCollection, fitBounds } from "./map-shell.js";

const state = {
  data: null,
  index: null,
  enabled: new Set(),
};

export async function loadLaser() {
  if (!state.data) {
    state.index = await loadDataFile("laserIndex");
    state.data = await loadDataFile("laser");
    for (const lg of state.index.legends || []) {
      if (lg.default_on) state.enabled.add(lg.id);
    }
  }
  return state;
}

function filterExpr() {
  const ids = [...state.enabled];
  if (!ids.length) return ["==", ["get", "legend_id"], "__none__"];
  return ["match", ["get", "legend_id"], ids, true, false];
}

export function addLaserLayers(map) {
  if (!state.data) throw new Error("laser not loaded");
  if (!map.getSource(SOURCE_IDS.laser)) {
    map.addSource(SOURCE_IDS.laser, { type: "geojson", data: state.data });
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
  bringOverlaysFront(map);
}

export function setLaserLegend(map, legendId, on) {
  if (on) state.enabled.add(legendId);
  else state.enabled.delete(legendId);
  if (map.getLayer(LAYER_IDS.laserFill)) {
    map.setFilter(LAYER_IDS.laserFill, filterExpr());
    map.setLayoutProperty(
      LAYER_IDS.laserFill,
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
