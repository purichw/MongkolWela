import test from "node:test";
import assert from "node:assert/strict";
import { createLegacyTempleSlug, generateTempleSlug, templeSlugError, uniqueTempleSlug } from "../../src/data/temple-slugs.js";
import { templeEnglishNames } from "../../src/data/temple-english-names.js";
import { templeDatasets, templeRouteCatalog, resolveTempleRoute, prepareTempleSlugPublication } from "../../src/lib/temple-routing.js";
import { templeCatalogFromContent } from "../../api/admin/temples.js";
import { publicContentForPath } from "../../src/lib/public-content.js";
import { getTempleSearchCatalog } from "../../src/data/temple-search.js";
import { getTemplePlannerData } from "../../src/data/temple-planner.js";
import { loadTemplePage } from "../../src/server/temple-page.js";

const base = templeDatasets.popular[0];
const oldSlug = createLegacyTempleSlug(base);
const key = `popular:${oldSlug}`;
const edit = (slug, fields = {}) => ({ temples: { records: { [key]: { key, collection: "popular", slug, slugMode: "custom", fields } } } });

test("all 625 dataset routes have reviewed ASCII names and preserve CMS identity", () => {
  const rows = templeRouteCatalog({});
  assert.equal(rows.length, 625);
  assert.equal(new Set(rows.map(row => `${row.collection}/${row.cmsSlug}`)).size, 625);
  for (const [collection, temples] of Object.entries(templeDatasets)) {
    for (const temple of temples) {
      assert.ok(templeEnglishNames[temple.name], temple.name);
      const row = rows.find(item => item.cmsKey === `${collection}:${createLegacyTempleSlug(temple)}`);
      assert.ok(row, temple.name);
      assert.equal(templeSlugError(row.cmsSlug), "");
      assert.ok(!/^\d+-/.test(row.cmsSlug));
      assert.equal(resolveTempleRoute(collection, createLegacyTempleSlug(temple), {}).temple.cmsKey, row.cmsKey);
    }
  }
  assert.equal(rows[0].cmsSlug, "wat-rakhang-khositaram");
});

test("automatic generation romanizes new Thai names and bounds duplicate suffixes", () => {
  assert.equal(generateTempleSlug({ name: "วัดอรุณ" }), "wat-arun");
  assert.equal(generateTempleSlug({ name: "วัดทดสอบใหม่" }), "wat-thot-sop-mai");
  assert.equal(generateTempleSlug({ name: "Temple of the Dawn" }), "temple-of-the-dawn");
  const name = "a".repeat(100);
  const second = uniqueTempleSlug(name, new Set([name]));
  assert.equal(second.length, 100);
  assert.equal(templeSlugError(second), "");
  for (const value of ["", "วัดอรุณ", "bad slug", "Wat-Arun", "bad--slug", "../admin", "new", "a".repeat(101)]) assert.ok(templeSlugError(value), value);
});

test("migration is idempotent, preserves custom English slugs and retains non-URL content", () => {
  const original = edit(oldSlug, { description: "เดิม", latitude: 13.75, name: "ชื่อที่เคยแก้" });
  delete original.temples.records[key].slugMode;
  original.temples.records[key].visitInfo = { contact: { details: [{ term: "โทรศัพท์", value: "123" }] } };
  original.temples.order = { popular: [key] };
  const migrated = prepareTempleSlugPublication(original, original);
  const row = migrated.temples.records[key];
  assert.equal(row.slug, "wat-rakhang-khositaram");
  assert.deepEqual(row.fields, original.temples.records[key].fields);
  assert.deepEqual(row.visitInfo, original.temples.records[key].visitInfo);
  assert.deepEqual(migrated.temples.order, original.temples.order);
  assert.deepEqual(prepareTempleSlugPublication(migrated, migrated), migrated);
  assert.equal(templeRouteCatalog(edit("my-existing-english-slug"))[0].cmsSlug, "my-existing-english-slug");
  assert.equal(original.temples.records[key].slug, oldSlug);
});

