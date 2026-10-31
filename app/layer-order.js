/**
 * Overlay stack (bottom → top):
 * basemap → [future boundaries] → shinrin(outline) → shinrin(parcels line) → laser → memos → [future GPS]
 */

export const LAYER_IDS = {
  shinrinOutline: "yuzawa-shinrin-outline",
  shinrinParcelsLine: "yuzawa-shinrin-parcels-line",
  laserFill: "yuzawa-laser-fill",
  memosHalo: "yuzawa-memos-halo",
  memosCircle: "yuzawa-memos-circle",
  memosLabel: "yuzawa-memos-label",
};

export const SOURCE_IDS = {
  shinrin: "yuzawa-shinrin-src",
  shinrinParcels: "yuzawa-shinrin-parcels-src",
  laser: "yuzawa-laser-src",
  memos: "yuzawa-memos-src",
};

/** Keep overlays above basemap layers in declared order. */
export function bringOverlaysFront(map) {
  const order = [
    LAYER_IDS.shinrinOutline,
    LAYER_IDS.shinrinParcelsLine,
    LAYER_IDS.laserFill,
    LAYER_IDS.memosHalo,
    LAYER_IDS.memosCircle,
    LAYER_IDS.memosLabel,
  ];
  for (const id of order) {
    if (map.getLayer(id)) {
      try {
        map.moveLayer(id);
      } catch (_) {}
    }
  }
}
