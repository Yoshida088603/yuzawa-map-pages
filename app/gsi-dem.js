/** GSI elevation tiles (標高PNG). No API key. */

const TILE_SIZE = 256;
const GSI_XYZ = "https://cyberjapandata.gsi.go.jp/xyz";

/** @typedef {{ id: string, z: number }} DemLayer */

/** Prefer 5m airborne DEM, then nationwide ~10m. */
export const DEM_LAYER_FALLBACKS = Object.freeze([
  Object.freeze({ id: "dem5a_png", z: 15 }),
  Object.freeze({ id: "dem_png", z: 14 }),
]);

/**
 * Official GSI dem_png / dem5a_png encoding.
 * Invalid: R=128, G=0, B=0.
 * @returns {number | null} meters or null if void
 */
export function decodeGsiElevationRgb(r, g, b) {
  const R = r & 255;
  const G = g & 255;
  const B = b & 255;
  if (R === 128 && G === 0 && B === 0) return null;
  const x = R * 65536 + G * 256 + B;
  const h = x < 8388608 ? x * 0.01 : (x - 16777216) * 0.01;
  if (!Number.isFinite(h)) return null;
  return h;
}

/** Web Mercator tile + pixel for lon/lat at zoom. */
export function lonLatToTilePixel(lng, lat, z, tileSize = TILE_SIZE) {
  const n = 2 ** z;
  const latClamped = Math.min(85.05112878, Math.max(-85.05112878, lat));
  const x = ((lng + 180) / 360) * n;
  const latRad = (latClamped * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const px = Math.min(tileSize - 1, Math.max(0, Math.floor((x - tileX) * tileSize)));
  const py = Math.min(tileSize - 1, Math.max(0, Math.floor((y - tileY) * tileSize)));
  return { tileX, tileY, px, py, z };
}

export function buildGsiDemTileUrl(layerId, z, tileX, tileY) {
  return `${GSI_XYZ}/${layerId}/${z}/${tileX}/${tileY}.png`;
}

async function sampleTilePixelRgb(url, px, py) {
  const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`DEMタイル取得失敗 HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas が使えません");
    ctx.drawImage(bitmap, px, py, 1, 1, 0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2] };
  } finally {
    bitmap.close?.();
  }
}

/**
 * @returns {Promise<{ meters: number, source: string, z: number }>}
 */
export async function fetchGsiElevationMeters(lng, lat, layers = DEM_LAYER_FALLBACKS) {
  if (!Number.isFinite(+lng) || !Number.isFinite(+lat)) {
    throw new Error("標高取得の座標が不正です。");
  }
  const errors = [];
  for (const layer of layers) {
    try {
      const { tileX, tileY, px, py, z } = lonLatToTilePixel(+lng, +lat, layer.z);
      const url = buildGsiDemTileUrl(layer.id, z, tileX, tileY);
      const { r, g, b } = await sampleTilePixelRgb(url, px, py);
      const meters = decodeGsiElevationRgb(r, g, b);
      if (meters == null) {
        errors.push(`${layer.id}: 欠測画素`);
        continue;
      }
      return { meters, source: layer.id, z };
    } catch (err) {
      errors.push(`${layer.id}: ${err?.message || err}`);
    }
  }
  throw new Error("地理院DEMの標高を取得できませんでした（" + errors.join(" / ") + "）");
}
