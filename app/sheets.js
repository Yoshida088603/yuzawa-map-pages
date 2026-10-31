import { memoDetailUrl, PLANE_CRS_LABEL, PUBLIC_URL } from "./config.js";
import { BASEMAPS, getBasemap, setBasemap, isOsmAvailable } from "./basemap.js";
import * as Laser from "./laser.js";
import * as Shinrin from "./shinrin.js";
import * as Memos from "./memos.js";
import { DETAIL_LINES } from "./attributions.js";
import {
  openMaps,
  openStreetView,
  openRoute,
  formatLatLng,
  formatLngLat,
  planeXy,
  copyText,
} from "./actions.js";
import { bringOverlaysFront } from "./layer-order.js";

function $(id) {
  return document.getElementById(id);
}

function showSheet(id) {
  closeAllSheets();
  const el = $(id);
  const backdrop = $("sheet-backdrop");
  if (el) el.hidden = false;
  if (backdrop) backdrop.hidden = false;
}

export function closeAllSheets() {
  for (const id of ["sheet-layers", "sheet-memo", "sheet-action"]) {
    const el = $(id);
    if (el) el.hidden = true;
  }
  const backdrop = $("sheet-backdrop");
  if (backdrop) backdrop.hidden = true;
  const fallback = $("copy-fallback");
  if (fallback) {
    fallback.hidden = true;
    fallback.textContent = "";
  }
}

export function openLayersSheet() {
  showSheet("sheet-layers");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bindLayersSheet(map) {
  const basemapBox = $("layer-basemap");
  basemapBox.innerHTML = "";
  for (const [id, meta] of Object.entries(BASEMAPS)) {
    const label = document.createElement("label");
    label.className = "sheet-row";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "basemap";
    input.value = id;
    input.checked = getBasemap() === id;
    if (id === "osm" && !isOsmAvailable()) {
      input.disabled = true;
      label.title = "OSM（OpenFreeMap）を読み込めませんでした";
    }
    input.addEventListener("change", () => {
      if (input.checked) {
        setBasemap(map, id);
        bringOverlaysFront(map);
      }
    });
    const span = document.createElement("span");
    span.textContent =
      id === "osm" && !isOsmAvailable() ? meta.label + "（未取得）" : meta.label;
    label.append(input, span);
    basemapBox.appendChild(label);
  }

  const memoToggle = $("layer-memos");
  memoToggle.checked = Memos.isMemosVisible();
  memoToggle.addEventListener("change", () => {
    Memos.setMemosVisible(map, memoToggle.checked);
  });

  const laserBox = $("layer-laser");
  laserBox.innerHTML = "";
  const laserEnabled = new Set(Laser.enabledIds());
  for (const lg of Laser.legends()) {
    const label = document.createElement("label");
    label.className = "sheet-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = laserEnabled.has(lg.id);
    cb.addEventListener("change", () => {
      Laser.setLaserLegend(map, lg.id, cb.checked);
    });
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = lg.color;
    const span = document.createElement("span");
    span.textContent = lg.name;
    label.append(cb, sw, span);
    laserBox.appendChild(label);
  }

  const shinrinBox = $("layer-shinrin");
  shinrinBox.innerHTML = "";
  const shinrinEnabled = new Set(Shinrin.enabledIds());
  for (const lg of Shinrin.legends()) {
    const label = document.createElement("label");
    label.className = "sheet-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = shinrinEnabled.has(lg.id);
    cb.addEventListener("change", () => {
      Shinrin.setShinrinLegend(map, lg.id, cb.checked);
    });
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = lg.color;
    const span = document.createElement("span");
    span.textContent = lg.name;
    label.append(cb, sw, span);
    shinrinBox.appendChild(label);
  }

  const attr = $("layer-attributions");
  attr.innerHTML = DETAIL_LINES.map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  const qrLink = $("layer-qr-link");
  if (qrLink) {
    qrLink.href = PUBLIC_URL;
    qrLink.textContent = PUBLIC_URL;
  }
}

export function openMemoDetail(feature) {
  if (!feature) return;
  const p = feature.properties || {};
  const coords = Memos.memoCoords(feature);
  const body = $("memo-detail-body");
  const rows = [
    ["表示名", p.name || ""],
    ["本文", p.text || ""],
    ["レーザタグ", p.laser_tag || ""],
    ["森林タグ", p.shinrin_tag || ""],
    ["緯度", coords ? coords.lat.toFixed(6) : ""],
    ["経度", coords ? coords.lng.toFixed(6) : ""],
    ["作成日時", p.created_at || ""],
    ["更新日時", p.updated_at || ""],
    ["id", p.id || ""],
  ];
  body.innerHTML = rows
    .map(
      ([k, v]) =>
        `<div class="detail-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`
    )
    .join("");

  const more = $("memo-detail-more");
  const url = memoDetailUrl(p.id);
  if (url) {
    more.hidden = false;
    more.href = url;
  } else {
    more.hidden = true;
    more.removeAttribute("href");
  }
  showSheet("sheet-memo");
}

export function openActionSheet(lng, lat, memoFeature) {
  const list = $("action-list");
  list.innerHTML = "";
  const coordsEl = $("action-coords");
  coordsEl.textContent = formatLatLng(lat, lng);

  function addBtn(label, onClick, opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "action-btn";
    btn.textContent = label;
    if (opts && opts.disabled) {
      btn.disabled = true;
      btn.classList.add("disabled");
    }
    btn.addEventListener("click", async () => {
      await onClick();
    });
    list.appendChild(btn);
  }

  if (memoFeature) {
    addBtn("この地点メモを表示", () => {
      openMemoDetail(memoFeature);
    });
  }

  addBtn("Googleマップで開く", () => {
    openMaps(lat, lng);
    closeAllSheets();
  });
  addBtn("ストリートビュー", () => {
    openStreetView(lat, lng);
    closeAllSheets();
  });
  addBtn("ルート検索", () => {
    openRoute(lat, lng);
    closeAllSheets();
  });

  addBtn("座標コピー（緯度,経度）", async () => {
    const text = formatLatLng(lat, lng);
    const r = await copyText(text);
    if (!r.ok) showCopyFallback(text);
    else flashCopied();
  });
  addBtn("座標コピー（経度,緯度）", async () => {
    const text = formatLngLat(lat, lng);
    const r = await copyText(text);
    if (!r.ok) showCopyFallback(text);
    else flashCopied();
  });

  const xy = planeXy(lng, lat);
  addBtn(
    xy
      ? `${PLANE_CRS_LABEL}: ${xy.x}, ${xy.y}`
      : `${PLANE_CRS_LABEL}: 未計算`,
    async () => {},
    { disabled: !xy }
  );

  showSheet("sheet-action");
}

function showCopyFallback(text) {
  const el = $("copy-fallback");
  if (!el) return;
  el.hidden = false;
  el.textContent = text;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function flashCopied() {
  const el = $("copy-fallback");
  if (!el) return;
  el.hidden = false;
  el.textContent = "コピーしました";
  setTimeout(() => {
    if (el.textContent === "コピーしました") {
      el.hidden = true;
      el.textContent = "";
    }
  }, 1200);
}

export function bindSheetChrome() {
  $("btn-layers").addEventListener("click", () => openLayersSheet());
  $("sheet-backdrop").addEventListener("click", () => closeAllSheets());
  document.querySelectorAll("[data-close-sheet]").forEach((btn) => {
    btn.addEventListener("click", () => closeAllSheets());
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllSheets();
  });
}
