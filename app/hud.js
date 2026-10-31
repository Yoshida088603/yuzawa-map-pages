import { getCenter, getZoom } from "./map-shell.js";

let elZoom = null;
let elCoords = null;

export function bindHud(map) {
  elZoom = document.getElementById("hud-zoom");
  elCoords = document.getElementById("hud-coords");
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

export function hudPadding() {
  const bar = document.getElementById("hud");
  const h = bar ? bar.getBoundingClientRect().height : 48;
  const safeBottom =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat-b")) || 0;
  return {
    top: 56,
    bottom: Math.ceil(h + safeBottom + 8),
    left: 16,
    right: 16,
  };
}
