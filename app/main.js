import { INITIAL_BASEMAP } from "./config.js";
import {
  buildInitialStyle,
  applyInitialBasemap,
  injectOsmLayers,
} from "./basemap.js";
import { createMap } from "./map-shell.js";
import { bindHud, hudPadding } from "./hud.js";
import { loadLaser, addLaserLayers, fitInitialYear } from "./laser.js";
import { loadShinrin, addShinrinLayers } from "./shinrin.js";
import { loadMemos, addMemoLayers, getMemoById } from "./memos.js";
import {
  bindSheetChrome,
  bindLayersSheet,
  openMemoDetail,
  closeAllSheets,
} from "./sheets.js";
import { bindGestures } from "./gestures.js";
import { bringOverlaysFront } from "./layer-order.js";

const statusEl = document.getElementById("boot-status");

function status(msg) {
  if (statusEl) {
    statusEl.hidden = false;
    statusEl.textContent = msg || "";
  }
}

function parseMemoQuery() {
  const q = new URLSearchParams(window.location.search);
  return q.get("memo");
}

async function main() {
  status("地図を準備しています…");
  const style = buildInitialStyle();

  let map;
  try {
    map = createMap("map", style);
  } catch (e) {
    const msg = String((e && e.message) || e);
    status(
      msg.includes("WebGL") || msg.includes("webgl")
        ? "WebGL を初期化できません。Chrome / Edge で開いてください。"
        : "地図の初期化に失敗: " + msg
    );
    return;
  }

  await new Promise((resolve) => {
    if (map.loaded()) resolve();
    else map.once("load", resolve);
  });

  applyInitialBasemap(map, INITIAL_BASEMAP);
  bindHud(map);
  bindSheetChrome();

  status("データを読み込んでいます…");
  try {
    await Promise.all([loadLaser(), loadShinrin(), loadMemos()]);
  } catch (e) {
    status("データ読込失敗: " + (e.message || e));
    return;
  }

  addShinrinLayers(map);
  addLaserLayers(map);
  addMemoLayers(map);
  bringOverlaysFront(map);

  fitInitialYear(map, hudPadding());
  bindGestures(map);

  // OSM is optional; inject after overlays so boot is not blocked.
  status("OSM 背景を準備しています…");
  await injectOsmLayers(map);
  bringOverlaysFront(map);
  bindLayersSheet(map);

  const memoId = parseMemoQuery();
  if (memoId) {
    const feat = getMemoById(memoId);
    if (feat) {
      const c = feat.geometry.coordinates;
      map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 15), duration: 800 });
      openMemoDetail(feat);
    }
  }

  if (statusEl) {
    statusEl.textContent = "";
    statusEl.hidden = true;
  }

  window.__yuzawaMap = { map, closeAllSheets };
}

main().catch((e) => {
  status(String(e && e.message ? e.message : e));
});
