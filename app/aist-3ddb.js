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

const SAFE_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "cache-control",
  "date",
  "server",
  "vary",
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-expose-headers",
  "www-authenticate",
];

/** Error with a redacted troubleshooting payload (no cookies/tokens). */
export class Aist3ddbError extends Error {
  constructor(message, diagnostics = {}) {
    super(message);
    this.name = "Aist3ddbError";
    this.diagnostics = diagnostics;
  }
}

export function collectSafeResponseHeaders(response) {
  const out = {};
  if (!response?.headers?.get) return out;
  for (const name of SAFE_RESPONSE_HEADERS) {
    try {
      const v = response.headers.get(name);
      if (v != null && v !== "") out[name] = v;
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function previewBodyText(text, max = 2000) {
  const raw = String(text ?? "");
  const clipped = raw.length > max ? `${raw.slice(0, max)}…[truncated ${raw.length} chars]` : raw;
  // Soft-redact obvious secrets if a gateway echoed them.
  return clipped
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/(cookie\s*[:=]\s*)([^\n]+)/gi, "$1[REDACTED]")
    .replace(/(bearer\s+)[a-z0-9._\-]+/gi, "$1[REDACTED]");
}

function classifyFailureHint({ phase, status, networkErrorName, networkErrorMessage }) {
  const msg = String(networkErrorMessage || "").toLowerCase();
  if (phase === "fetch" || networkErrorName === "TypeError") {
    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed")) {
      return [
        "Failed to fetch: ブラウザJSからは HTTP ステータスも ACAO も読めません（CORS遮断とVPN/DNS失敗が区別できない）。",
        "checks.manual_inspect_url を別タブで開き、ステータスと Access-Control-Allow-Origin を確認してください。",
        "checks の page_origin と api_origin が違う場合、サーバ側でその Origin（または *）を許可する必要があります。",
        "VPN未接続・証明書・混合コンテンツ（httpsページ→http API）も同症状になります。",
        "内部版で Cookie が必要なら credentials=include と、ACAO が * ではなく具体 Origin + Allow-Credentials かを確認してください。",
      ];
    }
  }
  if (status === 401 || status === 403) {
    return ["認証/権限エラーです。ログイン状態・Cookie・トークン・許可グループを確認してください。"];
  }
  if (status === 404) {
    return ["パスまたは base が違う可能性が高いです（features-path / ホスト）。checks.manual_inspect_url を確認。"];
  }
  if (status === 301 || status === 302 || status === 307 || status === 308) {
    return ["リダイレクトが返っています。公開版と同様、最終ホストを base に直接指定してください。"];
  }
  if (status >= 500) {
    return ["サーバ側エラーです。内部3DDBの稼働状況を確認してください。"];
  }
  if (phase === "json") {
    return ["HTTPは成功したが JSON 形式が想定外です。APIパスやプロキシのHTMLエラーページ混入を疑ってください。"];
  }
  return ["ログJSONの request / response / checks を確認し、probe_aist_3ddb_internal.py でも同じ base を試してください。"];
}

/** Explicit checklist for base / path / CORS / VPN-related triage. */
export function build3ddbChecks({
  kind,
  lng,
  lat,
  base,
  credentials,
  featuresPath,
  zipdataPath,
  limit = 100,
  phase = null,
  responseHeaders = null,
}) {
  let apiOrigin = null;
  let manualInspectUrl = null;
  let mixedContent = null;
  let baseParseOk = true;
  let baseParseError = null;
  try {
    manualInspectUrl = build3ddbPointSearchUrl(
      lng,
      lat,
      base,
      Number.isInteger(limit) ? limit : 100,
      featuresPath
    );
    apiOrigin = new URL(manualInspectUrl).origin;
  } catch (err) {
    baseParseOk = false;
    baseParseError = String(err?.message || err);
  }

  const pageOrigin =
    typeof location !== "undefined" && location?.origin ? location.origin : null;
  const pageProtocol =
    typeof location !== "undefined" && location?.protocol ? location.protocol : null;
  if (apiOrigin && pageProtocol) {
    try {
      mixedContent = pageProtocol === "https:" && new URL(apiOrigin).protocol === "http:";
    } catch {
      mixedContent = null;
    }
  }

  const acao = responseHeaders?.["access-control-allow-origin"] || null;
  const acac = responseHeaders?.["access-control-allow-credentials"] || null;

  return {
    kind: kind || null,
    base: base || null,
    base_parse_ok: baseParseOk,
    base_parse_error: baseParseError,
    features_path: featuresPath || null,
    zipdata_path: zipdataPath || null,
    credentials_mode: credentials || null,
    credentials_note:
      credentials === "include"
        ? "Cookie 送信を試みます。サーバは ACAO=* ではなく具体 Origin + Allow-Credentials: true が必要なことが多いです。"
        : "Cookie は送りません（公開版既定）。",
    page_origin: pageOrigin,
    api_origin: apiOrigin,
    cross_origin: Boolean(pageOrigin && apiOrigin && pageOrigin !== apiOrigin),
    mixed_content_risk: mixedContent,
    manual_inspect_url: manualInspectUrl,
    manual_inspect_note:
      "画面の「検索APIの応答を別タブで確認」と同じURL。別タブなら CORS を受けずにHTTP応答を見られます。",
    cors: {
      observed_acao: acao,
      observed_allow_credentials: acac,
      note:
        phase === "fetch"
          ? "Failed to fetch では ACAO を観測できません。別タブまたはサーバ設定で確認してください。"
          : "応答ヘッダから読めた範囲のみ記録（読めない場合は null）。",
    },
    vpn_auth: {
      detectable_from_browser: false,
      note: "VPN接続有無や社内認証の成功はJSから直接判定できません。Failed to fetch / 401/403 の状況証拠として扱ってください。",
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
    },
    path: {
      features_path: featuresPath || null,
      expected_default_features_path: AIST_DEFAULT_FEATURES_PATH,
      features_path_is_default: (featuresPath || AIST_DEFAULT_FEATURES_PATH) === AIST_DEFAULT_FEATURES_PATH,
      zipdata_path: zipdataPath || null,
      expected_default_zipdata_path: AIST_DEFAULT_ZIPDATA_PATH,
    },
  };
}

function browserContext() {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const loc = typeof location !== "undefined" ? location : null;
  return {
    href: loc?.href || null,
    origin: loc?.origin || null,
    online: nav?.onLine ?? null,
    userAgent: nav?.userAgent || null,
    language: nav?.language || null,
    timezone: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return null;
      }
    })(),
  };
}

