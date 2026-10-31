/** CloudCompare-friendly click-point CSV (Label,X,Y,Z) with DEM elevation. */

import { lngLatToPlane10 } from "./plane.js";
import { fetchGsiElevationMeters } from "./gsi-dem.js";

export const AXIS_MODE_LS_KEY = "aist3ddb.pointCsv.axisMode";

/** @typedef {"cc" | "plane"} AxisMode */

export function readAxisMode(storage = globalThis.localStorage) {
  try {
    const v = String(storage?.getItem(AXIS_MODE_LS_KEY) || "").trim();
    if (v === "plane" || v === "cc") return v;
  } catch {
    /* ignore */
  }
  return "cc";
}

export function writeAxisMode(mode, storage = globalThis.localStorage) {
  const m = mode === "plane" ? "plane" : "cc";
  try {
    storage?.setItem(AXIS_MODE_LS_KEY, m);
  } catch {
    /* ignore */
  }
  return m;
}

/**
 * plane.js: x=northing, y=easting.
 * cc: X=easting, Y=northing (CloudCompare / CAD common).
 * plane: X=northing, Y=easting (平面直角 native).
 */
export function planeToCsvXY(planeXy, mode = "cc") {
  if (!planeXy || !Number.isFinite(planeXy.x) || !Number.isFinite(planeXy.y)) {
    throw new Error("平面直角座標を計算できません。");
  }
  if (mode === "plane") {
    return { x: planeXy.x, y: planeXy.y };
  }
  return { x: planeXy.y, y: planeXy.x };
}

export function sanitizeCsvLabel(label) {
  const s = String(label ?? "point")
    .replace(/[\r\n,]+/g, "")
    .trim();
  return s || "point";
}

export function buildCloudCompareCsv({ label, x, y, z }, { xyDigits = 3, zDigits = 3 } = {}) {
  const lab = sanitizeCsvLabel(label);
  const xs = Number(x).toFixed(xyDigits);
  const ys = Number(y).toFixed(xyDigits);
  const zs = Number(z).toFixed(zDigits);
  return `Label,X,Y,Z\n${lab},${xs},${ys},${zs}\n`;
}

export function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return filename;
}

export function pointCsvFilename(label, axisMode) {
  const safe = sanitizeCsvLabel(label).replace(/[^\w.-]+/g, "_");
  const axis = axisMode === "plane" ? "planeXY" : "ccXY";
  return `${safe}_${axis}.csv`;
}

/**
 * Fetch DEM Z, build CSV, trigger download.
 * @returns {Promise<{ filename: string, meters: number, source: string, axisMode: AxisMode }>}
 */
export async function downloadClickPointCsv({
  lng,
  lat,
  label,
  axisMode = readAxisMode(),
} = {}) {
  const mode = axisMode === "plane" ? "plane" : "cc";
  const plane = lngLatToPlane10(lng, lat);
  const { x, y } = planeToCsvXY(plane, mode);
  const elev = await fetchGsiElevationMeters(lng, lat);
  const lab = sanitizeCsvLabel(label);
  const text = buildCloudCompareCsv({ label: lab, x, y, z: elev.meters });
  const filename = pointCsvFilename(lab, mode);
  downloadTextFile(filename, text);
  return { filename, meters: elev.meters, source: elev.source, axisMode: mode };
}
