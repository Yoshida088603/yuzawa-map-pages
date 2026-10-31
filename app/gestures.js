import { LONG_PRESS_MS, LONG_PRESS_MOVE_PX } from "./config.js";
import * as Memos from "./memos.js";
import { openMemoDetail, openActionSheet, closeAllSheets } from "./sheets.js";

export function bindGestures(map) {
  map.on("click", Memos.MEMO_CIRCLE_LAYER, (e) => {
    if (!e.features || !e.features.length) return;
    e.originalEvent && e.originalEvent.stopPropagation && e.originalEvent.stopPropagation();
    const id = e.features[0].properties && e.features[0].properties.id;
    const feat = id != null ? Memos.getMemoById(id) : null;
    if (feat) openMemoDetail(feat);
  });

  map.on("click", (e) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: [Memos.MEMO_CIRCLE_LAYER].filter((id) => map.getLayer(id)),
    });
    if (!hits.length) closeAllSheets();
  });

  let timer = null;
  let start = null;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    start = null;
  }

  function fireLongPress(clientX, clientY, lngLat) {
    const point = map.project(lngLat);
    const memo = Memos.featureAtPoint(map, point);
    openActionSheet(lngLat.lng, lngLat.lat, memo);
  }

  const canvas = map.getCanvas();

  canvas.addEventListener(
    "touchstart",
    (ev) => {
      if (ev.touches.length !== 1) {
        clearTimer();
        return;
      }
      const t = ev.touches[0];
      start = { x: t.clientX, y: t.clientY };
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      const lngLat = map.unproject([x, y]);
      timer = setTimeout(() => {
        timer = null;
        fireLongPress(t.clientX, t.clientY, lngLat);
      }, LONG_PRESS_MS);
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchmove",
    (ev) => {
      if (!start || !timer) return;
      const t = ev.touches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (dx * dx + dy * dy > LONG_PRESS_MOVE_PX * LONG_PRESS_MOVE_PX) {
        clearTimer();
      }
    },
    { passive: true }
  );

  canvas.addEventListener("touchend", () => clearTimer(), { passive: true });
  canvas.addEventListener("touchcancel", () => clearTimer(), { passive: true });

  map.getCanvas().addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
  });
  map.on("contextmenu", (e) => {
    e.preventDefault();
    const memo = Memos.featureAtPoint(map, e.point);
    openActionSheet(e.lngLat.lng, e.lngLat.lat, memo);
  });

  map.on("movestart", () => clearTimer());
}
