// Run: node --experimental-default-type=module tests/aist-3ddb.test.mjs
import assert from "node:assert/strict";
import {
  AIST_PUBLIC_BASE,
  AIST_PUBLIC_TEST_POINT,
  build3ddbPointSearchUrl,
  build3ddbZipUrl,
  search3ddbAtPoint,
  probe3ddbZip,
} from "../app/aist-3ddb.js";

const url = new URL(build3ddbPointSearchUrl(140.1, 36));
assert.equal(url.searchParams.get("area"), "POINT(140.1 36)");
assert.equal(url.searchParams.get("limit"), "100");
assert.equal(build3ddbZipUrl(423), `${AIST_PUBLIC_BASE}/api/v1/zipdata/423`);
assert.match(AIST_PUBLIC_BASE, /^https:\/\/gsvrg\.ipri\.aist\.go\.jp\//);
assert.throws(() => build3ddbZipUrl("../admin"), /登録ID/);
assert.throws(() => build3ddbPointSearchUrl(999, 36), /検索座標/);
assert.equal(AIST_PUBLIC_TEST_POINT.lng, 140.135);

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
assert.equal(found.limit, 100);
assert.equal(found.items.length, 2);
assert.equal(found.items[0].downloadable, true);
assert.equal(found.items[1].downloadable, false);
assert.equal(requestOptions.credentials, "omit");
await assert.rejects(
  search3ddbAtPoint(140.1, 36, { request: async () => ({ ok: false, status: 403 }) }),
  /HTTP 403/
);

const zipOk = await probe3ddbZip(423, {
  request: async (_url, options) => {
    assert.equal(options.method, "HEAD");
    assert.equal(options.credentials, "omit");
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k.toLowerCase() === "content-type" ? "application/zip" : null) },
    };
  },
});
assert.equal(zipOk.ok, true);
assert.equal(zipOk.status, 200);

const zip404 = await probe3ddbZip(423, {
  request: async () => ({
    ok: false,
    status: 404,
    headers: { get: () => "text/html" },
  }),
});
assert.equal(zip404.ok, false);
assert.match(zip404.reason, /HTTP 404/);

const zipHead405 = await probe3ddbZip(12, {
  request: async (_url, options) => {
    if (options.method === "HEAD") {
      return { ok: false, status: 405, headers: { get: () => null } };
    }
    assert.equal(options.method, "GET");
    return {
      ok: false,
      status: 206,
      headers: { get: () => "application/zip" },
    };
  },
});
assert.equal(zipHead405.ok, true);
assert.equal(zipHead405.status, 206);

console.log("3DDB URL and mock API tests passed");
