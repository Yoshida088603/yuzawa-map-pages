/** Public 3DDB search and raw ZIP download URLs.
 * Search requires the API to permit cross-origin requests from the hosting site.
 * ZIP links are ordinary browser navigations; no credentials are copied or proxied.
 *
 * Official docs still cite gsrt.digiarc.aist.go.jp, but that host 301s to
 * gsvrg.ipri.aist.go.jp. Browser CORS fetch cannot follow a cross-origin redirect,
 * so the client must call the final HTTPS host directly.
 * Do not embed internal hosts, cookies, or tokens here.
 *
 * Search uses area=POINT(lon lat) — not a map view bounding box.
 * Hits are registration datasets whose coverage contains that point; some
 * coverages (e.g. city-wide CITYGML) are kilometers across.
 */
export const AIST_PUBLIC_BASE = "https://gsvrg.ipri.aist.go.jp/3ddb_demo";
/** Documented (pre-redirect) host — kept for probe scripts / docs comparison only. */
export const AIST_PUBLIC_BASE_DOCUMENTED = "https://gsrt.digiarc.aist.go.jp/3ddb_demo";

/** Known public coverage for acceptance when Yuzawa has no hits. */
export const AIST_PUBLIC_TEST_POINT = {
  lng: 140.135,
  lat: 36.062,
  label: "産総研つくばセンター付近",
};

/** localStorage keys for internal endpoint overrides (never commit values). */
export const AIST_INTERNAL_LS_KEYS = {
  base: "aist3ddb.internal.base",
  credentials: "aist3ddb.internal.credentials",
  featuresPath: "aist3ddb.internal.featuresPath",
  zipdataPath: "aist3ddb.internal.zipdataPath",
};

export const AIST_DEFAULT_FEATURES_PATH = "/api/v1/services/ALL/features";
export const AIST_DEFAULT_ZIPDATA_PATH = "/api/v1/zipdata/{id}";

function checkedBase(base) {
  const url = new URL(String(base));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("3DDBの接続先は認証情報を含まないHTTPSのURLを指定してください。");
  }
  return url.href.replace(/\/$/, "");
}

function normalizeCredentials(value, fallback = "omit") {
  const v = String(value || fallback).toLowerCase();
  if (v !== "omit" && v !== "include") {
    throw new Error("credentials は omit または include にしてください。");
  }
  return v;
}

function normalizeFeaturesPath(path) {
  const raw = String(path || AIST_DEFAULT_FEATURES_PATH).trim() || AIST_DEFAULT_FEATURES_PATH;
  if (!raw.startsWith("/") || raw.includes("://") || raw.includes("?")) {
    throw new Error("featuresPath は / から始まるパスにしてください。");
  }
  return raw.replace(/\/$/, "") || AIST_DEFAULT_FEATURES_PATH;
}

function normalizeZipdataPath(path) {
  const raw = String(path || AIST_DEFAULT_ZIPDATA_PATH).trim() || AIST_DEFAULT_ZIPDATA_PATH;
  if (!raw.startsWith("/") || raw.includes("://") || !raw.includes("{id}")) {
    throw new Error("zipdataPath は / から始まり {id} を含むパスにしてください。");
  }
  return raw;
}

/** Read internal overrides from localStorage. Missing/invalid base => null. */
export function readInternal3ddbConfig(storage = globalThis.localStorage) {
  if (!storage) return null;
  let baseRaw = "";
  try {
    baseRaw = String(storage.getItem(AIST_INTERNAL_LS_KEYS.base) || "").trim();
  } catch {
    return null;
  }
  if (!baseRaw) return null;
  let base;
  try {
    base = checkedBase(baseRaw);
  } catch {
    return null;
  }
  if (base === AIST_PUBLIC_BASE || base === AIST_PUBLIC_BASE_DOCUMENTED) {
    // Public hosts stay on the public button; internal config must be a different base.
    return null;
  }
  let credentials = "include";
  let featuresPath = AIST_DEFAULT_FEATURES_PATH;
  let zipdataPath = AIST_DEFAULT_ZIPDATA_PATH;
  try {
    credentials = normalizeCredentials(
      storage.getItem(AIST_INTERNAL_LS_KEYS.credentials) || "include",
      "include"
    );
    const fp = storage.getItem(AIST_INTERNAL_LS_KEYS.featuresPath);
    const zp = storage.getItem(AIST_INTERNAL_LS_KEYS.zipdataPath);
    if (fp) featuresPath = normalizeFeaturesPath(fp);
    if (zp) zipdataPath = normalizeZipdataPath(zp);
  } catch {
    return null;
  }
  return { base, credentials, featuresPath, zipdataPath, kind: "internal" };
}

