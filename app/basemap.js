/**
 * Basemap switch without setStyle — toggle visibility so overlays stay put.
 * Boot with GSI rasters; OpenFreeMap (OSM) layers are injected after map load.
 */

const GSI_STD = {
  tiles: ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"],
  maxzoom: 18,
};
const GSI_PHOTO = {
  tiles: ["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"],
  maxzoom: 18,
};

export const BASEMAPS = {
  photo: { id: "photo", label: "航空写真" },
  gsi: { id: "gsi", label: "地理院標準" },
  osm: { id: "osm", label: "OSM" },
};

let current = "photo";
let osmLayerIds = [];
let osmReady = false;
let osmFailed = false;

/** Reliable boot style — GSI only. Japanese glyphs for memo labels. */
export function buildInitialStyle() {
  return {
    version: 8,
    glyphs: "https://glyphs.geolonia.com/{fontstack}/{range}.pbf",
    sources: {
      "gsi-std": {
        type: "raster",
        tiles: GSI_STD.tiles,
        tileSize: 256,
        maxzoom: GSI_STD.maxzoom,
        attribution:
          '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
      },
      "gsi-photo": {
        type: "raster",
        tiles: GSI_PHOTO.tiles,
        tileSize: 256,
        maxzoom: GSI_PHOTO.maxzoom,
        attribution:
          '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
      },
    },
    layers: [
      {
        id: "gsi-std",
        type: "raster",
        source: "gsi-std",
        layout: { visibility: "none" },
        minzoom: 0,
        maxzoom: 22,
      },
      {
        id: "gsi-photo",
        type: "raster",
        source: "gsi-photo",
        layout: { visibility: "visible" },
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

/**
 * Fetch OpenFreeMap Liberty and insert its layers under GSI rasters.
 * Failures leave OSM unavailable but photo/gsi keep working.
 */
export async function injectOsmLayers(map) {
  if (osmReady || osmFailed) return osmReady;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch("https://tiles.openfreemap.org/styles/liberty", {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error("status " + r.status);
    const osmStyle = await r.json();

    const sources = osmStyle.sources || {};
    for (const [sid, spec] of Object.entries(sources)) {
      const id = "osm-" + sid;
      if (!map.getSource(id)) {
        const copy = { ...spec };
        map.addSource(id, copy);
      }
    }

    const beforeId = map.getLayer("gsi-std") ? "gsi-std" : undefined;
    for (const layer of osmStyle.layers || []) {
      const id = "osm-" + layer.id;
      if (map.getLayer(id)) continue;
      const src = layer.source != null ? "osm-" + layer.source : undefined;
      const next = {
        ...layer,
        id,
        source: src,
        layout: { ...(layer.layout || {}), visibility: "none" },
      };
      // Drop sprite-dependent properties if we did not load the sprite
      if (next.layout && next.layout["icon-image"]) {
        // Keep layer; missing icons just omit symbols
      }
      try {
        if (beforeId) map.addLayer(next, beforeId);
        else map.addLayer(next);
        osmLayerIds.push(id);
      } catch (err) {
        // Skip incompatible layers (e.g. custom expressions / missing sprite)
        console.warn("skip OSM layer", id, err);
      }
    }

    // Prefer Geolonia glyphs already set on style; OpenFreeMap icons may be incomplete without sprite.
    if (osmStyle.sprite && !map.getStyle().sprite) {
      // MapLibre cannot set sprite after construction easily; OSM labels/fills still useful.
    }

    osmReady = osmLayerIds.length > 0;
    if (!osmReady) osmFailed = true;
  } catch (e) {
    console.warn("OpenFreeMap inject failed", e);
    osmFailed = true;
    osmReady = false;
  }
  return osmReady;
}

export function getBasemap() {
  return current;
}

export function isOsmAvailable() {
  return osmReady;
}

export function setBasemap(map, id) {
  if (!BASEMAPS[id]) id = "photo";
  if (id === "osm" && !osmReady) id = "photo";
  current = id;

  for (const lid of osmLayerIds) {
    if (map.getLayer(lid)) {
      map.setLayoutProperty(lid, "visibility", id === "osm" ? "visible" : "none");
    }
  }
  if (map.getLayer("gsi-std")) {
    map.setLayoutProperty("gsi-std", "visibility", id === "gsi" ? "visible" : "none");
  }
  if (map.getLayer("gsi-photo")) {
    map.setLayoutProperty("gsi-photo", "visibility", id === "photo" ? "visible" : "none");
  }
}

export function applyInitialBasemap(map, id) {
  setBasemap(map, id || "photo");
}