/**
 * Build a downloadable troubleshooting report. Never includes Cookie/Authorization values.
 */
export function build3ddbDiagnosticsReport({
  kind = "public",
  lng,
  lat,
  base,
  credentials = "omit",
  featuresPath = AIST_DEFAULT_FEATURES_PATH,
  zipdataPath = AIST_DEFAULT_ZIPDATA_PATH,
  limit = 100,
  error = null,
  extras = null,
} = {}) {
  const fromError = error?.diagnostics && typeof error.diagnostics === "object" ? error.diagnostics : {};
  const resolvedBase = base || fromError.request?.base || null;
  const resolvedCred = credentials || fromError.request?.credentials || "omit";
  const resolvedFeatures = featuresPath || fromError.request?.featuresPath || AIST_DEFAULT_FEATURES_PATH;
  const resolvedZip = zipdataPath || fromError.request?.zipdataPath || AIST_DEFAULT_ZIPDATA_PATH;
  const resolvedLimit = limit || fromError.request?.limit || 100;
  const phase = fromError.phase || null;
  const checks = build3ddbChecks({
    kind,
    lng,
    lat,
    base: resolvedBase,
    credentials: resolvedCred,
    featuresPath: resolvedFeatures,
    zipdataPath: resolvedZip,
    limit: resolvedLimit,
    phase,
    responseHeaders: fromError.response?.headers || null,
  });
  const report = {
    generated_at_utc: new Date().toISOString(),
    app: "yuzawa-map-pages",
    feature: "aist-3ddb-search",
    kind,
    point: { lng, lat, wkt: `POINT(${lng} ${lat})` },
    config: {
      base: resolvedBase,
      credentials: resolvedCred,
      featuresPath: resolvedFeatures,
      zipdataPath: resolvedZip,
      limit: resolvedLimit,
      note: "Secrets (Cookie/Authorization values) are never included.",
    },
    // Explicit triage block for the on-screen guidance (base / VPN / CORS / path / 別タブURL).
    checks,
    browser: browserContext(),
    error: {
      name: error?.name || null,
      message: error?.message || String(error || ""),
    },
    ...fromError,
    troubleshooting_hints:
      fromError.troubleshooting_hints ||
      classifyFailureHint({
        phase,
        status: fromError.response?.status,
        networkErrorName: error?.name,
        networkErrorMessage: error?.message,
      }),
  };
  // Ensure checks survive even if fromError somehow had a checks key.
  report.checks = checks;
  if (extras && typeof extras === "object") {
    report.extras = extras;
  }
  return report;
}