/** Persist internal overrides. Does not store tokens. */
export function writeInternal3ddbConfig(partial, storage = globalThis.localStorage) {
  if (!storage) throw new Error("localStorage が使えません。");
  const base = checkedBase(partial.base);
  if (base === AIST_PUBLIC_BASE || base === AIST_PUBLIC_BASE_DOCUMENTED) {
    throw new Error("公開版URLは内部設定に入れず、公開版ボタンを使ってください。");
  }
  const credentials = normalizeCredentials(partial.credentials ?? "include", "include");
  const featuresPath = normalizeFeaturesPath(partial.featuresPath);
  const zipdataPath = normalizeZipdataPath(partial.zipdataPath);
  storage.setItem(AIST_INTERNAL_LS_KEYS.base, base);
  storage.setItem(AIST_INTERNAL_LS_KEYS.credentials, credentials);
  storage.setItem(AIST_INTERNAL_LS_KEYS.featuresPath, featuresPath);
  storage.setItem(AIST_INTERNAL_LS_KEYS.zipdataPath, zipdataPath);
  return { base, credentials, featuresPath, zipdataPath, kind: "internal" };
}

export function clearInternal3ddbConfig(storage = globalThis.localStorage) {
  if (!storage) return;
  for (const key of Object.values(AIST_INTERNAL_LS_KEYS)) {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function pushCoord(out, p) {
  if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
    out.push([p[0], p[1]]);
  }
}

/** Collect lon/lat pairs from 3DDB feature geometries (non-standard GeoJSON). */
export function collectFeatureLonLats(feature) {
  const out = [];
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      if (node.length >= 2 && typeof node[0] === "number") {
        pushCoord(out, node);
        return;
      }
      for (const child of node) walk(child);
      return;
    }
    if (typeof node !== "object") return;
    if (Array.isArray(node.coordinates)) walk(node.coordinates);
    if (Array.isArray(node.geometries)) {
      for (const g of node.geometries) walk(g);
    }
  }
  walk(feature?.geometries);
  walk(feature?.geometry);
  return out;
}

/** Approximate WGS84 bbox size in meters (planar estimate). */
export function estimateCoverageMeters(lonLats) {
  if (!lonLats?.length) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of lonLats) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  const midLat = (minLat + maxLat) / 2;
  const widthM = (maxLon - minLon) * 111320 * Math.cos((midLat * Math.PI) / 180);
  const heightM = (maxLat - minLat) * 110540;
  return {
    minLon,
    minLat,
    maxLon,
    maxLat,
    widthM: Math.max(0, widthM),
    heightM: Math.max(0, heightM),
    areaM2: Math.max(0, widthM) * Math.max(0, heightM),
  };
}

