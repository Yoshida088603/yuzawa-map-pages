// Run: node --experimental-default-type=module tests/gsi-geocode.test.mjs
import assert from "node:assert/strict";
import {
  classifySearchInput,
  normalizeGsiAddressFeature,
  searchGsiAddress,
  GSI_ADDRESS_SEARCH_URL,
} from "../app/gsi-geocode.js";

assert.equal(classifySearchInput(""), "empty");
assert.equal(classifySearchInput("   "), "empty");
assert.equal(classifySearchInput("湯沢市"), "address");
assert.equal(classifySearchInput("秋田県湯沢市佐竹町"), "address");
assert.equal(classifySearchInput("140.66, 39.16"), "coords_pending");
assert.equal(classifySearchInput("39.164 / 140.665"), "coords_pending");
assert.equal(classifySearchInput("140.665 39.164"), "coords_pending");
assert.equal(classifySearchInput("-0.5, 35.0"), "coords_pending");
assert.equal(classifySearchInput("湯沢 140"), "address");

assert.equal(normalizeGsiAddressFeature(null), null);
assert.equal(
  normalizeGsiAddressFeature({ geometry: { coordinates: [999, 0] }, properties: { title: "x" } }),
  null
);
const hit = normalizeGsiAddressFeature({
  type: "Feature",
  geometry: { type: "Point", coordinates: [140.665, 39.164] },
  properties: { title: "秋田県湯沢市" },
});
assert.deepEqual(hit, { title: "秋田県湯沢市", lng: 140.665, lat: 39.164 });

const untitled = normalizeGsiAddressFeature({
  geometry: { coordinates: [140.1, 36.0] },
  properties: {},
});
assert.equal(untitled.title, "（名称なし）");

function mockResponse({ ok = true, status = 200, body }) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

{
  const calls = [];
  const hits = await searchGsiAddress("湯沢市", {
    request: async (url, init) => {
      calls.push({ url, init });
      return mockResponse({
        body: [
          {
            geometry: { coordinates: [140.665, 39.164] },
            properties: { title: "秋田県湯沢市" },
          },
          {
            geometry: { coordinates: [140.665, 39.164] },
            properties: { title: "秋田県湯沢市" },
          },
          {
            geometry: { coordinates: [null, 1] },
            properties: { title: "bad" },
          },
        ],
      });
    },
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].title, "秋田県湯沢市");
  assert.match(calls[0].url, new RegExp("^" + GSI_ADDRESS_SEARCH_URL.replace(/\./g, "\\.")));
  assert.equal(calls[0].init.credentials, "omit");
}

await assert.rejects(() => searchGsiAddress("  "), /検索語/);
await assert.rejects(
  () =>
    searchGsiAddress("x", {
      request: async () => mockResponse({ ok: false, status: 500, body: [] }),
    }),
  /HTTP 500/
);

console.log("gsi-geocode tests ok");
