/**
 * JGD2011 / Japan Plane Rectangular CS X (EPSG:6678) — 第10系.
 * Returns { x, y } where X = northing (m), Y = easting (m) from zone origin.
 *
 * Zone 10 origin: lat 40°N, lon 140°50′E, k0=0.9999, GRS80.
 * (平成14年国土交通省告示第9号 / EPSG:6678)
 */

const A = 6378137.0;
const F = 1 / 298.257222101;
const B = A * (1 - F);
const E2 = (A * A - B * B) / (A * A);
const E_P2 = E2 / (1 - E2);
const K0 = 0.9999;
const PHI0 = (40 * Math.PI) / 180;
/** 第10系原点経度 140°50′E（誤って 140°40′ にすると Y が約14kmずれる） */
const LAM0 = ((140 + 50 / 60) * Math.PI) / 180;

function meridionalDistance(phi) {
  // Series for GRS80 / Bessel-style meridian arc (meters from equator)
  const e2 = E2;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const e8 = e4 * e4;
  const M0 =
    A *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256 - (175 * e8) / 16384) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024 + (105 * e8) / 4096) *
        Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024 + (525 * e8) / 16384) * Math.sin(4 * phi) -
      ((35 * e6) / 3072 + (175 * e8) / 12288) * Math.sin(6 * phi) +
      ((315 * e8) / 131072) * Math.sin(8 * phi));
  return M0;
}

/**
 * @param {number} lng longitude degrees
 * @param {number} lat latitude degrees
 * @returns {{ x: number, y: number } | null}
 */
export function lngLatToPlane10(lng, lat) {
  if (lng == null || lat == null || !Number.isFinite(+lng) || !Number.isFinite(+lat)) {
    return null;
  }
  const phi = (lat * Math.PI) / 180;
  const lam = (lng * Math.PI) / 180;
  const dLam = lam - LAM0;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const N = A / Math.sqrt(1 - E2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = E_P2 * cosPhi * cosPhi;
  const A1 = cosPhi * dLam;
  const A2 = A1 * A1;
  const A3 = A2 * A1;
  const A4 = A2 * A2;
  const A5 = A4 * A1;
  const A6 = A3 * A3;

  const M = meridionalDistance(phi);
  const M0 = meridionalDistance(PHI0);

  const x =
    K0 *
    (M -
      M0 +
      N *
        tanPhi *
        (A2 / 2 +
          (A4 / 24) * (5 - T + 9 * C + 4 * C * C) +
          (A6 / 720) * (61 - 58 * T + T * T + 270 * C - 330 * T * C)));

  const y =
    K0 *
    N *
    (A1 +
      (A3 / 6) * (1 - T + C) +
      (A5 / 120) * (5 - 18 * T + T * T + 72 * C - 58 * E_P2));

  return { x, y };
}

export function formatPlaneXy(xy, digits) {
  if (!xy) return null;
  const d = digits != null ? digits : 3;
  return `${xy.x.toFixed(d)}, ${xy.y.toFixed(d)}`;
}