export function formatCoverageLabel(coverage) {
  if (!coverage) return "被覆範囲不明";
  const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}km` : `${Math.round(m)}m`);
  return `被覆 約${fmt(coverage.widthM)} × ${fmt(coverage.heightM)}`;
}

function isHttpsUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Absolute https URL for a relative or absolute 3DDB path. */
export function absolutize3ddbUrl(pathOrUrl, base = AIST_PUBLIC_BASE) {
  if (!pathOrUrl) return null;
  const raw = String(pathOrUrl).trim();
  if (!raw) return null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      return isHttpsUrl(raw) ? raw : null;
    }
    const root = new URL(checkedBase(base));
    const abs = new URL(raw.startsWith("/") ? raw : `/${raw}`, root.origin);
    return abs.protocol === "https:" ? abs.href : null;
  } catch {
    return null;
  }
}

/**
 * Prefer list-provided external_links (archive ZIP / COPC) over inventing zipdata URLs.
 * Live public API returns `external_links[]`; older docs used singular external_link.
 */
export function extractExternalLinks(props, base = AIST_PUBLIC_BASE) {
  const out = [];
  const seen = new Set();
  const push = (href, type) => {
    const url = absolutize3ddbUrl(href, base);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({
      url,
      type: String(type || "link"),
      label:
        type === "archive"
          ? "元データZIP（外部リンク）"
          : type === "copc"
            ? "COPC点群"
            : type === "3dtiles"
              ? "3D Tiles（表示用）"
              : "外部リンク",
    });
  };

  const list = Array.isArray(props?.external_links) ? props.external_links : [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    push(row.external_link, row.external_link_type);
  }
  // Legacy singular fields from older API docs.
  if (props?.external_link) push(props.external_link, props.external_link_type || "link");

  const tiles = absolutize3ddbUrl(props?.["3dtiles_url"], base);
  if (tiles) push(tiles, "3dtiles");

  return out;
}

function hasArchiveLink(item) {
  return (item.externalLinks || []).some((l) => l.type === "archive" || l.type === "copc");
}

function compareItems(a, b) {
  const aExt = hasArchiveLink(a);
  const bExt = hasArchiveLink(b);
  if (aExt !== bExt) return aExt ? -1 : 1;
  if (a.downloadable !== b.downloadable) return a.downloadable ? -1 : 1;
  const aa = a.coverage?.areaM2;
  const ba = b.coverage?.areaM2;
  const aKnown = Number.isFinite(aa);
  const bKnown = Number.isFinite(ba);
  if (aKnown && bKnown && aa !== ba) return aa - ba;
  if (aKnown !== bKnown) return aKnown ? -1 : 1;
  return a.regId - b.regId;
}

export function build3ddbPointSearchUrl(
  lng,
  lat,
  base = AIST_PUBLIC_BASE,
  limit = 100,
  featuresPath = AIST_DEFAULT_FEATURES_PATH
) {
  if (!Number.isFinite(lng) || lng < -180 || lng > 180 ||
      !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("検索座標が不正です。");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 400) {
    throw new Error("検索件数は1～400にしてください。");
  }
  const root = checkedBase(base);
  const path = normalizeFeaturesPath(featuresPath);
  const url = new URL(`${root}${path}`);
  // Point-in-coverage search. Not a map-view bounding box.
  url.searchParams.set("area", `POINT(${lng} ${lat})`);
  url.searchParams.set("limit", String(limit));
  return url.href;
}

export function build3ddbZipUrl(
  regId,
  base = AIST_PUBLIC_BASE,
  zipdataPath = AIST_DEFAULT_ZIPDATA_PATH
) {
  const id = Number(regId);
  if (!Number.isSafeInteger(id) || id < 1 || String(regId).trim() !== String(id)) {
    throw new Error("登録IDが不正です。");
  }
  const path = normalizeZipdataPath(zipdataPath).replaceAll("{id}", String(id));
  return `${checkedBase(base)}${path}`;
}

export async function search3ddbAtPoint(
  lng,
  lat,
  {
    base = AIST_PUBLIC_BASE,
    limit = 100,
    request = fetch,
    credentials = "omit",
    featuresPath = AIST_DEFAULT_FEATURES_PATH,
    zipdataPath = AIST_DEFAULT_ZIPDATA_PATH,
  } = {}
) {
  const cred = normalizeCredentials(credentials, "omit");
  const url = build3ddbPointSearchUrl(lng, lat, base, limit, featuresPath);
  const response = await request(url, {
    headers: { Accept: "application/json" },
    credentials: cred,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`3DDB検索APIがHTTP ${response.status}を返しました。`);
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.features)) {
    throw new Error("3DDB検索APIの応答形式が想定と異なります。");
  }
  const items = [];
  const seen = new Set();
  for (const feature of payload.features) {
    const props = feature?.properties;
    if (!props) continue;
    const id = Number(props.reg_id);
    if (!Number.isSafeInteger(id) || id < 1 || seen.has(id)) continue;
    seen.add(id);
    const coverage = estimateCoverageMeters(collectFeatureLonLats(feature));
    const externalLinks = extractExternalLinks(props, base);
    items.push({
      regId: id,
      title: String(props.title || "（タイトルなし）"),
      service: String(props.service_name || ""),
      license: String(props.license || ""),
      downloadable: props.downloadable === true,
      coverage,
      coverageLabel: formatCoverageLabel(coverage),
      externalLinks,
      // Prefer external_links when present; zipdata is fallback / internal.
      zipdataUrl: build3ddbZipUrl(id, base, zipdataPath),
    });
  }
  items.sort(compareItems);
  const total = Number(payload.properties?.all);
  return {
    items,
    total: Number.isSafeInteger(total) && total >= 0 ? total : items.length,
    limit,
    searchMode: "POINT",
    base: checkedBase(base),
    credentials: cred,
  };
}

/**
 * Lightweight ZIP endpoint check. Does not download the archive body.
 * Prefer HEAD; fall back to a 1-byte Range GET when HEAD is not allowed.
 */
export async function probe3ddbZip(
  regId,
  {
    base = AIST_PUBLIC_BASE,
    request = fetch,
    credentials = "omit",
    zipdataPath = AIST_DEFAULT_ZIPDATA_PATH,
  } = {}
) {
  const cred = normalizeCredentials(credentials, "omit");
  const url = build3ddbZipUrl(regId, base, zipdataPath);
  const common = { credentials: cred, cache: "no-store" };
  let response = await request(url, { method: "HEAD", ...common });
  if (response.status === 405 || response.status === 501) {
    response = await request(url, {
      method: "GET",
      headers: { Range: "bytes=0-0", Accept: "application/zip,*/*" },
      ...common,
    });
  }
  const ok = response.ok || response.status === 206;
  let contentType = "";
  try {
    contentType = response.headers?.get?.("content-type") || "";
  } catch {
    contentType = "";
  }
  return {
    url,
    ok,
    status: response.status,
    contentType,
    reason: ok
      ? null
      : `元データZIPの取得に失敗しました（HTTP ${response.status}）。公開版サーバ側でZIPが提供されていない可能性があります。`,
  };
}
