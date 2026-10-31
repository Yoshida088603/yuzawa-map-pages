/**
 * Register pmtiles:// for MapLibre (vendor IIFE → global `pmtiles`).
 * Call before createMap().
 */

let registered = false;

export function registerPmtilesProtocol() {
  if (registered) return;
  if (typeof maplibregl === "undefined") {
    throw new Error("maplibregl が未読込です");
  }
  if (typeof pmtiles === "undefined" || !pmtiles.Protocol) {
    throw new Error("pmtiles が未読込です（vendor/pmtiles）");
  }
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  registered = true;
}
