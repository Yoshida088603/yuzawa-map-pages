/**
 * GPS locate — one-shot by default; short follow only when toggled.
 */

import { setView } from "./map-shell.js";
import { LAYER_IDS, SOURCE_IDS, bringOverlaysFront } from "./layer-order.js";
import { hudPadding } from "./hud.js";

const FOLLOW_MS = 60000;
const LOW_ACCURACY_M = 50;

const state = {
  map: null,
  watching: false,
  watchId: null,
  followUntil: 0,
  last: null,
  onStatus: null,
};

function emptyFc() {
  return { type: "FeatureCollection", features: [] };
}

function positionFc(lng, lat, accuracy) {
  const feats = [
    {
      type: "Feature",
      properties: { kind: "dot" },
      geometry: { type: "Point", coordinates: [lng, lat] },
    },
  ];
  if (accuracy != null && accuracy > 0) {
    feats.push({
      type: "Feature",
      properties: { kind: "accuracy", radius: accuracy },
      geometry: { type: "Point", coordinates: [lng, lat] },
    });
  }
  return { type: "FeatureCollection", features: feats };
}

function setStatus(msg) {
  if (typeof state.onStatus === "function") state.onStatus(msg);
}

function applyPosition(pos, moveMap) {
  const lng = pos.coords.longitude;
  const lat = pos.coords.latitude;
  const accuracy = pos.coords.accuracy;
  state.last = { lng, lat, accuracy, at: Date.now() };
  const src = state.map && state.map.getSource(SOURCE_IDS.gps);
  if (src) src.setData(positionFc(lng, lat, accuracy));
  if (moveMap) {
    const z = Math.max(state.map.getZoom(), 15);
    setView([lng, lat], z, { duration: 700 });
  }
  if (accuracy != null && accuracy > LOW_ACCURACY_M) {
    setStatus(`精度低 ±${Math.round(accuracy)}m`);
  } else {
    setStatus("");
  }
}

function clearWatch() {
  if (state.watchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(state.watchId);
  }
  state.watchId = null;
  state.watching = false;
  state.followUntil = 0;
  const btn = document.getElementById("btn-gps");
  if (btn) btn.classList.remove("following");
}

export function isFollowing() {
  return state.watching && Date.now() < state.followUntil;
}

export function stopFollow() {
  clearWatch();
  setStatus("");
}

export function addGpsLayers(map) {
  state.map = map;
  if (!map.getSource(SOURCE_IDS.gps)) {
    map.addSource(SOURCE_IDS.gps, { type: "geojson", data: emptyFc() });
  }
  if (!map.getLayer(LAYER_IDS.gpsAccuracy)) {
    map.addLayer({
      id: LAYER_IDS.gpsAccuracy,
      type: "circle",
      source: SOURCE_IDS.gps,
      filter: ["==", ["get", "kind"], "accuracy"],
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          ["/", ["get", "radius"], 40],
          16,
          ["/", ["get", "radius"], 2],
        ],
        "circle-color": "#3d9a8b",
        "circle-opacity": 0.2,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#3d9a8b",
        "circle-stroke-opacity": 0.45,
      },
    });
  }
  if (!map.getLayer(LAYER_IDS.gpsDot)) {
    map.addLayer({
      id: LAYER_IDS.gpsDot,
      type: "circle",
      source: SOURCE_IDS.gps,
      filter: ["==", ["get", "kind"], "dot"],
      paint: {
        "circle-radius": 8,
        "circle-color": "#3b82f6",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }
  bringOverlaysFront(map);

  map.on("movestart", (e) => {
    if (e && e.originalEvent && isFollowing()) {
      stopFollow();
      setStatus("追従解除");
      setTimeout(() => setStatus(""), 1200);
    }
  });
}

export function bindGpsButton(map, onStatus) {
  state.map = map;
  state.onStatus = onStatus;
  const btn = document.getElementById("btn-gps");
  if (!btn) return;

  let pressTimer = null;
  const clearPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    locateOnce(true);
  });

  btn.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      toggleFollow();
    }, 550);
  }, { passive: true });
  btn.addEventListener("touchend", clearPress, { passive: true });
  btn.addEventListener("touchcancel", clearPress, { passive: true });
  btn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    toggleFollow();
  });
}

function geolocationOpts() {
  return { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 };
}

export function locateOnce(moveMap) {
  if (!navigator.geolocation) {
    setStatus("位置情報が使えません");
    return;
  }
  setStatus("測位中…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      applyPosition(pos, moveMap !== false);
      if (!isFollowing()) {
        // keep status if low accuracy already set
        if (!(pos.coords.accuracy > LOW_ACCURACY_M)) setStatus("");
      }
    },
    (err) => {
      if (err && err.code === 1) {
        setStatus("設定で位置情報を許可してください");
      } else if (err && err.code === 3) {
        setStatus("測位タイムアウト");
      } else {
        setStatus("測位できませんでした");
      }
    },
    geolocationOpts()
  );
}

export function toggleFollow() {
  if (isFollowing()) {
    stopFollow();
    setStatus("追従OFF");
    setTimeout(() => setStatus(""), 1000);
    return;
  }
  if (!navigator.geolocation) {
    setStatus("位置情報が使えません");
    return;
  }
  clearWatch();
  state.followUntil = Date.now() + FOLLOW_MS;
  state.watching = true;
  const btn = document.getElementById("btn-gps");
  if (btn) btn.classList.add("following");
  setStatus("追従ON（1分）");
  state.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (Date.now() > state.followUntil) {
        stopFollow();
        setStatus("追従終了");
        setTimeout(() => setStatus(""), 1000);
        return;
      }
      applyPosition(pos, true);
    },
    (err) => {
      stopFollow();
      if (err && err.code === 1) setStatus("設定で位置情報を許可してください");
      else setStatus("追従できませんでした");
    },
    geolocationOpts()
  );
}

export function gpsHudPadding() {
  return hudPadding();
}
