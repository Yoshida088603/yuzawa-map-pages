import { memoDetailUrl, PLANE_CRS_LABEL, PUBLIC_URL } from "./config.js";
import { BASEMAPS, getBasemap, setBasemap, isOsmAvailable } from "./basemap.js";
import * as Laser from "./laser.js";
import * as Shinrin from "./shinrin.js";
import * as Memos from "./memos.js";
import * as Boundaries from "./boundaries.js";
import { DETAIL_LINES } from "./attributions.js";
import {
  openMaps,
  openStreetView,
  openRoute,
  formatLatLng,
  formatLngLat,
  planeXy,
  planeXyText,
  copyText,
} from "./actions.js";
import { bringOverlaysFront } from "./layer-order.js";
import { addPhotoToMemo, photoObjectUrl } from "./photos.js";
import { exportLocalBundle, pendingSummary } from "./sync-export.js";
import { prefetchParcelsForOffline } from "./offline.js";

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
  for (const id of [
    "sheet-layers",
    "sheet-memo",
    "sheet-action",
    "sheet-memo-edit",
  ]) {
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
  const fileInput = $("memo-photo-input");
  if (fileInput) fileInput.value = "";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openLayersSheet() {
  showSheet("sheet-layers");
  refreshDataSection();
}

async function refreshDataSection() {
  const el = $("layer-sync-status");
  if (!el) return;
  try {
    const s = await pendingSummary();
    const online = navigator.onLine;
    const parts = [];
    parts.push(online ? "オンライン" : "オフライン");
    if (s.pendingOps || s.localMemos) {
      parts.push(`未エクスポート 操作${s.pendingOps} / メモ${s.localMemos}`);
    } else {
      parts.push("同期待ちなし");
    }
    el.textContent = parts.join(" · ");
  } catch (_) {
    el.textContent = "データ状態を取得できません";
  }
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

  const boundToggle = $("layer-boundaries");
  if (boundToggle) {
    if (!Boundaries.isBoundariesAvailable()) {
      boundToggle.disabled = true;
      boundToggle.checked = false;
      const span = boundToggle.parentElement && boundToggle.parentElement.querySelector("span");
      if (span) span.textContent = "字・町丁界（データなし）";
    } else {
      boundToggle.checked = Boundaries.isBoundariesVisible();
      boundToggle.addEventListener("change", () => {
        Boundaries.setBoundariesVisible(map, boundToggle.checked);
      });
    }
  }

  const attr = $("layer-attributions");
  attr.innerHTML = DETAIL_LINES.map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  const qrLink = $("layer-qr-link");
  if (qrLink) {
    qrLink.href = PUBLIC_URL;
    qrLink.textContent = PUBLIC_URL;
  }

  const btnExport = $("btn-export-bundle");
  if (btnExport) {
    btnExport.addEventListener("click", async () => {
      btnExport.disabled = true;
      try {
        const r = await exportLocalBundle();
        const msg = $("layer-sync-msg");
        if (!msg) return;
        if (r.ok) msg.textContent = `書き出しました: ${r.filename}`;
        else if (r.reason === "empty") msg.textContent = "書き出す変更がありません";
        else if (r.reason === "abort") msg.textContent = "共有をキャンセルしました";
        else msg.textContent = "書き出しに失敗しました";
        await refreshDataSection();
        updateHudSyncBadge();
      } finally {
        btnExport.disabled = false;
      }
    });
  }

  const btnPrefetch = $("btn-prefetch-parcels");
  if (btnPrefetch) {
    btnPrefetch.addEventListener("click", async () => {
      btnPrefetch.disabled = true;
      const msg = $("layer-sync-msg");
      if (msg) msg.textContent = "筆界を保存しています…";
      try {
        const r = await prefetchParcelsForOffline();
        if (msg) {
          msg.textContent = r.ok
            ? "筆界 PMTiles を端末に保存しました"
            : r.reason || "筆界の保存に失敗しました";
        }
      } finally {
        btnPrefetch.disabled = false;
      }
    });
  }
}

export async function updateHudSyncBadge() {
  const badge = $("hud-sync");
  if (!badge) return;
  try {
    const s = await pendingSummary();
    const offline = !navigator.onLine;
    if (offline) {
      badge.hidden = false;
      badge.textContent = "オフライン";
      badge.classList.add("warn");
    } else if (s.pendingOps || s.localMemos) {
      badge.hidden = false;
      badge.textContent = `未送信${s.pendingOps || s.localMemos}`;
      badge.classList.add("warn");
    } else {
      badge.hidden = true;
      badge.textContent = "";
      badge.classList.remove("warn");
    }
  } catch (_) {
    badge.hidden = true;
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
    ["状態", p.local_status || "shipped"],
    ["id", p.id || ""],
  ];
  body.innerHTML = rows
    .map(
      ([k, v]) =>
        `<div class="detail-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`
    )
    .join("");

  const photosBox = $("memo-detail-photos");
  if (photosBox) {
    photosBox.innerHTML = "";
    const list = Array.isArray(p.photos) ? p.photos : [];
    if (!list.length) {
      photosBox.innerHTML = `<p class="sheet-hint">写真なし</p>`;
    } else {
      for (const ph of list) {
        const wrap = document.createElement("div");
        wrap.className = "photo-thumb-wrap";
        const img = document.createElement("img");
        img.className = "photo-thumb";
        img.alt = "添付写真";
        photoObjectUrl(ph.id).then((url) => {
          if (url) img.src = url;
        });
        wrap.appendChild(img);
        photosBox.appendChild(wrap);
      }
    }
  }

  const more = $("memo-detail-more");
  const url = memoDetailUrl(p.id);
  if (url) {
    more.hidden = false;
    more.href = url;
  } else {
    more.hidden = true;
    more.removeAttribute("href");
  }

  const editBtn = $("btn-memo-edit");
  const delBtn = $("btn-memo-delete");
  const photoBtn = $("btn-memo-photo");
  if (editBtn) {
    editBtn.onclick = () => openMemoEdit(feature);
  }
  if (delBtn) {
    delBtn.onclick = async () => {
      if (!confirm("このメモを削除しますか？")) return;
      await Memos.removeMemo(p.id);
      closeAllSheets();
      updateHudSyncBadge();
    };
  }
  if (photoBtn) {
    photoBtn.onclick = () => {
      const input = $("memo-photo-input");
      if (!input) return;
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          await addPhotoToMemo(p.id, file);
          const updated = Memos.getMemoById(p.id);
          openMemoDetail(updated);
          updateHudSyncBadge();
        } catch (e) {
          alert("写真の保存に失敗: " + ((e && e.message) || e));
        }
      };
      input.click();
    };
  }

  showSheet("sheet-memo");
}

