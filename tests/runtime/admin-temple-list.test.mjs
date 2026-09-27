import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTempleList, projectTempleList, templePublicationState, templeListCsv } from "../../src/lib/admin-temple-list.js";

const catalog = Array.from({ length: 45 }, (_, index) => ({ key: `popular:${index + 1}`, collection: "popular", detailUrl: `/temples/popular/${index + 1}/`, temple: { rank: index + 1, name: `วัด ${index + 1}`, province: index % 2 ? "เชียงใหม่" : "กรุงเทพมหานคร", placeType: index % 3 ? "วัด" : "ศาล", summary: "ริมแม่น้ำ" } }));
const keys = new Set(catalog.map(record => record.key));

test("collection projection filters, sorts and paginates without changing records", () => {
  const result = projectTempleList(catalog, "popular", { page: 2 }, {}, {}, keys);
  assert.equal(result.visible.length, 20);
  assert.equal(result.visible[0].key, "popular:21");
  assert.equal(result.pages, 3);
  const filtered = projectTempleList(catalog, "popular", { province: "เชียงใหม่", type: "ศาล", query: "ริมแม่น้ำ", sort: "name", page: 99 }, {}, {}, keys);
  assert.equal(filtered.page, 1);
  assert.ok(filtered.visible.every(record => record.temple.province === "เชียงใหม่" && record.temple.placeType === "ศาล"));
  assert.equal(catalog[0].temple.rank, 1);
  assert.equal(projectTempleList(catalog, "mu", {}, {}, {}, keys).counts.all, 0);
});

test("draft status compares actual overrides with the published baseline", () => {
  const record = catalog[0];
  assert.equal(templePublicationState(record, {}, {}, keys), "published");
  assert.equal(templePublicationState(record, { [record.key]: { status: "active", fields: {}, images: {} } }, {}, keys), "published");
  const edits = { [record.key]: { fields: { name: "วัดใหม่" } } };
  assert.equal(templePublicationState(record, edits, {}, keys), "draft");
  assert.equal(templePublicationState(record, edits, structuredClone(edits), keys), "published");
  assert.equal(templePublicationState({ key: "new" }, {}, {}, keys), "draft");
  const legacyRanks = { [record.key]: { fields: { rank: 1 } } };
  assert.equal(templePublicationState(record, {}, legacyRanks, keys), "published");
  assert.equal(legacyRanks[record.key].fields.rank, 1);
  assert.equal(templePublicationState(record, { [record.key]: { visitInfo: { openingHours: "10:00" } } }, {}, keys), "draft");
  const result = projectTempleList(catalog, "popular", { query: "วัดใหม่", status: "draft" }, edits, {}, keys);
  assert.equal(result.visible[0].temple.name, "วัดใหม่");
  assert.equal(result.counts.draft, 1);
  assert.equal(result.counts.published, 44);
});

test("invalid preferences and spreadsheet formulas are safely bounded", () => {
  assert.equal(normalizeTempleList({ page: -1, pageSize: 100000, sort: "createdAt" }).pageSize, 20);
  assert.equal(normalizeTempleList({ sort: "createdAt" }).sort, "rank");
  const output = templeListCsv([{ temple: { name: '=HYPERLINK("bad")', province: 'a,b' }, listStatus: "draft", isPublished: false, detailUrl: "/unpublished/" }]);
  assert.ok(output.startsWith("\uFEFF"));
  assert.ok(output.includes("'=HYPERLINK"));
  assert.ok(output.includes('"a,b"'));
  assert.ok(!output.includes("/unpublished/"));
});
