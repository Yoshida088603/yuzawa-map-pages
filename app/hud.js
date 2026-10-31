import { getCenter, getZoom } from "./map-shell.js";

let elZoom = null;
let elCoords = null;
let elGpsStatus = null;

export function bindHud(map) {
  elZoom = document.getElementById("hud-zoom");
  elCoords = document.getElementById("hud-coords");
  elGpsStatus = document.getElementById("hud-gps-status");
  const update = () => {
    const z = getZoom();
    const c = getCenter();
    if (elZoom && z != null) elZoom.textContent = `Z ${z.toFixed(1)}`;
    if (elCoords && c) {
      elCoords.textContent = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
    }
  };
  map.on("move", update);
  map.on("zoom", update);
  update();
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