export function openMemoEdit(featureOrNull, lngLat) {
  const isNew = !featureOrNull;
  const feat = featureOrNull;
  const p = (feat && feat.properties) || {};
  const coords = feat
    ? Memos.memoCoords(feat)
    : lngLat
      ? { lng: lngLat.lng, lat: lngLat.lat }
      : null;

  $("memo-edit-title").textContent = isNew ? "メモを追加" : "メモを編集";
  $("memo-edit-id").value = p.id || "";
  $("memo-edit-text").value = p.text || "";
  $("memo-edit-laser").value = p.laser_tag || "";
  $("memo-edit-shinrin").value = p.shinrin_tag || "";
  $("memo-edit-lng").value = coords ? coords.lng : "";
  $("memo-edit-lat").value = coords ? coords.lat : "";

  const moveHint = $("memo-edit-move-hint");
  if (moveHint) {
    moveHint.textContent = isNew
      ? "長押しした位置に追加します。座標は下で微調整できます。"
      : "座標を変えると地点が移動します。";
  }

  showSheet("sheet-memo-edit");
}

export function bindMemoEditForm(map) {
  const form = $("memo-edit-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("memo-edit-id").value || null;
    const text = $("memo-edit-text").value.trim();
    const laser_tag = $("memo-edit-laser").value.trim();
    const shinrin_tag = $("memo-edit-shinrin").value.trim();
    const lng = Number($("memo-edit-lng").value);
    const lat = Number($("memo-edit-lat").value);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      alert("緯度経度が不正です");
      return;
    }
    try {
      const feat = await Memos.upsertMemo({
        id: id || undefined,
        lng,
        lat,
        text,
        laser_tag,
        shinrin_tag,
      });
      updateHudSyncBadge();
      openMemoDetail(feat);
    } catch (err) {
      alert("保存に失敗: " + ((err && err.message) || err));
    }
  });
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
  } else {
    addBtn("ここにメモを追加", () => {
      openMemoEdit(null, { lng, lat });
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
  const xyText = planeXyText(lng, lat);
  addBtn(
    xyText ? `${PLANE_CRS_LABEL}: ${xyText}` : `${PLANE_CRS_LABEL}: 未計算`,
    async () => {
      if (!xyText) return;
      const r = await copyText(xyText);
      if (!r.ok) showCopyFallback(xyText);
      else flashCopied();
    },
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

  const badge = $("hud-sync");
  if (badge) {
    badge.style.pointerEvents = "auto";
    badge.addEventListener("click", () => openLayersSheet());
  }

  window.addEventListener("online", () => updateHudSyncBadge());
  window.addEventListener("offline", () => updateHudSyncBadge());
}
