// Run: node --experimental-default-type=module tests/hud.test.mjs
import assert from "node:assert/strict";
import { formatHudPlaneElev } from "../app/hud.js";
import { lngLatToPlane10 } from "../app/plane.js";

assert.equal(formatHudPlaneElev(null), "—, —  —m");
assert.equal(formatHudPlaneElev(null, "…"), "—, —  …");
assert.equal(
  formatHudPlaneElev({ x: -88862.981711, y: -28211.946674 }, "93.0m"),
  "-88862.982, -28211.947  93.0m"
);

const xy = lngLatToPlane10(140.50671005555557, 39.199089083333334);
assert.ok(xy);
assert.match(formatHudPlaneElev(xy, "93.0m"), /^-?\d+\.\d{3}, -?\d+\.\d{3} {2}93\.0m$/);

console.log("hud.test.mjs: ok");
