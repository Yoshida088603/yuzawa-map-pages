import { loadDataFile, getVersionedUrl } from "./load.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";

/** Parcel lines from this zoom; dissolve outline only below. */
export const PARCELS_LINE_MINZOOM = 13;

const state = {
  data: null,
  index: null,
  parcelsIndex: null,
  parcelsUrl: null,
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
  if (!state.parcelsUrl) {
    state.parcelsIndex = await loadDataFile("shinrinParcelsIndex");
    state.parcelsUrl = await getVersionedUrl("shinrinParcels");
  }
  return state;
}

function filterExpr() {
  const ids = [...state.enabled];
  if (!ids.length) return ["==", ["get", "layer_id"], "__none__"];
  return ["match", ["get", "layer_id"], ids, true, false];
}

function applyLegendVisibility(map) {
  const vis = state.enabled.size ? "visible" : "none";
  const filt = filterExpr();
  for (const id of [LAYER_IDS.shinrinOutline, LAYER_IDS.shinrinParcelsLine]) {
    if (map.getLayer(id)) {
      map.setFilter(id, filt);
      map.setLayoutProperty(id, "visibility", vis);
    }
  }
}

export function addShinrinLayers(map) {
  if (!state.data) throw new Error("shinrin not loaded");
  if (!state.parcelsUrl) throw new Error("shinrin parcels URL not loaded");

  // Remove legacy fill if an older session/cache still has it.
  if (map.getLayer("yuzawa-shinrin-fill")) {
    try {
      map.removeLayer("yuzawa-shinrin-fill");
    } catch (_) {}
  }

  if (!map.getSource(SOURCE_IDS.shinrin)) {
    map.addSource(SOURCE_IDS.shinrin, { type: "geojson", data: state.data });
  }
  if (!map.getLayer(LAYER_IDS.shinrinOutline)) {
    map.addLayer({
      id: LAYER_IDS.shinrinOutline,
      type: "line",
      source: SOURCE_IDS.shinrin,
      maxzoom: PARCELS_LINE_MINZOOM,
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: state.enabled.size ? "visible" : "none",
      },
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#0000ff"],
        "line-opacity": 0.85,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          1.2,
          12,
          2.0,
        ],
      },
      filter: filterExpr(),
    });
  }

  if (!map.getSource(SOURCE_IDS.shinrinParcels)) {
    const meta = state.parcelsIndex || {};
    map.addSource(SOURCE_IDS.shinrinParcels, {
      type: "vector",
      url: "pmtiles://" + state.parcelsUrl,
      minzoom: typeof meta.minzoom === "number" ? meta.minzoom : 10,
      maxzoom: typeof meta.maxzoom === "number" ? meta.maxzoom : 16,
    });
  }
  if (!map.getLayer(LAYER_IDS.shinrinParcelsLine)) {
    map.addLayer({
      id: LAYER_IDS.shinrinParcelsLine,
      type: "line",
      source: SOURCE_IDS.shinrinParcels,
      "source-layer": "shinrin",
      minzoom: PARCELS_LINE_MINZOOM,
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: state.enabled.size ? "visible" : "none",
      },
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#0000ff"],
        "line-opacity": 0.75,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13,
          0.8,
          16,
          1.6,
        ],
      },
      filter: filterExpr(),
    });
  }

  bringOverlaysFront(map);
}

export function setShinrinLegend(map, layerId, on) {
  if (on) state.enabled.add(layerId);
  else state.enabled.delete(layerId);
  applyLegendVisibility(map);
}

export function legends() {
  return (state.index && state.index.legends) || [];
}

export function enabledIds() {
  return [...state.enabled];
}
