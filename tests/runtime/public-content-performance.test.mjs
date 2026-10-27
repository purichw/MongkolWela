import test from "node:test";
import assert from "node:assert/strict";
import { publicContentPayload } from "../../src/lib/public-content.js";
import { templeRouteCatalog, resolveTempleRoute } from "../../src/lib/temple-routing.js";

test("visitor details keep lightweight collection cards for live updates, with history only for the current place", () => {
  const rows = templeRouteCatalog({});
  const content = { temples: { records: Object.fromEntries(rows.map(row => [row.cmsKey, {
    collection: row.collection, fields: { name: row.name, description: `History for ${row.cmsKey}` },
    historyResearch: { sources: ["private"] }, images: { card: { desktop: { src: "/photo.webp" } } },
  }])) } };
  const path = `/temples/popular/${rows[0].cmsSlug}/`;
  const place = resolveTempleRoute("popular", rows[0].cmsSlug, content);
  const keys = rows.filter(row => row.collection === place.temple.collection).map(row => row.cmsKey).sort();
  const payload = publicContentPayload(content, path);
  assert.deepEqual(Object.keys(payload.content.temples.records).sort(), keys);
  assert.deepEqual(Object.keys(payload.content.temples.routes).sort(), keys);
  assert.equal(payload.content.temples.records[place.temple.cmsKey].fields.description, content.temples.records[place.temple.cmsKey].fields.description);
  for (const row of place.relatedTemples) {
    assert.equal(payload.content.temples.records[row.cmsKey].fields.description, undefined);
    assert.deepEqual(payload.content.temples.records[row.cmsKey].images, content.temples.records[row.cmsKey].images);
  }
  const other = rows.find(row => !keys.includes(row.cmsKey));
  content.temples.records[other.cmsKey].fields.description = "Updated unrelated history";
  assert.equal(publicContentPayload(content, path).revision, payload.revision);
  content.temples.records[place.temple.cmsKey].fields.description = "";
  const cleared = publicContentPayload(content, path);
  assert.notEqual(cleared.revision, payload.revision);
  assert.equal(cleared.content.temples.records[place.temple.cmsKey].fields.description, "");
  assert.equal(JSON.stringify(cleared).includes("private"), false);
  assert.equal(content.temples.records[other.cmsKey].historyResearch.sources[0], "private");
  const relatedKey = place.relatedTemples[0].cmsKey;
  content.temples.records[relatedKey].enabled = false;
  const refreshed = publicContentPayload(content, path);
  assert.equal(refreshed.content.temples.records[relatedKey].enabled, false, "a now-hidden related card must not fall back to its visible SSR seed");
  assert.equal(refreshed.content.temples.routes[relatedKey], undefined);
});

test("listing projections retain card fields and explicit clears but not unused long histories", () => {
  const record = { collection: "popular", enabled: false, fields: { description: "Long history", name: "", imageUrl: "" }, images: { card: { desktop: null } } };
  const content = { temples: { records: { "popular:test": record }, overrides: { "popular:legacy": record } } };
  for (const path of ["/", "/temples/", "/temples/popular/"]) {
    const projected = publicContentPayload(content, path).content;
    assert.equal(projected.temples.records["popular:test"].fields.description, undefined);
    assert.equal(projected.temples.overrides["popular:legacy"].fields.description, undefined);
    assert.equal(projected.temples.records["popular:test"].fields.name, "");
    assert.equal(projected.temples.records["popular:test"].fields.imageUrl, "");
    assert.equal(projected.temples.records["popular:test"].enabled, false);
  }
  assert.equal(publicContentPayload(content).content.temples.records["popular:test"].fields.description, "Long history");
  assert.equal(record.fields.description, "Long history");
});
