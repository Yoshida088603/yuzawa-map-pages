/** Public 3DDB search and raw ZIP download URLs.
 * Search requires the API to permit cross-origin requests from the hosting site.
 * ZIP links are ordinary browser navigations; no credentials are copied or proxied.
 *
 * Official docs still cite gsrt.digiarc.aist.go.jp, but that host 301s to
 * gsvrg.ipri.aist.go.jp. Browser CORS fetch cannot follow a cross-origin redirect,
 * so the client must call the final HTTPS host directly.
 * Do not embed internal hosts, cookies, or tokens here.
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

function checkedBase(base) {
  const url = new URL(String(base));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("3DDBの接続先は認証情報を含まないHTTPSのURLを指定してください。");
  }
  return url.href.replace(/\/$/, "");
}

export function build3ddbPointSearchUrl(lng, lat, base = AIST_PUBLIC_BASE, limit = 100) {
  if (!Number.isFinite(lng) || lng < -180 || lng > 180 ||
      !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("検索座標が不正です。");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 400) {
    throw new Error("検索件数は1～400にしてください。");
  }
  const url = new URL(`${checkedBase(base)}/api/v1/services/ALL/features`);
  url.searchParams.set("area", `POINT(${lng} ${lat})`);
  url.searchParams.set("limit", String(limit));
  return url.href;
}

export function build3ddbZipUrl(regId, base = AIST_PUBLIC_BASE) {
  const id = Number(regId);
  if (!Number.isSafeInteger(id) || id < 1 || String(regId).trim() !== String(id)) {
    throw new Error("登録IDが不正です。");
  }
  return `${checkedBase(base)}/api/v1/zipdata/${id}`;
}

export async function search3ddbAtPoint(lng, lat, { base = AIST_PUBLIC_BASE, limit = 100, request = fetch } = {}) {
  const url = build3ddbPointSearchUrl(lng, lat, base, limit);
  const response = await request(url, {
    headers: { Accept: "application/json" },
    credentials: "omit", // Public stage: never send cookies to 3DDB.
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
    items.push({
      regId: id,
      title: String(props.title || "（タイトルなし）"),
      service: String(props.service_name || ""),
      license: String(props.license || ""),
      downloadable: props.downloadable === true,
    });
  }
  const total = Number(payload.properties?.all);
  return {
    items,
    total: Number.isSafeInteger(total) && total >= 0 ? total : items.length,
    limit,
  };
}

/**
 * Lightweight ZIP endpoint check. Does not download the archive body.
 * Prefer HEAD; fall back to a 1-byte Range GET when HEAD is not allowed.
 */
export async function probe3ddbZip(regId, { base = AIST_PUBLIC_BASE, request = fetch } = {}) {
  const url = build3ddbZipUrl(regId, base);
  const common = { credentials: "omit", cache: "no-store" };
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
