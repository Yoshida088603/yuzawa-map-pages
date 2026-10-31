import { loadDataFile } from "./load.js";
import { LABEL_MIN_ZOOM, LASER_TAG_COLORS } from "./config.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";
import {
  getAllLocalMemos,
  putLocalMemo,
  getLocalMemo,
  newLocalId,
} from "./store.js";
import { queueUpsertMemo, queueDeleteMemo } from "./queue.js";

const state = {
  shipped: null,
  data: null,
  byId: new Map(),
  visible: true,
  map: null,
};

function cloneFeature(f) {
  return {
    type: "Feature",
    id: f.id,
    properties: { ...(f.properties || {}) },
    geometry: f.geometry
      ? {
          type: f.geometry.type,
          coordinates: JSON.parse(JSON.stringify(f.geometry.coordinates)),
        }
      : null,
  };
}

function ensureColors(fc) {
  const feats = (fc && fc.features) || [];
  for (const f of feats) {
    const p = f.properties || {};
    if (!p.color && p.laser_tag) {
      p.color = LASER_TAG_COLORS[p.laser_tag] || "#e8eef2";
    }
    if (!p.name) {
      const tags = [p.laser_tag, p.shinrin_tag].filter(Boolean).join("/");
      const text = (p.text || "").trim();
      p.name = tags && text ? `[${tags}] ${text}` : tags ? `[${tags}]` : text || "メモ";
    }
    if (p.id == null && f.id != null) p.id = f.id;
    f.properties = p;
  }
  return fc;
}

function rebuildName(p) {
  const tags = [p.laser_tag, p.shinrin_tag].filter(Boolean).join("/");
  const text = (p.text || "").trim();
  return tags && text ? `[${tags}] ${text}` : tags ? `[${tags}]` : text || "メモ";
}

function localRecordToFeature(row) {
  return {
    type: "Feature",
    id: row.id,
    properties: { ...(row.properties || {}), id: row.id },
    geometry: row.geometry,
  };
}

function featureToLocalRecord(feature, localStatus) {
  const id = String(feature.properties.id);
  const p = { ...feature.properties, id };
  return {
    id,
    properties: p,
    geometry: feature.geometry,
    local_status: localStatus,
    client_rev: p.client_rev || 1,
    updated_at: p.updated_at || new Date().toISOString(),
  };
}

/** Merge shipped FeatureCollection with IndexedDB local overlays. */
export function mergeShippedAndLocal(shippedFc, localRows) {
  const byId = new Map();
  for (const f of (shippedFc && shippedFc.features) || []) {
    const id = f.properties && f.properties.id;
    if (id == null) continue;
    const c = cloneFeature(f);
    c.properties.local_status = c.properties.local_status || "shipped";
    byId.set(String(id), c);
  }
  for (const row of localRows || []) {
    const id = String(row.id);
    if (row.local_status === "deleted") {
      byId.delete(id);
      continue;
    }
    const feat = localRecordToFeature(row);
    feat.properties.local_status = row.local_status || "dirty";
    feat.properties.client_rev = row.client_rev;
    byId.set(id, feat);
  }
  const features = Array.from(byId.values());
  return ensureColors({ type: "FeatureCollection", features });
}

function rebuildIndex(fc) {
  state.data = fc;
  state.byId.clear();
  for (const f of (fc && fc.features) || []) {
    const id = f.properties && f.properties.id;
    if (id != null) state.byId.set(String(id), f);
  }
}

function pushSource() {
  if (!state.map) return;
  const src = state.map.getSource(SOURCE_IDS.memos);
  if (src && state.data) src.setData(state.data);
}

export async function reloadMerged() {
  let localRows = [];
  try {
    localRows = await getAllLocalMemos();
  } catch (e) {
    console.warn("local memos unavailable", e);
  }
  const merged = mergeShippedAndLocal(state.shipped, localRows);
  rebuildIndex(merged);
  pushSource();
  return state;
}

export async function loadMemos() {
  if (!state.shipped) {
    state.shipped = ensureColors(await loadDataFile("memos"));
  }
  await reloadMerged();
  return state;
}

