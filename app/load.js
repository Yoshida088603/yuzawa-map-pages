/** Single fetch entry — later offline SW can intercept these URLs. */

let manifestCache = null;

export async function loadManifest() {
  if (manifestCache) return manifestCache;
  const r = await fetch("./data/manifest.json");
  if (!r.ok) throw new Error("manifest.json を読み込めません");
  manifestCache = await r.json();
  return manifestCache;
}

export async function loadJson(path) {
  const manifest = await loadManifest();
  const v = manifest.version || "0";
  const url = path.includes("?") ? `${path}&v=${encodeURIComponent(v)}` : `${path}?v=${encodeURIComponent(v)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${path} を読み込めません (${r.status})`);
  return r.json();
}

export async function loadDataFile(key) {
  const manifest = await loadManifest();
  const path = manifest.files && manifest.files[key];
  if (!path) throw new Error(`manifest に ${key} がありません`);
  return loadJson("./" + path.replace(/^\.\//, ""));
}
