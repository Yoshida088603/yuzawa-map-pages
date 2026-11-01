import { getCenter, getZoom } from "./map-shell.js";
import { lngLatToPlane10, formatPlaneXy } from "./plane.js";
import { fetchGsiElevationMeters } from "./gsi-dem.js";

let elZoom = null;
let elCoords = null;
let elGpsStatus = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let elevTimer = null;
let elevToken = 0;
/** Last DEM elev label for HUD (e.g. "93.0m", "…", "—m"). */
let elevText = "—m";

const ELEV_DEBOUNCE_MS = 280;

/**
 * HUD right-side label: plane XY (EPSG:6678) + DEM elevation.
 * @param {{ x: number, y: number } | null} xy
 * @param {string} elevLabel
 */
export function formatHudPlaneElev(xy, elevLabel = "—m") {
  const plane = xy ? formatPlaneXy(xy, 3) : "—, —";
  const elev = elevLabel || "—m";
  return `${plane}  ${elev}`;
}

function paintCoords() {
  const z = getZoom();
  const c = getCenter();
  if (elZoom && z != null) elZoom.textContent = `Z ${z.toFixed(1)}`;
  if (!elCoords) return;
  if (!c) {
    elCoords.textContent = formatHudPlaneElev(null, elevText);
    return;
  }
  const xy = lngLatToPlane10(c.lng, c.lat);
  elCoords.textContent = formatHudPlaneElev(xy, elevText);
}

function scheduleElevation() {
  const c = getCenter();
  if (!c) return;
  const token = ++elevToken;
  const lng = c.lng;
  const lat = c.lat;
  elevText = "…";
  paintCoords();
  if (elevTimer != null) clearTimeout(elevTimer);
  elevTimer = setTimeout(async () => {
    elevTimer = null;
    try {
      const { meters } = await fetchGsiElevationMeters(lng, lat);
      if (token !== elevToken) return;
      elevText = `${Number(meters).toFixed(1)}m`;
      paintCoords();
    } catch {
      if (token !== elevToken) return;
      elevText = "—m";
      paintCoords();
    }
  }, ELEV_DEBOUNCE_MS);
}

export function bindHud(map) {
  elZoom = document.getElementById("hud-zoom");
  elCoords = document.getElementById("hud-coords");
  elGpsStatus = document.getElementById("hud-gps-status");
  map.on("move", paintCoords);
  map.on("zoom", paintCoords);
  map.on("moveend", scheduleElevation);
  map.on("zoomend", scheduleElevation);
  paintCoords();
  scheduleElevation();
}

export function setGpsHudStatus(msg) {
  if (!elGpsStatus) elGpsStatus = document.getElementById("hud-gps-status");
  if (!elGpsStatus) return;
  if (!msg) {
    elGpsStatus.hidden = true;
    elGpsStatus.textContent = "";
    return;
  }
  elGpsStatus.hidden = false;
  elGpsStatus.textContent = msg;
}

export function hudPadding() {
  const bar = document.getElementById("hud");
  const h = bar ? bar.getBoundingClientRect().height : 48;
  const safeBottom =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat-b")) || 0;
  return {
    top: 56,
    bottom: Math.ceil(h + safeBottom + 8),
    left: 16,
    right: 56,
  };
}