export function addMemoLayers(map) {
  if (!state.data) throw new Error("memos not loaded");
  state.map = map;
  if (!map.getSource(SOURCE_IDS.memos)) {
    map.addSource(SOURCE_IDS.memos, { type: "geojson", data: state.data });
  }
  if (!map.getLayer(LAYER_IDS.memosHalo)) {
    map.addLayer({
      id: LAYER_IDS.memosHalo,
      type: "circle",
      source: SOURCE_IDS.memos,
      paint: {
        "circle-radius": 12,
        "circle-color": "#ffffff",
        "circle-opacity": 0.9,
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.memosCircle)) {
    map.addLayer({
      id: LAYER_IDS.memosCircle,
      type: "circle",
      source: SOURCE_IDS.memos,
      paint: {
        "circle-radius": 8,
        "circle-color": ["coalesce", ["get", "color"], "#0d9488"],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#0b1216",
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.memosLabel)) {
    map.addLayer({
      id: LAYER_IDS.memosLabel,
      type: "symbol",
      source: SOURCE_IDS.memos,
      minzoom: LABEL_MIN_ZOOM,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ""],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-max-width": 12,
        "text-optional": true,
      },
      paint: {
        "text-color": "#f5f8fa",
        "text-halo-color": "#0b1216",
        "text-halo-width": 1.5,
      },
    });
  }
  setMemosVisible(map, state.visible);
  bringOverlaysFront(map);
}

export function setMemosVisible(map, on) {
  state.visible = !!on;
  const v = state.visible ? "visible" : "none";
  for (const id of [LAYER_IDS.memosHalo, LAYER_IDS.memosCircle, LAYER_IDS.memosLabel]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
  }
}

export function isMemosVisible() {
  return state.visible;
}

export function getMemoById(id) {
  return state.byId.get(String(id)) || null;
}

export function getMergedFeatureCollection() {
  return state.data;
}

export function featureAtPoint(map, point) {
  if (!map.getLayer(LAYER_IDS.memosCircle)) return null;
  const hits = map.queryRenderedFeatures(point, {
    layers: [LAYER_IDS.memosCircle, LAYER_IDS.memosHalo],
  });
  if (!hits.length) return null;
  const id = hits[0].properties && hits[0].properties.id;
  return id != null ? getMemoById(id) : null;
}

export function memoCoords(feature) {
  const c = feature && feature.geometry && feature.geometry.coordinates;
  if (!c) return null;
  return { lng: c[0], lat: c[1] };
}

/**
 * Create or update a memo locally. Preserves stable id.
 * @returns {Promise<Feature>}
 */
export async function upsertMemo({
  id,
  lng,
  lat,
  text,
  laser_tag,
  shinrin_tag,
  color,
  photos,
}) {
  const now = new Date().toISOString();
  const existing = id != null ? getMemoById(id) : null;
  const localPrev = id != null ? await getLocalMemo(id) : null;
  const isNew = !existing && !localPrev;
  const memoId = isNew ? newLocalId("mm") : String(id);
  const prevProps = (existing && existing.properties) || (localPrev && localPrev.properties) || {};
  const client_rev = (localPrev && localPrev.client_rev ? localPrev.client_rev : prevProps.client_rev || 0) + 1;
  const props = {
    ...prevProps,
    id: memoId,
    text: text != null ? text : prevProps.text || "",
    laser_tag: laser_tag != null ? laser_tag : prevProps.laser_tag || "",
    shinrin_tag: shinrin_tag != null ? shinrin_tag : prevProps.shinrin_tag || "",
    color: color || prevProps.color || LASER_TAG_COLORS.LP21 || "#0d9488",
    created_at: prevProps.created_at || now,
    updated_at: now,
    client_rev,
    photos: photos != null ? photos : prevProps.photos || [],
    local_status: isNew ? "draft" : "dirty",
  };
  props.name = rebuildName(props);
  if (props.laser_tag && !color && !prevProps.color) {
    props.color = LASER_TAG_COLORS[props.laser_tag] || props.color;
  }
  const geometry =
    lng != null && lat != null
      ? { type: "Point", coordinates: [Number(lng), Number(lat)] }
      : existing
        ? existing.geometry
        : localPrev
          ? localPrev.geometry
          : null;
  if (!geometry) throw new Error("memo geometry required");
  const feature = { type: "Feature", id: memoId, properties: props, geometry };
  await putLocalMemo(featureToLocalRecord(feature, props.local_status));
  await queueUpsertMemo(feature);
  await reloadMerged();
  return getMemoById(memoId);
}

/** Soft-delete: tombstone in local store + queue. */
export async function removeMemo(id) {
  const memoId = String(id);
  const existing = getMemoById(memoId);
  const now = new Date().toISOString();
  const prev = (existing && existing.properties) || {};
  const client_rev = (prev.client_rev || 0) + 1;
  const tombstone = {
    id: memoId,
    properties: { ...prev, id: memoId, updated_at: now, client_rev, local_status: "deleted" },
    geometry: existing ? existing.geometry : { type: "Point", coordinates: [0, 0] },
    local_status: "deleted",
    client_rev,
    updated_at: now,
  };
  await putLocalMemo(tombstone);
  await queueDeleteMemo(memoId);
  await reloadMerged();
}

export const MEMO_CIRCLE_LAYER = LAYER_IDS.memosCircle;