test("repeat renames redirect every historical URL directly and cannot forge or steal aliases", () => {
  const first = prepareTempleSlugPublication(edit("rakhang-temple"), {});
  const next = structuredClone(first);
  next.temples.records[key].slug = "temple-of-bells";
  next.temples.records[key].slugAliases = ["forged-alias"];
  const second = prepareTempleSlugPublication(next, first);
  for (const slug of [oldSlug, "wat-rakhang-khositaram", "rakhang-temple"]) {
    const result = resolveTempleRoute("popular", slug, second);
    assert.equal(result.canonicalPath, "/temples/popular/temple-of-bells/");
    assert.equal(result.redirect, true);
  }
  assert.equal(resolveTempleRoute("popular", "forged-alias", second), null);
  assert.equal(resolveTempleRoute("popular", "temple-of-bells", second).redirect, false);
  const conflict = structuredClone(second);
  const otherKey = `popular:${createLegacyTempleSlug(templeDatasets.popular[1])}`;
  conflict.temples.records[otherKey].slug = "rakhang-temple";
  assert.throws(() => prepareTempleSlugPublication(conflict, second), { statusCode: 400 });
  for (const slug of ["wat-arun", "bad slug", "../x", "วัดใหม่", "index", "a".repeat(101)]) {
    assert.throws(() => prepareTempleSlugPublication(edit(slug), {}), { statusCode: 400 });
  }
});

test("new CMS places, disabled records and removed records reserve their URLs", () => {
  const newKey = "mu:admin-example";
  const first = prepareTempleSlugPublication({ temples: { records: { [newKey]: { key: newKey, collection: "mu", slugMode: "auto", fields: { name: "วัดทดสอบใหม่", province: "เชียงใหม่" } } } } }, {});
  const route = resolveTempleRoute("mu", "wat-thot-sop-mai", first);
  assert.equal(route.temple.cmsKey, newKey);
  const disabled = structuredClone(first);
  disabled.temples.records[newKey].enabled = false;
  assert.equal(resolveTempleRoute("mu", "wat-thot-sop-mai", disabled), null);
  delete disabled.temples.records[newKey];
  const removed = prepareTempleSlugPublication(disabled, first);
  assert.equal(removed.temples.records[newKey].status, "deleted");
  removed.temples.records["mu:another"] = { collection: "mu", slug: "wat-thot-sop-mai", fields: { name: "Another" } };
  assert.throws(() => prepareTempleSlugPublication(removed, first), { statusCode: 400 });
});

test("Admin, search, planner and public link projections use the same custom slug", () => {
  const content = prepareTempleSlugPublication(edit("temple-of-bells"), {});
  const admin = templeCatalogFromContent(content).find(row => row.key === key);
  assert.equal(admin.detailUrl, "/temples/popular/temple-of-bells/");
  assert.equal(admin.slugMode, "custom");
  assert.ok(admin.slugAliases.includes(oldSlug));
  const publicContent = publicContentForPath(content, "/temples/popular/");
  assert.equal(publicContent.temples.routes[key], admin.detailUrl);
  const search = getTempleSearchCatalog(content).items.find(item => item.name === base.name);
  assert.equal(search.routes.popular, admin.detailUrl);
  const before = getTemplePlannerData({}).items.find(item => item.name === base.name);
  const after = getTemplePlannerData(content).items.find(item => item.id === before.id);
  assert.equal(after.detailUrl, admin.detailUrl);
});

test("request resolver preserves query strings, returns 404 for unknown and 503 on outage", async () => {
  const content = prepareTempleSlugPublication(edit("temple-of-bells"), {});
  const redirect = await loadTemplePage("popular", oldSlug, new URL(`https://example.com/temples/popular/${oldSlug}/?utm_source=shared`), async () => content);
  assert.equal(redirect.response.status, 308);
  assert.equal(redirect.response.headers.get("Location"), "/temples/popular/temple-of-bells/?utm_source=shared");
  const url = new URL("https://example.com/temples/popular/temple-of-bells/");
  const current = await loadTemplePage("popular", "temple-of-bells", url, async () => content);
  assert.equal(current.temple.cmsKey, key);
  assert.equal(current.headers["Cache-Control"], "no-store");
  const missing = await loadTemplePage("popular", "unknown", url, async () => content);
  assert.equal(missing.response.status, 404);
  const outage = await loadTemplePage("popular", "temple-of-bells", url, async () => { throw new Error("database down"); });
  assert.equal(outage.response.status, 503);
  assert.equal(outage.response.headers.get("Retry-After"), "60");
});

test("page-level CMS patches registered under an old URL follow the canonical route", () => {
  const content = prepareTempleSlugPublication(edit("temple-of-bells"), {});
  content.pages = [{ id: "custom-place-copy", route: `/temples/popular/${encodeURIComponent(oldSlug)}/`, patches: [{ id: "headline", value: "Published copy" }] }];
  const projected = publicContentForPath(content, "/temples/popular/temple-of-bells/");
  assert.equal(projected.pages[0].route, "/temples/popular/temple-of-bells/");
  assert.deepEqual(projected.pages[0].patches, content.pages[0].patches);
  assert.ok(content.pages[0].route.includes(encodeURIComponent(oldSlug)));
});
