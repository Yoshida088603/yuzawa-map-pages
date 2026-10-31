/**
 * Export local pending memos + photos as a single JSON bundle for PC merge.
 */

import { getAllLocalMemos, getAllPhotos } from "./store.js";
import { listPending, markExported } from "./queue.js";
import { loadManifest } from "./load.js";
import { blobToDataUrl } from "./photos.js";

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function buildExportBundle() {
  const pending = await listPending();
  const localMemos = await getAllLocalMemos();
  const photos = await getAllPhotos();
  let manifestVersion = "0";
  try {
    const m = await loadManifest();
    manifestVersion = m.version || "0";
  } catch (_) {}

  const features = [];
  for (const row of localMemos) {
    features.push({
      type: "Feature",
      id: row.id,
      properties: {
        ...(row.properties || {}),
        id: row.id,
        local_status: row.local_status,
        client_rev: row.client_rev,
      },
      geometry: row.geometry,
    });
  }

  const photoPayloads = [];
  for (const p of photos) {
    if (!p.blob) continue;
    const dataUrl = await blobToDataUrl(p.blob);
    photoPayloads.push({
      id: p.id,
      memo_id: p.memo_id,
      mime: p.mime || "image/jpeg",
      width: p.width,
      height: p.height,
      bytes: p.bytes,
      created_at: p.created_at,
      data_url: dataUrl,
    });
  }

  const bundle = {
    format: "yuzawa-memo-bundle-v1",
    exported_at: new Date().toISOString(),
    base_manifest_version: manifestVersion,
    pending_ops: pending.map((q) => ({
      qid: q.qid,
      op: q.op,
      entity_id: q.entity_id,
      queued_at: q.queued_at,
      status: q.status,
    })),
    memos_patch: { type: "FeatureCollection", features },
    photos: photoPayloads,
  };
  return { bundle, pendingQids: pending.map((q) => q.qid) };
}

export async function exportLocalBundle() {
  const { bundle, pendingQids } = await buildExportBundle();
  if (!bundle.memos_patch.features.length && !bundle.photos.length) {
    return { ok: false, reason: "empty" };
  }
  const text = JSON.stringify(bundle, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const stamp = bundle.exported_at.replace(/[:.]/g, "-").slice(0, 19);
  const filename = `yuzawa-memo-bundle-${stamp}.json`;

  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: "application/json" });
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "湯沢メモ書き出し" });
        if (pendingQids.length) await markExported(pendingQids);
        return { ok: true, filename, shared: true };
      }
    } catch (e) {
      if (e && e.name === "AbortError") return { ok: false, reason: "abort" };
    }
  }

  downloadBlob(filename, blob);
  if (pendingQids.length) await markExported(pendingQids);
  return { ok: true, filename, shared: false };
}

export async function pendingSummary() {
  const pending = await listPending();
  const local = await getAllLocalMemos();
  const dirty = local.filter((r) => r.local_status && r.local_status !== "shipped");
  return {
    pendingOps: pending.length,
    localMemos: dirty.length,
  };
}
