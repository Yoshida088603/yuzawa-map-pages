// Run: node --experimental-default-type=module tests/aist-3ddb.test.mjs
import assert from "node:assert/strict";
import {
  AIST_PUBLIC_BASE, build3ddbPointSearchUrl, build3ddbZipUrl, search3ddbAtPoint,
} from "../app/aist-3ddb.js";

const url = new URL(build3ddbPointSearchUrl(140.1, 36));
assert.equal(url.searchParams.get("area"), "POINT(140.1 36)");
assert.equal(url.searchParams.get("limit"), "100");
assert.equal(build3ddbZipUrl(423), `${AIST_PUBLIC_BASE}/api/v1/zipdata/423`);
assert.throws(() => build3ddbZipUrl("../admin"), /登録ID/);
assert.throws(() => build3ddbPointSearchUrl(999, 36), /検索座標/);

let requestOptions;
const found = await search3ddbAtPoint(140.1, 36, {
  request: async (_url, options) => {
    requestOptions = options;
    return {
      ok: true,
      json: async () => ({
        properties: { all: 3 },
        features: [
          { properties: { reg_id: 10, title: "ZIP available", downloadable: true } },
          { properties: { reg_id: 10, title: "duplicate", downloadable: true } },
          { properties: { reg_id: 11, title: "ZIP unavailable", downloadable: false } },
        ],
      }),
    };
  },
});
assert.equal(found.total, 3);
assert.equal(found.items.length, 2);
assert.equal(found.items[0].downloadable, true);
assert.equal(found.items[1].downloadable, false);
assert.equal(requestOptions.credentials, "omit");
await assert.rejects(
  search3ddbAtPoint(140.1, 36, { request: async () => ({ ok: false, status: 403 }) }),
  /HTTP 403/
);
console.log("3DDB URL and mock API tests passed");
