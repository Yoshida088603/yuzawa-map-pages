/**
 * IndexedDB local store for memos, photos, and sync queue.
 * Does not touch network; merge with shipped data happens in memos.js.
 */

const DB_NAME = "yuzawa-map-local";
const DB_VERSION = 1;
const STORE_MEMOS = "memos";
const STORE_PHOTOS = "photos";
const STORE_QUEUE = "queue";
const STORE_META = "meta";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MEMOS)) {
        db.createObjectStore(STORE_MEMOS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const q = db.createObjectStore(STORE_QUEUE, {
          keyPath: "qid",
          autoIncrement: true,
        });
        q.createIndex("status", "status", { unique: false });
        q.createIndex("entity_id", "entity_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB tx failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB tx aborted"));
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function initStore() {
  await openDb();
  return true;
}

export async function getAllLocalMemos() {
  const db = await openDb();
  const tx = db.transaction(STORE_MEMOS, "readonly");
  const rows = await reqToPromise(tx.objectStore(STORE_MEMOS).getAll());
  await txDone(tx);
  return rows || [];
}

export async function getLocalMemo(id) {
  const db = await openDb();
  const tx = db.transaction(STORE_MEMOS, "readonly");
  const row = await reqToPromise(tx.objectStore(STORE_MEMOS).get(String(id)));
  await txDone(tx);
  return row || null;
}

export async function putLocalMemo(record) {
  if (!record || record.id == null) throw new Error("memo id required");
  const row = { ...record, id: String(record.id) };
  const db = await openDb();
  const tx = db.transaction(STORE_MEMOS, "readwrite");
  tx.objectStore(STORE_MEMOS).put(row);
  await txDone(tx);
  return row;
}

export async function deleteLocalMemoRecord(id) {
  const db = await openDb();
  const tx = db.transaction(STORE_MEMOS, "readwrite");
  tx.objectStore(STORE_MEMOS).delete(String(id));
  await txDone(tx);
}

export async function getPhoto(id) {
  const db = await openDb();
  const tx = db.transaction(STORE_PHOTOS, "readonly");
  const row = await reqToPromise(tx.objectStore(STORE_PHOTOS).get(String(id)));
  await txDone(tx);
  return row || null;
}

export async function getPhotosForMemo(memoId) {
  const all = await getAllPhotos();
  return all.filter((p) => String(p.memo_id) === String(memoId));
}

export async function getAllPhotos() {
  const db = await openDb();
  const tx = db.transaction(STORE_PHOTOS, "readonly");
  const rows = await reqToPromise(tx.objectStore(STORE_PHOTOS).getAll());
  await txDone(tx);
  return rows || [];
}

export async function putPhoto(record) {
  if (!record || record.id == null) throw new Error("photo id required");
  const row = { ...record, id: String(record.id) };
  const db = await openDb();
  const tx = db.transaction(STORE_PHOTOS, "readwrite");
  tx.objectStore(STORE_PHOTOS).put(row);
  await txDone(tx);
  return row;
}

export async function deletePhoto(id) {
  const db = await openDb();
  const tx = db.transaction(STORE_PHOTOS, "readwrite");
  tx.objectStore(STORE_PHOTOS).delete(String(id));
  await txDone(tx);
}

export async function enqueue(item) {
  const row = {
    op: item.op,
    entity_id: String(item.entity_id),
    payload: item.payload != null ? item.payload : null,
    queued_at: item.queued_at || new Date().toISOString(),
    status: item.status || "pending",
  };
  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  const req = tx.objectStore(STORE_QUEUE).add(row);
  const qid = await reqToPromise(req);
  await txDone(tx);
  return { ...row, qid };
}

export async function getQueue(status) {
  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, "readonly");
  const store = tx.objectStore(STORE_QUEUE);
  let rows;
  if (status) {
    rows = await reqToPromise(store.index("status").getAll(status));
  } else {
    rows = await reqToPromise(store.getAll());
  }
  await txDone(tx);
  return rows || [];
}

export async function countPendingQueue() {
  const pending = await getQueue("pending");
  return pending.length;
}

export async function markQueueStatus(qids, status) {
  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  const store = tx.objectStore(STORE_QUEUE);
  for (const qid of qids) {
    const row = await reqToPromise(store.get(qid));
    if (row) {
      row.status = status;
      store.put(row);
    }
  }
  await txDone(tx);
}

export async function getMeta(key) {
  const db = await openDb();
  const tx = db.transaction(STORE_META, "readonly");
  const row = await reqToPromise(tx.objectStore(STORE_META).get(key));
  await txDone(tx);
  return row ? row.value : null;
}

export async function setMeta(key, value) {
  const db = await openDb();
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put({ key, value });
  await txDone(tx);
}

/** Generate a short stable-ish client id (no crypto dependency). */
export function newLocalId(prefix) {
  const p = prefix || "loc";
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `${p}${t}${r}`;
}
