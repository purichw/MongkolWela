import { test } from "node:test";
import assert from "node:assert/strict";
import { getTempleSearchCatalog } from "../../src/data/temple-search.js";
import { searchTemples } from "../../src/lib/temple-search.js";
import handler from "../../api/temple-search.js";
import { spawnSync } from "node:child_process";

const catalog = getTempleSearchCatalog({});
test("all three collections are searchable, without duplicate places", () => {
  assert.deepEqual(catalog.filters.collections.map(item => item.key), ["popular", "sacred", "mu"]);
  assert.equal(new Set(catalog.items.map(item => item.id)).size, catalog.items.length);
  assert.ok(catalog.items.some(item => item.collections.length > 1));
  for (const collection of ["popular", "sacred", "mu"]) {
    const data = searchTemples(catalog, new URLSearchParams({ collection }));
    assert.ok(data.total > 0);
    assert.ok(data.items.every(item => item.collections.includes(collection) && item.detailUrl.startsWith(`/temples/${collection}/`)));
  }
});

test("published clears, deletion, labels, and no-coordinate CMS additions remain authoritative", () => {
  const content = { pages: [{ id: "templesPopular", enabled: false }, { id: "templesMu", label: "ชื่อหมวดจาก CMS" }], temples: { records: {
    "mu:custom-place": { collection: "mu", slug: "custom-place", fields: { name: "สถานที่ไม่มีพิกัดทดสอบ", province: "กรุงเทพมหานคร", blessings: "การงาน; ความรัก", imageUrl: "" } },
    "mu:removed-place": { collection: "mu", slug: "removed-place", enabled: false, fields: { name: "สถานที่ซ่อน" } },
  } } };
  const current = getTempleSearchCatalog(content);
  assert.ok(current.items.every(item => !item.collections.includes("popular")));
  assert.equal(current.filters.collections.find(item => item.key === "mu").label, "ชื่อหมวดจาก CMS");
  const data = searchTemples(current, new URLSearchParams({ q: "ไม่มีพิกัด กทม", purpose: "การงาน" }));
  assert.equal(data.total, 1);
  assert.equal(data.items[0].imageUrl, "");
  assert.equal(data.items[0].detailUrl, "/temples/mu/custom-place/");
  assert.equal(searchTemples(current, new URLSearchParams({ q: "สถานที่ซ่อน" })).total, 0);
});

test("suggestions and full results share ordering; combined facets and paging are bounded", () => {
  const params = { q: "กรุงเทพมหานคร" };
  const suggest = searchTemples(catalog, new URLSearchParams({ ...params, suggest: "1" }));
  const results = searchTemples(catalog, new URLSearchParams(params));
  assert.equal(suggest.total, results.total);
  assert.deepEqual(suggest.items, results.items.slice(0, 5));
  const page = searchTemples(catalog, new URLSearchParams({ page: "999999" }));
  assert.equal(page.page, page.pages);
  assert.ok(page.items.length <= 24);
  assert.equal(searchTemples(catalog, new URLSearchParams({ q: "zzzznotfound" })).total, 0);
  const filtered = searchTemples(catalog, new URLSearchParams({ province: "กรุงเทพมหานคร", purpose: "การงาน" }));
  assert.ok(filtered.items.every(item => item.province === "กรุงเทพมหานคร" && item.blessings.includes("การงาน")));
});

test("GET API exposes only search projection and rejects writes", async () => {
  let status, body; const headers = {};
  const res = { setHeader(key, value) { headers[key] = value; }, set statusCode(value) { status = value; }, end(value) { body = JSON.parse(value); } };
  await handler({ method: "GET", url: "/api/temple-search?q=การงาน&suggest=1" }, res);
  assert.equal(status, 200); assert.ok(body.items.length <= 5);
  assert.equal(headers["Cache-Control"], "no-store");
  assert.ok(!JSON.stringify(body).includes('"records"'));
  await handler({ method: "POST", url: "/api/temple-search" }, res);
  assert.equal(status, 405); assert.equal(headers.Allow, "GET");
});

test("production source failure never returns bundled search results", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import handler from './api/temple-search.js';
    let status;
    await handler({ method: 'GET', url: '/api/temple-search?q=การงาน' }, {
      setHeader() {}, set statusCode(value) { status = value; },
      end(value) { console.log(JSON.stringify({ status, body: JSON.parse(value) })); }
    });
  `], { encoding: "utf8", env: { PATH: process.env.PATH, NODE_ENV: "production" } });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.equal(response.status, 503);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.items, undefined);
});
