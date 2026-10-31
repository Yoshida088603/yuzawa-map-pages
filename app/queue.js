/**
 * Sync queue helpers on top of store.js.
 * Auto-upload is intentionally NOT implemented — export is manual.
 */

import {
  enqueue,
  getQueue,
  countPendingQueue,
  markQueueStatus,
} from "./store.js";

export async function queueUpsertMemo(feature) {
  const id = feature && feature.properties && feature.properties.id;
  if (id == null) throw new Error("queue upsert requires memo id");
  return enqueue({
    op: "upsert_memo",
    entity_id: id,
    payload: feature,
    status: "pending",
  });
}

export async function queueDeleteMemo(id) {
  return enqueue({
    op: "delete_memo",
    entity_id: id,
    payload: { id: String(id) },
    status: "pending",
  });
}

export async function queueAddPhoto(photoMeta) {
  return enqueue({
    op: "add_photo",
    entity_id: photoMeta.id,
    payload: photoMeta,
    status: "pending",
  });
}

export async function queueRemovePhoto(photoId, memoId) {
  return enqueue({
    op: "remove_photo",
    entity_id: photoId,
    payload: { id: String(photoId), memo_id: String(memoId) },
    status: "pending",
  });
}

export async function pendingCount() {
  return countPendingQueue();
}

export async function listPending() {
  return getQueue("pending");
}

export async function markExported(qids) {
  return markQueueStatus(qids, "exported");
}
