// Run: node --experimental-default-type=module tests/point-csv.test.mjs
import assert from "node:assert/strict";
import {
  decodeGsiElevationRgb,
  lonLatToTilePixel,
  buildGsiDemTileUrl,
} from "../app/gsi-dem.js";
import {
  planeToCsvXY,
  buildCloudCompareCsv,
  sanitizeCsvLabel,
  readAxisMode,
  writeAxisMode,
  AXIS_MODE_LS_KEY,
  pointCsvFilename,
} from "../app/point-csv.js";

assert.equal(decodeGsiElevationRgb(128, 0, 0), null);
// 100.00 m → 10000 → R=0,G=39,B=16 (10000 = 0*65536 + 39*256 + 16)
assert.equal(decodeGsiElevationRgb(0, 39, 16), 100);
// negative example per GSI: values with high bit
assert.ok(decodeGsiElevationRgb(255, 255, 255) < 0);

const tile = lonLatToTilePixel(140.55, 39.16, 14);
assert.ok(Number.isInteger(tile.tileX));
assert.ok(Number.isInteger(tile.tileY));
assert.ok(tile.px >= 0 && tile.px < 256);
assert.ok(tile.py >= 0 && tile.py < 256);
assert.match(
  buildGsiDemTileUrl("dem_png", tile.z, tile.tileX, tile.tileY),
  /\/xyz\/dem_png\/14\/\d+\/\d+\.png$/
);

const plane = { x: 1000.1234, y: 2000.5678 }; // x north, y east
assert.deepEqual(planeToCsvXY(plane, "cc"), { x: 2000.5678, y: 1000.1234 });
assert.deepEqual(planeToCsvXY(plane, "plane"), { x: 1000.1234, y: 2000.5678 });

const csv = buildCloudCompareCsv({
  label: "reg_141611",
  x: 2000.5678,
  y: 1000.1234,
  z: 312.4567,
});
assert.equal(csv, "Label,X,Y,Z\nreg_141611,2000.568,1000.123,312.457\n");
assert.equal(sanitizeCsvLabel("a,b\nc"), "abc");
assert.equal(pointCsvFilename("reg_99", "cc"), "reg_99_ccXY.csv");
assert.equal(pointCsvFilename("reg_99", "plane"), "reg_99_planeXY.csv");

const mem = new Map();
const fakeStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
assert.equal(readAxisMode(fakeStorage), "cc");
assert.equal(writeAxisMode("plane", fakeStorage), "plane");
assert.equal(fakeStorage.getItem(AXIS_MODE_LS_KEY), "plane");
assert.equal(readAxisMode(fakeStorage), "plane");
assert.equal(writeAxisMode("nope", fakeStorage), "cc");

console.log("point-csv / gsi-dem unit tests passed");
