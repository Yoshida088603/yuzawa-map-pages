/** GSI AddressSearch (地名・住所). No API key. Long-term availability is not guaranteed. */

export const GSI_ADDRESS_SEARCH_URL =
  "https://msearch.gsi.go.jp/address-search/AddressSearch";

/**
 * Classify search-box input so lat/lng (and later plane XY) can plug in without rework.
 * @returns {"empty" | "address" | "coords_pending"}
 */
export function classifySearchInput(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "empty";
  // Two numbers separated by comma/space/slash — reserved for upcoming coordinate paste.
  if (/^[-+]?\d+(\.\d+)?\s*[,/\s]\s*[-+]?\d+(\.\d+)?\s*$/.test(text)) {
    return "coords_pending";
  }
  return "address";
}

/**
 * Normalize one AddressSearch GeoJSON Feature.
 * @returns {{ title: string, lng: number, lat: number } | null}
 */
export function normalizeGsiAddressFeature(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = coords[0];
  const lat = coords[1];
  // Reject non-numbers (Number(null)===0 would otherwise pass).
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  const title = String(feature?.properties?.title || "").trim() || "（名称なし）";
  return { title, lng, lat };
}

/**
 * @param {string} q
 * @param {{ request?: typeof fetch }} [opts]
 * @returns {Promise<Array<{ title: string, lng: number, lat: number }>>}
 */
export async function searchGsiAddress(q, { request = fetch } = {}) {
  const query = String(q ?? "").trim();
  if (!query) throw new Error("検索語を入力してください。");
  const url = new URL(GSI_ADDRESS_SEARCH_URL);
  url.searchParams.set("q", query);
  let response;
  try {
    response = await request(url.href, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`地名検索の通信に失敗しました: ${err?.message || err}`);
  }
  if (!response.ok) {
    throw new Error(`地名検索APIがHTTP ${response.status}を返しました。`);
  }
  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`地名検索APIのJSON解析に失敗しました: ${err?.message || err}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("地名検索APIの応答形式が想定と異なります。");
  }
  const out = [];
  const seen = new Set();
  for (const feature of data) {
    const hit = normalizeGsiAddressFeature(feature);
    if (!hit) continue;
    const key = `${hit.title}|${hit.lng}|${hit.lat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}
