// Run: node --experimental-default-type=module tests/aist-3ddb.test.mjs
import assert from "node:assert/strict";
import {
  AIST_PUBLIC_BASE,
  AIST_PUBLIC_TEST_POINT,
  build3ddbPointSearchUrl,
  build3ddbZipUrl,
  search3ddbAtPoint,
  probe3ddbZip,
  collectFeatureLonLats,
  estimateCoverageMeters,
  formatCoverageLabel,
  extractExternalLinks,
  absolutize3ddbUrl,
} from "../app/aist-3ddb.js";

const url = new URL(build3ddbPointSearchUrl(140.1, 36));
assert.equal(url.searchParams.get("area"), "POINT(140.1 36)");
assert.equal(url.searchParams.get("limit"), "100");
assert.equal(build3ddbZipUrl(423), `${AIST_PUBLIC_BASE}/api/v1/zipdata/423`);
assert.match(AIST_PUBLIC_BASE, /^https:\/\/gsvrg\.ipri\.aist\.go\.jp\//);
assert.throws(() => build3ddbZipUrl("../admin"), /登録ID/);
assert.throws(() => build3ddbPointSearchUrl(999, 36), /検索座標/);
assert.equal(AIST_PUBLIC_TEST_POINT.lng, 140.135);

const lonLats = collectFeatureLonLats({
  geometries: [
    {
      type: "Polygon",
      coordinates: [
        [
          [139.0, 35.0],
          [139.01, 35.0],
          [139.01, 35.01],
          [139.0, 35.01],
          [139.0, 35.0],
        ],
      ],
    },
  ],
});
assert.equal(lonLats.length, 5);
const cov = estimateCoverageMeters(lonLats);
assert.ok(cov.widthM > 0 && cov.heightM > 0);
assert.match(formatCoverageLabel(cov), /被覆/);

const ext = extractExternalLinks({
  external_links: [
    {
      external_link: "https://gic-tokyo.s3.ap-northeast-1.amazonaws.com/2024/dig/lp/09LD1663.zip",
      external_link_type: "archive",
    },
    {
      external_link: "/3ddb-pds/copc/112725.copc.laz",
      external_link_type: "copc",
    },
  ],
  "3dtiles_url": "/3ddb_demo/3dtiles/112725/tileset.json",
});
assert.equal(ext.length, 3);
assert.equal(ext[0].type, "archive");
assert.match(ext[0].url, /^https:\/\/gic-tokyo\.s3\./);
assert.equal(ext[1].type, "copc");
assert.match(ext[1].url, /^https:\/\/gsvrg\.ipri\.aist\.go\.jp\/3ddb-pds\//);
assert.equal(absolutize3ddbUrl("http://evil.example/x"), null);

let requestOptions;
const found = await search3ddbAtPoint(140.1, 36, {
  request: async (_url, options) => {
    requestOptions = options;
    return {
      ok: true,
      json: async () => ({
        properties: { all: 3 },
        features: [
          {
            properties: { reg_id: 11, title: "big CityGML", service_name: "CITYGML", downloadable: false },
            geometries: [
              {
                type: "Polygon",
                coordinates: [[[139, 35], [140, 35], [140, 36], [139, 36], [139, 35]]],
              },
            ],
          },
          {
            properties: {
              reg_id: 10,
              title: "ZIP available",
              service_name: "LAS",
              downloadable: true,
              external_links: [
                {
                  external_link: "https://example.com/a.zip",
                  external_link_type: "archive",
                },
              ],
            },
            geometries: [
              {
                type: "Polygon",
                coordinates: [[[139.68, 35.65], [139.685, 35.65], [139.685, 35.655], [139.68, 35.655], [139.68, 35.65]]],
              },
            ],
          },
          {
            properties: { reg_id: 10, title: "duplicate", downloadable: true },
          },
        ],
      }),
    };
  },
});
assert.equal(found.total, 3);
assert.equal(found.limit, 100);
assert.equal(found.searchMode, "POINT");
assert.equal(found.items.length, 2);
assert.equal(found.items[0].regId, 10);
assert.equal(found.items[0].downloadable, true);
assert.equal(found.items[0].externalLinks[0].type, "archive");
assert.equal(found.items[1].regId, 11);
assert.equal(found.items[1].downloadable, false);
assert.match(found.items[0].coverageLabel, /被覆/);
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
