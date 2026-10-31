/** App constants — adjust LABEL_MIN_ZOOM on device if needed. */

export const LABEL_MIN_ZOOM = 15;
export const INITIAL_LASER_YEAR = "2021";
export const INITIAL_LASER_LEGEND_ID = "y2021";
export const PLANE_CRS = "EPSG:6678";
export const PLANE_CRS_LABEL = "平面直角 第10系（EPSG:6678）";
export const INITIAL_BASEMAP = "photo";
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_MOVE_PX = 10;

/** Canonical Pages URL for iPhone QR (not localhost). */
export const PUBLIC_URL = "https://yoshida088603.github.io/yuzawa-map-pages/";

/** Deep-link target for memo detail. Return a URL string to show the button. */
export function memoDetailUrl(_id) {
  return null;
}

export const LASER_TAG_COLORS = {
  LO23: "#e11d48",
  LP22: "#d97706",
  LP21: "#0d9488",
  LP20: "#7c3aed",
};
