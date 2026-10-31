/**
 * Overlay stack (bottom → top):
 * basemap → boundaries → shinrin(outline) → shinrin(parcels line) → laser → memos → gps
 */

export const LAYER_IDS = {
  boundariesLine: "yuzawa-boundaries-line",
  boundariesLabel: "yuzawa-boundaries-label",
  shinrinOutline: "yuzawa-shinrin-outline",
  shinrinParcelsLine: "yuzawa-shinrin-parcels-line",
  laserFill: "yuzawa-laser-fill",
  laserLabel: "yuzawa-laser-label",
  memosHalo: "yuzawa-memos-halo",
  memosCircle: "yuzawa-memos-circle",
  memosLabel: "yuzawa-memos-label",
  gpsAccuracy: "yuzawa-gps-accuracy",
  gpsDot: "yuzawa-gps-dot",
};

export const SOURCE_IDS = {
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
    LAYER_IDS.boundariesLine,
    LAYER_IDS.boundariesLabel,
    LAYER_IDS.shinrinOutline,
    LAYER_IDS.shinrinParcelsLine,
    LAYER_IDS.laserFill,
    LAYER_IDS.laserLabel,
    LAYER_IDS.memosHalo,
    LAYER_IDS.memosCircle,
    LAYER_IDS.memosLabel,
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
