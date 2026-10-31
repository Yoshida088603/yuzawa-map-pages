/**
 * Photo attach — resize to long edge ~1600px JPEG, store in IndexedDB.
 */

import { putPhoto, deletePhoto, getPhotosForMemo, getPhoto, newLocalId } from "./store.js";
import { queueAddPhoto, queueRemovePhoto } from "./queue.js";
import { getMemoById, upsertMemo } from "./memos.js";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めません"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG 変換に失敗"))),
      type || "image/jpeg",
      quality
    );
  });
}

export async function compressImageFile(file) {
  const img = await loadImageFromBlob(file);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  return { blob, width: w, height: h };
}

export async function addPhotoToMemo(memoId, file) {
  const memo = getMemoById(memoId);
  if (!memo) throw new Error("メモがありません");
  const { blob, width, height } = await compressImageFile(file);
  const photoId = newLocalId("ph");
  const meta = {
    id: photoId,
    memo_id: String(memoId),
    mime: "image/jpeg",
    width,
    height,
    bytes: blob.size,
    created_at: new Date().toISOString(),
  };
  await putPhoto({ ...meta, blob });
  await queueAddPhoto(meta);
  const photos = Array.isArray(memo.properties.photos)
    ? memo.properties.photos.slice()
    : [];
  photos.push(meta);
  const c = memo.geometry.coordinates;
  await upsertMemo({
    id: memoId,
    lng: c[0],
    lat: c[1],
    text: memo.properties.text,
    laser_tag: memo.properties.laser_tag,
    shinrin_tag: memo.properties.shinrin_tag,
    color: memo.properties.color,
    photos,
  });
  return meta;
}

export async function removePhotoFromMemo(memoId, photoId) {
  const memo = getMemoById(memoId);
  if (!memo) throw new Error("メモがありません");
  await deletePhoto(photoId);
  await queueRemovePhoto(photoId, memoId);
  const photos = (memo.properties.photos || []).filter((p) => String(p.id) !== String(photoId));
  const c = memo.geometry.coordinates;
  await upsertMemo({
    id: memoId,
    lng: c[0],
    lat: c[1],
    text: memo.properties.text,
    laser_tag: memo.properties.laser_tag,
    shinrin_tag: memo.properties.shinrin_tag,
    color: memo.properties.color,
    photos,
  });
}

export async function listMemoPhotos(memoId) {
  return getPhotosForMemo(memoId);
}

export async function photoObjectUrl(photoId) {
  const row = await getPhoto(photoId);
  if (!row || !row.blob) return null;
  return URL.createObjectURL(row.blob);
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