export function download3ddbDiagnosticsReport(report, filename) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = filename || `aist-3ddb-diagnostics-${report.kind || "unknown"}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(report, null, 2) + "\n"], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
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
  const started = Date.now();
  const cred = normalizeCredentials(credentials, "omit");
  const root = checkedBase(base);
  const fpath = normalizeFeaturesPath(featuresPath);
  const zpath = normalizeZipdataPath(zipdataPath);
  const url = build3ddbPointSearchUrl(lng, lat, root, limit, fpath);
  const requestMeta = {
    method: "GET",
    url,
    base: root,
    featuresPath: fpath,
    zipdataPath: zpath,
    credentials: cred,
    limit,
    headerNames: ["Accept"],
    cache: "no-store",
  };

  let response;
  try {
    response = await request(url, {
      headers: { Accept: "application/json" },
      credentials: cred,
      cache: "no-store",
    });
  } catch (err) {
    throw new Aist3ddbError(`3DDB検索の通信に失敗しました: ${err?.message || err}`, {
      phase: "fetch",
      elapsed_ms: Date.now() - started,
      request: requestMeta,
      network_error: {
        name: err?.name || null,
        message: String(err?.message || err),
      },
      troubleshooting_hints: classifyFailureHint({
        phase: "fetch",
        networkErrorName: err?.name,
        networkErrorMessage: err?.message,
      }),
    });
  }

  const headerBag = collectSafeResponseHeaders(response);
  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch (err) {
    throw new Aist3ddbError(`3DDB検索の応答本文読み取りに失敗しました: ${err?.message || err}`, {
      phase: "body",
      elapsed_ms: Date.now() - started,
      request: requestMeta,
      response: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText || "",
        type: response.type || null,
        url: response.url || url,
        headers: headerBag,
      },
      troubleshooting_hints: classifyFailureHint({
        phase: "body",
        status: response.status,
        networkErrorMessage: err?.message,
      }),
    });
  }

  const bodyPreview = previewBodyText(bodyText);
  if (!response.ok) {
    throw new Aist3ddbError(`3DDB検索APIがHTTP ${response.status}を返しました。`, {
      phase: "http",
      elapsed_ms: Date.now() - started,
      request: requestMeta,
      response: {
        ok: false,
        status: response.status,
        statusText: response.statusText || "",
        type: response.type || null,
        url: response.url || url,
        headers: headerBag,
        body_preview: bodyPreview,
      },
      troubleshooting_hints: classifyFailureHint({
        phase: "http",
        status: response.status,
      }),
    });
  }

  let payload;
  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch (err) {
    throw new Aist3ddbError(`3DDB検索APIのJSON解析に失敗しました: ${err?.message || err}`, {
      phase: "json",
      elapsed_ms: Date.now() - started,
      request: requestMeta,
      response: {
        ok: true,
        status: response.status,
        statusText: response.statusText || "",
        type: response.type || null,
        url: response.url || url,
        headers: headerBag,
        body_preview: bodyPreview,
      },
      troubleshooting_hints: classifyFailureHint({ phase: "json", status: response.status }),
    });
  }

  if (!payload || !Array.isArray(payload.features)) {
    throw new Aist3ddbError("3DDB検索APIの応答形式が想定と異なります。", {
      phase: "schema",
      elapsed_ms: Date.now() - started,
      request: requestMeta,
      response: {
        ok: true,
        status: response.status,
        headers: headerBag,
        body_preview: bodyPreview,
        top_level_keys: payload && typeof payload === "object" ? Object.keys(payload) : [],
      },
      troubleshooting_hints: classifyFailureHint({ phase: "json", status: response.status }),
    });
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
    const externalLinks = extractExternalLinks(props, root);
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
      zipdataUrl: build3ddbZipUrl(id, root, zpath),
    });
  }
  items.sort(compareItems);
  const total = Number(payload.properties?.all);
  return {
    items,
    total: Number.isSafeInteger(total) && total >= 0 ? total : items.length,
    limit,
    searchMode: "POINT",
    base: root,
    credentials: cred,
    diagnostics: {
      phase: "ok",
      elapsed_ms: Date.now() - started,
      request: requestMeta,
      response: {
        ok: true,
        status: response.status,
        headers: headerBag,
        feature_count: payload.features.length,
        api_total: payload.properties?.all ?? null,
      },
    },
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
