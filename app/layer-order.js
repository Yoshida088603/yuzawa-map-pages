/**
 * Overlay stack (bottom → top):
 * basemap → roof DSM image → boundaries → shinrin → laser → memos → roof RMSE → place-search → gps
 */

export const LAYER_IDS = {
  roofDsmImage: "yuzawa-roof-dsm-image",
  boundariesLine: "yuzawa-boundaries-line",
  boundariesLabel: "yuzawa-boundaries-label",
  shinrinOutline: "yuzawa-shinrin-outline",
  shinrinParcelsLine: "yuzawa-shinrin-parcels-line",
  laserFill: "yuzawa-laser-fill",
  laserLabel: "yuzawa-laser-label",
  memosHalo: "yuzawa-memos-halo",
  memosCircle: "yuzawa-memos-circle",
  memosLabel: "yuzawa-memos-label",
  roofRmseHalo: "yuzawa-roof-rmse-halo",
  roofRmseCircle: "yuzawa-roof-rmse-circle",
  roofRmseLabel: "yuzawa-roof-rmse-label",
  placeSearchDot: "yuzawa-place-search-dot",
  gpsAccuracy: "yuzawa-gps-accuracy",
  gpsDot: "yuzawa-gps-dot",
};

export const SOURCE_IDS = {
  roofDsmImage: "yuzawa-roof-dsm-image-src",
  roofRmsePoints: "yuzawa-roof-rmse-points-src",
  boundaries: "yuzawa-boundaries-src",
  shinrin: "yuzawa-shinrin-src",
  shinrinParcels: "yuzawa-shinrin-parcels-src",
  laser: "yuzawa-laser-src",
  laserLabels: "yuzawa-laser-labels-src",
  memos: "yuzawa-memos-src",
  gps: "yuzawa-gps-src",
};

/** Keep overlays above basemap layers in declared order. */
export function bringOverlaysFront(map) {
  const order = [
    LAYER_IDS.roofDsmImage,
    LAYER_IDS.boundariesLine,
    LAYER_IDS.boundariesLabel,
    LAYER_IDS.shinrinOutline,
    LAYER_IDS.shinrinParcelsLine,
    LAYER_IDS.laserFill,
    LAYER_IDS.laserLabel,
    LAYER_IDS.memosHalo,
    LAYER_IDS.memosCircle,
    LAYER_IDS.memosLabel,
    LAYER_IDS.roofRmseHalo,
    LAYER_IDS.roofRmseCircle,
    LAYER_IDS.roofRmseLabel,
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
