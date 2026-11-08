/**
 * Overlay stack (bottom → top):
 * basemap → raster(images) → boundaries → shinrin → laser → survey-points → memos → place-search → gps
 */

export const LAYER_IDS = {
  rasterPrefix: "yuzawa-raster-",
  boundariesLine: "yuzawa-boundaries-line",
  boundariesLabel: "yuzawa-boundaries-label",
  shinrinOutline: "yuzawa-shinrin-outline",
  shinrinParcelsLine: "yuzawa-shinrin-parcels-line",
  laserFill: "yuzawa-laser-fill",
  laserLabel: "yuzawa-laser-label",
  surveyPointsHalo: "yuzawa-survey-points-halo",
  surveyPointsCircle: "yuzawa-survey-points-circle",
  surveyPointsLabel: "yuzawa-survey-points-label",
  memosHalo: "yuzawa-memos-halo",
  memosCircle: "yuzawa-memos-circle",
  memosLabel: "yuzawa-memos-label",
  placeSearchDot: "yuzawa-place-search-dot",
  gpsAccuracy: "yuzawa-gps-accuracy",
  gpsDot: "yuzawa-gps-dot",
};

export const SOURCE_IDS = {
  rasterPrefix: "yuzawa-raster-src-",
  boundaries: "yuzawa-boundaries-src",
  shinrin: "yuzawa-shinrin-src",
  shinrinParcels: "yuzawa-shinrin-parcels-src",
  laser: "yuzawa-laser-src",
  laserLabels: "yuzawa-laser-labels-src",
  surveyPoints: "yuzawa-survey-points-src",
  memos: "yuzawa-memos-src",
  gps: "yuzawa-gps-src",
};

function rasterIdsOnMap(map) {
  const style = map.getStyle && map.getStyle();
  const layers = (style && style.layers) || [];
  return layers
    .map((l) => l.id)
    .filter((id) => id && String(id).startsWith(LAYER_IDS.rasterPrefix));
}

/** Keep overlays above basemap layers in declared order. */
export function bringOverlaysFront(map) {
  const order = [
    ...rasterIdsOnMap(map),
    LAYER_IDS.boundariesLine,
    LAYER_IDS.boundariesLabel,
    LAYER_IDS.shinrinOutline,
    LAYER_IDS.shinrinParcelsLine,
    LAYER_IDS.laserFill,
    LAYER_IDS.laserLabel,
    LAYER_IDS.surveyPointsHalo,
    LAYER_IDS.surveyPointsCircle,
    LAYER_IDS.surveyPointsLabel,
    LAYER_IDS.memosHalo,
    LAYER_IDS.memosCircle,
    LAYER_IDS.memosLabel,
    LAYER_IDS.placeSearchDot,
    LAYER_IDS.gpsAccuracy,
    LAYER_IDS.gpsDot,
  ];
  for (const id of order) {
    if (map.getLayer(id)) {
      try {
        map.moveLayer(id);
      } catch (_) {}
    }
  }
}
