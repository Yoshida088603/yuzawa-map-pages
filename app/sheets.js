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
import {
  search3ddbAtPoint,
  build3ddbPointSearchUrl,
  build3ddbZipUrl,
  probe3ddbZip,
  AIST_PUBLIC_TEST_POINT,
  AIST_PUBLIC_BASE,
  AIST_DEFAULT_FEATURES_PATH,
  AIST_INTERNAL_DEFAULT_ZIPDATA_PATH,
  readInternal3ddbConfig,
  writeInternal3ddbConfig,
  clearInternal3ddbConfig,
  build3ddbDiagnosticsReport,
  download3ddbDiagnosticsReport,
  parse3ddbSearchJsonText,
} from "./aist-3ddb.js";

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
    return btn;
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

  // 公開版は固定。内部版は localStorage の差分設定のみ（ホスト等はリポに埋め込まない）。
  function ensureAistResultsPanel(afterEl) {
    const previous = $("aist-3ddb-results");
    if (previous) previous.remove();
    const panel = document.createElement("div");
    panel.id = "aist-3ddb-results";
    afterEl.insertAdjacentElement("afterend", panel);
    panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return panel;
  }

  function appendDiagnosticsDownload(panel, report, label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "aist-3ddb-zip-link";
    btn.textContent = label || "診断ログJSONをダウンロード";
    btn.addEventListener("click", () => {
      try {
        const name = download3ddbDiagnosticsReport(report);
        btn.textContent = `保存しました: ${name}`;
      } catch (err) {
        alert("診断ログの保存に失敗: " + ((err && err.message) || err));
      }
    });
    panel.appendChild(btn);
  }

  function renderAistItemList(panel, items, { kind, base, credentials, zipdataPath }) {
    const listEl = document.createElement("div");
    listEl.className = "aist-3ddb-list";
    listEl.setAttribute("role", "list");
    panel.appendChild(listEl);

    for (const item of items) {
      const ext = item.externalLinks || [];
      const hasArchive = ext.some((l) => l.type === "archive" || l.type === "copc");
      const wrap = document.createElement("div");
      wrap.className =
        "aist-3ddb-item" +
        (hasArchive || item.downloadable ? " aist-3ddb-item-ok" : " aist-3ddb-item-blocked");
      wrap.setAttribute("role", "listitem");

      const title = document.createElement("div");
      title.className = "aist-3ddb-item-title";
      title.textContent = `[${item.regId}] ${item.title}`;
      wrap.appendChild(title);

      const meta = document.createElement("p");
      meta.className = "sheet-hint aist-3ddb-item-meta";
      const bits = [
        item.service || "種別不明",
        item.coverageLabel || "被覆範囲不明",
        hasArchive
          ? "リストに取得URLあり"
          : item.downloadable
            ? "zipdataあり（リンク遷移）"
            : "取得URLなし",
      ];
      if (item.license) bits.push(item.license);
      meta.textContent = bits.join(" · ");
      wrap.appendChild(meta);

      for (const linkInfo of ext) {
        if (linkInfo.type === "3dtiles") continue;
        const link = document.createElement("a");
        link.className = "aist-3ddb-zip-link";
        link.href = linkInfo.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent =
          linkInfo.type === "archive"
            ? `元データZIPを開く（外部・ID ${item.regId}）`
            : linkInfo.type === "copc"
              ? `COPC点群を開く（ID ${item.regId}）`
              : `${linkInfo.label}（ID ${item.regId}）`;
        wrap.appendChild(link);
      }

      const tiles = ext.find((l) => l.type === "3dtiles");
      if (tiles) {
        const tilesLink = document.createElement("a");
        tilesLink.className = "aist-3ddb-zip-link aist-3ddb-secondary-link";
        tilesLink.href = tiles.url;
        tilesLink.target = "_blank";
        tilesLink.rel = "noopener noreferrer";
        tilesLink.textContent = "3D Tiles（表示用・tileset.json）";
        wrap.appendChild(tilesLink);
      }

      if (item.downloadable && !hasArchive) {
        const link = document.createElement("a");
        link.className = "aist-3ddb-zip-link";
        link.href = build3ddbZipUrl(item.regId, base, zipdataPath);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `この登録のZIPを開く（地点を含む一式・ID ${item.regId}）`;
        wrap.appendChild(link);

        // Public demo: optional HEAD probe. Internal: skip fetch (same CORS wall).
        if (kind !== "internal") {
          const probeStatus = document.createElement("p");
          probeStatus.className = "sheet-hint aist-3ddb-probe";
          probeStatus.textContent = "3DDB zipdata を確認しています…";
          wrap.appendChild(probeStatus);
          probe3ddbZip(item.regId, { base, credentials, zipdataPath })
            .then((probe) => {
              if (probe.ok) {
                probeStatus.textContent = `zipdata疎通: HTTP ${probe.status}`;
              } else {
                probeStatus.textContent = probe.reason;
                probeStatus.classList.add("aist-3ddb-probe-fail");
                link.classList.add("aist-3ddb-zip-link-warn");
              }
            })
            .catch((err) => {
              probeStatus.textContent =
                "zipdata疎通確認に失敗: " + String(err?.message || err);
              probeStatus.classList.add("aist-3ddb-probe-fail");
            });
        }
      }
      listEl.appendChild(wrap);
    }
  }

  function showParsedPointResults(afterEl, parsed, cfg, sourceLabel) {
    const panel = ensureAistResultsPanel(afterEl);
    const status = document.createElement("p");
    status.className = "sheet-hint";
    status.textContent = parsed.items.length
      ? `この地点の候補 ${parsed.items.length}件（API総件数 ${parsed.total}件・${sourceLabel}）。被覆が小さい順。切り出しではなく登録データ一式です。`
      : `この地点の候補は0件です（${sourceLabel}）。`;
    panel.appendChild(status);
    const notice = document.createElement("p");
    notice.className = "sheet-hint";
    notice.textContent =
      `クリック地点 POINT(${lng}, ${lat}) を含む登録です。欲しいのは「過去に開いたID」ではなく、下の一覧から選んだIDのZIPです。`;
    panel.appendChild(notice);
    renderAistItemList(panel, parsed.items, {
      kind: "internal",
      base: cfg.base,
      credentials: cfg.credentials,
      zipdataPath: cfg.zipdataPath,
    });
  }

  async function runAistSearch(triggerBtn, opts) {
    const kind = opts.kind || "public";
    const base = opts.base || AIST_PUBLIC_BASE;
    const credentials = opts.credentials || "omit";
    const featuresPath = opts.featuresPath || AIST_DEFAULT_FEATURES_PATH;
    const zipdataPath =
      opts.zipdataPath ||
      (kind === "internal" ? AIST_INTERNAL_DEFAULT_ZIPDATA_PATH : AIST_DEFAULT_ZIPDATA_PATH);

    const panel = ensureAistResultsPanel(triggerBtn);
    const status = document.createElement("p");
    status.className = "sheet-hint";
    status.textContent =
      kind === "internal" ? "3DDB内部版を検索しています…" : "3DDB公開版を検索しています…";
    panel.appendChild(status);
    triggerBtn.disabled = true;

    try {
      const result = await search3ddbAtPoint(lng, lat, {
        base,
        credentials,
        featuresPath,
        zipdataPath,
      });
      const { items, total, limit } = result;
      const notice = document.createElement("p");
      notice.className = "sheet-hint";
      notice.textContent =
        (kind === "internal" ? `内部base: ${base}（credentials=${credentials}）。` : "公開版API。") +
        "クリック地点の POINT 交差です。下の全件から選んでください（切り出しではありません）。";
      panel.appendChild(notice);

      status.textContent = items.length
        ? `全${items.length}件を表示（API総件数 ${total}件）。取得URLあり → 被覆が小さい順。`
        : kind === "internal"
          ? "内部版に該当する登録データは見つかりませんでした。"
          : "公開版に該当する登録データは見つかりませんでした。";

      if (!items.length) {
        const emptyReport = build3ddbDiagnosticsReport({
          kind,
          lng,
          lat,
          base,
          credentials,
          featuresPath,
          zipdataPath,
          extras: {
            outcome: "empty_result",
            diagnostics: result.diagnostics || null,
            tip: "HTTP成功だが0件。地点・内部データの有無・権限フィルタを疑う。",
          },
        });
        appendDiagnosticsDownload(panel, emptyReport, "0件の診断ログJSONをダウンロード");
      }

      if (!items.length && kind === "public") {
        const tip = document.createElement("p");
        tip.className = "sheet-hint";
        tip.textContent =
          `湯沢市付近は公開版にデータが無いことがあります。試験用: ${AIST_PUBLIC_TEST_POINT.label}` +
          `（経度 ${AIST_PUBLIC_TEST_POINT.lng}, 緯度 ${AIST_PUBLIC_TEST_POINT.lat}）で再検索してください。`;
        panel.appendChild(tip);
      }

      if (total > items.length) {
        const hint = document.createElement("p");
        hint.className = "sheet-hint";
        hint.textContent = `表示上限 ${limit}件のため、API総件数 ${total}件のうち一部のみです。`;
        panel.appendChild(hint);
      }

      renderAistItemList(panel, items, { kind, base, credentials, zipdataPath });
    } catch (e) {
      status.textContent =
        kind === "internal"
          ? "内部版の検索に失敗しました。この地点の候補は「別タブ検索→JSON貼り付け」で取得できます。"
          : "公開版の検索に失敗しました。診断ログをダウンロードして原因切り分けに使えます。";
      const detail = document.createElement("p");
      detail.className = "sheet-hint";
      detail.textContent = String(e?.message || e);
      panel.appendChild(detail);

      const report = build3ddbDiagnosticsReport({
        kind,
        lng,
        lat,
        base,
        credentials,
        featuresPath,
        zipdataPath,
        error: e,
      });
      const hints = document.createElement("ul");
      hints.className = "sheet-hint aist-3ddb-hints";
      for (const tip of report.troubleshooting_hints || []) {
        const li = document.createElement("li");
        li.textContent = tip;
        hints.appendChild(li);
      }
      panel.appendChild(hints);
      appendDiagnosticsDownload(panel, report, "失敗ログ／診断JSONをダウンロード");

      const inspectUrl =
        report.checks?.manual_inspect_url ||
        build3ddbPointSearchUrl(lng, lat, base, 100, featuresPath);

      if (kind === "internal" && e?.diagnostics?.phase === "fetch") {
        const corsNote = document.createElement("p");
        corsNote.className = "sheet-hint aist-3ddb-hints";
        corsNote.textContent =
          "CORSで地図からの検索ができません。下の手順で「クリック地点」の候補一覧を作れます。" +
          "①別タブで検索JSONを開く → ②全文コピー → ③JSONを貼り付け。";
        panel.appendChild(corsNote);
        appendPointSearchCorsWorkflow(panel, {
          base,
          featuresPath,
          zipdataPath,
          credentials,
          inspectUrl,
          afterEl: triggerBtn,
        });
      } else {
        const inspect = document.createElement("a");
        inspect.className = "aist-3ddb-zip-link";
        inspect.href = inspectUrl;
        inspect.target = "_blank";
        inspect.rel = "noopener noreferrer";
        inspect.textContent = "検索APIの応答を別タブで確認（area=POINT）";
        panel.appendChild(inspect);
      }
    } finally {
      triggerBtn.disabled = false;
    }
  }

  function appendPointSearchCorsWorkflow(panel, cfg) {
    const openBtn = document.createElement("a");
    openBtn.className = "aist-3ddb-zip-link";
    openBtn.href = cfg.inspectUrl;
    openBtn.target = "_blank";
    openBtn.rel = "noopener noreferrer";
    openBtn.textContent = "① この地点の検索結果JSONを別タブで開く";
    panel.appendChild(openBtn);

    const pasteBtn = document.createElement("button");
    pasteBtn.type = "button";
    pasteBtn.className = "aist-3ddb-zip-link";
    pasteBtn.textContent = "③ 別タブのJSONを貼り付けて地点の一覧を表示";
    pasteBtn.addEventListener("click", async () => {
      let text = "";
      try {
        if (navigator.clipboard?.readText) {
          text = await navigator.clipboard.readText();
        }
      } catch {
        /* fall through to prompt */
      }
      if (!text || !text.trim()) {
        text = window.prompt(
          "別タブで開いた検索JSONをすべて貼り付けてください（Ctrl+A → Ctrl+C → ここに貼付）。",
          ""
        );
      }
      if (text === null || !String(text).trim()) return;
      try {
        const parsed = parse3ddbSearchJsonText(text, {
          base: cfg.base,
          zipdataPath: cfg.zipdataPath,
        });
        showParsedPointResults(cfg.afterEl, parsed, cfg, "貼り付けJSON");
      } catch (err) {
        alert("貼り付けJSONの処理に失敗: " + ((err && err.message) || err));
      }
    });
    panel.appendChild(pasteBtn);

    const tip = document.createElement("p");
    tip.className = "sheet-hint";
    tip.textContent =
      "② 別タブで Ctrl+A → Ctrl+C。過去にDLした固定IDではなく、貼り付け一覧のIDを選ぶとクリック地点のデータになります。";
    panel.appendChild(tip);
  }

  const aistPublicBtn = addBtn("AIST 3DDB：公開版を検索", async () => {
    await runAistSearch(aistPublicBtn, {
      kind: "public",
      base: AIST_PUBLIC_BASE,
      credentials: "omit",
    });
  });

  const internalCfg = readInternal3ddbConfig();
  const aistInternalBtn = addBtn(
    internalCfg ? "AIST 3DDB：内部版を検索" : "AIST 3DDB：内部版（未設定）",
    async () => {
      const cfg = readInternal3ddbConfig();
      if (!cfg) {
        alert(
          "内部版は未設定です。「内部版の接続先を設定」で base URL だけ入力してください（リポジトリには保存されません）。"
        );
        return;
      }
      await runAistSearch(aistInternalBtn, cfg);
    },
    { disabled: !internalCfg }
  );

  addBtn("AIST 3DDB：内部版の接続先を設定", () => {
    const cur = readInternal3ddbConfig();
    const base = window.prompt(
      "内部版の base URL（例: https://gsvrg.ipri.aist.go.jp/3ddb）。公開版URLは不可。空でクリア。",
      cur?.base || ""
    );
    if (base === null) return;
    if (!String(base).trim()) {
      clearInternal3ddbConfig();
      alert("内部版設定をクリアしました。シートを開き直してください。");
      return;
    }
    const credIn = window.prompt(
      "credentials（omit / include）。内部でCookieが要る場合は include。",
      cur?.credentials || "include"
    );
    if (credIn === null) return;
    const featuresPath = window.prompt(
      "features パス（通常はそのまま）",
      cur?.featuresPath || AIST_DEFAULT_FEATURES_PATH
    );
    if (featuresPath === null) return;
    const zipdataPath = window.prompt(
      "zipdata パス（{id} 必須。内部は /api/v1/services/zipdata/{id}）",
      cur?.zipdataPath || AIST_INTERNAL_DEFAULT_ZIPDATA_PATH
    );
    if (zipdataPath === null) return;
    try {
      writeInternal3ddbConfig({
        base,
        credentials: credIn,
        featuresPath,
        zipdataPath,
      });
      alert(
        "内部版設定を保存しました（このブラウザの localStorage のみ）。\n" +
          "注意: GitHub Pages からの検索 fetch は CORS で失敗しがちです。" +
          "「この地点の検索JSONを別タブで開く」→貼り付けで、クリック地点の候補を出してください。\n" +
          "シートを開き直してください。"
      );
    } catch (err) {
      alert("設定に失敗: " + ((err && err.message) || err));
    }
  });

  if (internalCfg) {
    addBtn("AIST 3DDB：この地点の検索JSONを別タブで開く", () => {
      const cfg = readInternal3ddbConfig();
      if (!cfg) {
        alert("内部版が未設定です。");
        return;
      }
      const href = build3ddbPointSearchUrl(
        lng,
        lat,
        cfg.base,
        100,
        cfg.featuresPath || AIST_DEFAULT_FEATURES_PATH
      );
      window.open(href, "_blank", "noopener,noreferrer");
    });

    const pastePointBtn = addBtn("AIST 3DDB：地点JSONを貼り付けて一覧表示", async () => {
      const cfg = readInternal3ddbConfig();
      if (!cfg) {
        alert("内部版が未設定です。");
        return;
      }
      let text = "";
      try {
        if (navigator.clipboard?.readText) text = await navigator.clipboard.readText();
      } catch {
        /* prompt fallback */
      }
      if (!text || !text.trim()) {
        text = window.prompt(
          "別タブの検索JSONを貼り付け（このクリック地点の候補一覧になります）。",
          ""
        );
      }
      if (text === null || !String(text).trim()) return;
      try {
        const parsed = parse3ddbSearchJsonText(text, {
          base: cfg.base,
          zipdataPath: cfg.zipdataPath,
        });
        showParsedPointResults(pastePointBtn, parsed, cfg, "貼り付けJSON");
      } catch (err) {
        alert("貼り付けJSONの処理に失敗: " + ((err && err.message) || err));
      }
    });

    addBtn("AIST 3DDB：登録IDを手入力してZIPを開く", () => {
      const cfg = readInternal3ddbConfig();
      if (!cfg) {
        alert("内部版が未設定です。");
        return;
      }
      const raw = window.prompt(
        "登録ID (reg_id)。地点のデータにするなら、先に地点JSON貼り付け一覧からIDを確認してください。空欄のままにしないでください。",
        ""
      );
      if (raw === null || !String(raw).trim()) return;
      try {
        const href = build3ddbZipUrl(String(raw).trim(), cfg.base, cfg.zipdataPath);
        window.open(href, "_blank", "noopener,noreferrer");
      } catch (err) {
        alert("ZIP URL の作成に失敗: " + ((err && err.message) || err));
      }
    });
  }

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
