// Run: node --experimental-default-type=module tests/plane.test.mjs
import assert from "node:assert/strict";
import { lngLatToPlane10, formatPlaneXy } from "../app/plane.js";

/** Reference values from pyproj EPSG:4326 → EPSG:6678 (metre). */
const REFS = [
  {
    name: "zone10 origin",
    lng: 140 + 50 / 60,
    lat: 40,
    x: 0,
    y: 0,
    tol: 1e-6,
  },
  {
    name: "yuzawa-ish",
    lng: 140.55,
    lat: 39.16,
    x: -93214.765185,
    y: -24486.34559,
    tol: 0.001,
  },
  {
    name: "sample",
    lng: 140.7889,
    lat: 39.1644,
    x: -92763.624787,
    y: -3839.792802,
    tol: 0.001,
  },
];

for (const r of REFS) {
  const xy = lngLatToPlane10(r.lng, r.lat);
  assert.ok(xy, `${r.name}: expected object`);
  assert.ok(
    Math.abs(xy.x - r.x) <= r.tol,
    `${r.name}: X(northing) got ${xy.x}, want ${r.x}±${r.tol}`
  );
  assert.ok(
    Math.abs(xy.y - r.y) <= r.tol,
    `${r.name}: Y(easting) got ${xy.y}, want ${r.y}±${r.tol}`
  );
}

assert.equal(lngLatToPlane10(null, 39), null);
assert.equal(lngLatToPlane10(140.5, NaN), null);
assert.equal(formatPlaneXy({ x: -93214.765185, y: -24486.34559 }, 3), "-93214.765, -24486.346");

console.log("plane.test.mjs: ok");
