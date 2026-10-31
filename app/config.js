/** App constants — adjust LABEL_MIN_ZOOM on device after field check (try 14–16). */

export const LABEL_MIN_ZOOM = 15;
export const INITIAL_LASER_YEAR = "2021";
export const INITIAL_LASER_LEGEND_ID = "y2021";
export const PLANE_CRS = "EPSG:6678";
export const PLANE_CRS_LABEL = "平面直角 第10系（EPSG:6678）";
export const INITIAL_BASEMAP = "photo";
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_MOVE_PX = 10;

/** Canonical URL for iPhone QR. Update when Access-guarded host is live. */
export const PUBLIC_URL = "https://yoshida088603.github.io/yuzawa-map-pages/";

/**
 * Deep-link target for memo detail.
 * Policy: leave null — in-app detail sheet is enough for now.
 * Return a URL string later if an external page is needed.
 */
export function memoDetailUrl(_id) {
  return null;
}

export const LASER_TAG_COLORS = {
  LO23: "#e11d48",
  LP22: "#d97706",
  LP21: "#0d9488",
  LP20: "#7c3aed",
};

/** Boundaries layer minzoom (line visibility). */
export const BOUNDARIES_MIN_ZOOM = 11;
export const BOUNDARIES_LABEL_MIN_ZOOM = 13;

/** Laser year labels at polygon centers — only below this zoom. */
export const LASER_LABEL_MAX_ZOOM = 13;
