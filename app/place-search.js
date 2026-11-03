/** Place / address search UI next to the layers (hamburger) button. */

import { classifySearchInput, searchGsiAddress } from "./gsi-geocode.js";
import { openActionSheet } from "./sheets.js";

const SEARCH_ZOOM = 16;
const SOURCE_ID = "yuzawa-place-search-src";
const LAYER_ID = "yuzawa-place-search-dot";

function emptyFc() {
  return { type: "FeatureCollection", features: [] };
}

function pointFc(lng, lat) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [lng, lat] },
      },
    ],
  };
}

function ensureSearchMarker(map) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: emptyFc() });
  }
  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": 9,
        "circle-color": "#f59e0b",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#0b1216",
      },
    });
  }
}

function setSearchMarker(map, lng, lat) {
  ensureSearchMarker(map);
  map.getSource(SOURCE_ID)?.setData(pointFc(lng, lat));
}

function clearCandidates(listEl) {
  if (!listEl) return;
  listEl.innerHTML = "";
  listEl.hidden = true;
}

function showStatus(el, msg) {
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = msg;
}

/**
 * @param {import("maplibre-gl").Map} map
 */
export function bindPlaceSearch(map) {
  const form = document.getElementById("place-search-form");
  const input = document.getElementById("place-search-input");
  const listEl = document.getElementById("place-search-results");
  const statusEl = document.getElementById("place-search-status");
  if (!form || !input || !listEl) return;

  const wrap = document.getElementById("place-search");
  input.addEventListener("focus", () => wrap?.classList.add("expanded"));
  input.addEventListener("blur", () => {
    // Delay so a result tap can register before collapse.
    setTimeout(() => {
      if (document.activeElement === input) return;
      if (!listEl.hidden && listEl.contains(document.activeElement)) return;
      wrap?.classList.remove("expanded");
    }, 180);
  });

  document.addEventListener("click", (ev) => {
    if (!wrap?.contains(ev.target)) {
      clearCandidates(listEl);
      showStatus(statusEl, "");
      wrap?.classList.remove("expanded");
    }
  });

  async function goToHit(hit) {
    clearCandidates(listEl);
    showStatus(statusEl, "");
    setSearchMarker(map, hit.lng, hit.lat);
    map.flyTo({
      center: [hit.lng, hit.lat],
      zoom: SEARCH_ZOOM,
      duration: 800,
    });
    openActionSheet(hit.lng, hit.lat, null);
  }

  function renderHits(hits) {
    listEl.innerHTML = "";
    if (!hits.length) {
      listEl.hidden = true;
      showStatus(statusEl, "該当する地名・住所が見つかりませんでした。");
      return;
    }
    showStatus(statusEl, "");
    listEl.hidden = false;
    for (const hit of hits) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "place-search-result";
      btn.textContent = hit.title;
      btn.addEventListener("click", () => {
        goToHit(hit);
      });
      listEl.appendChild(btn);
    }
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const raw = input.value;
    const kind = classifySearchInput(raw);
    if (kind === "empty") {
      showStatus(statusEl, "検索語を入力してください。");
      clearCandidates(listEl);
      return;
    }
    if (kind === "coords_pending") {
      showStatus(
        statusEl,
        "座標の直打ちはこの版では未対応です。地名・住所で検索してください。"
      );
      clearCandidates(listEl);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      showStatus(statusEl, "オフラインのため地名検索はできません。");
      clearCandidates(listEl);
      return;
    }

    showStatus(statusEl, "検索中…");
    clearCandidates(listEl);
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const hits = await searchGsiAddress(raw);
      if (hits.length === 1) {
        showStatus(statusEl, "");
        await goToHit(hits[0]);
        return;
      }
      renderHits(hits);
    } catch (err) {
      clearCandidates(listEl);
      showStatus(statusEl, (err && err.message) || String(err));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
