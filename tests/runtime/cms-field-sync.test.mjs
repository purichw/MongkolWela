import test from "node:test";
import assert from "node:assert/strict";
import { templeCatalogFromContent } from "../../api/admin/temples.js";
import { getTempleVisitInfo } from "../../src/data/temple-visit-info.js";
import { applyTempleCmsRecords } from "../../src/data/temple-cms.js";
import popular from "../../src/data/popular-temples.json" with { type: "json" };
import { getTemplePlannerData } from "../../src/data/temple-planner.js";
import { getTempleSearchCatalog } from "../../src/data/temple-search.js";
import { createPlaceModel, renderVisit } from "../../src/lib/place-detail-view.js";
import { templeMapItems } from "../../src/lib/temple-map-content.js";
import { editableVisitSection, updateVisitContent } from "../../src/scripts/admin/visit-content.js";
import { contentCatalog, validateContentLibrary, libraryForPath } from "../../src/data/content-catalog.js";
import { applyContentLibrary, managedContent } from "../../src/lib/managed-content.js";
import { updateImagePatch } from "../../src/lib/home-hero-media.js";

test("image copy edits preserve attribution while replacing media clears the old attribution", () => {
  const patch = { src: "/old.webp", alt: "Old alt", credit: "Old credit", sourceUrl: "https://example.com/old", license: "CC BY", licenseUrl: "https://example.com/license" };
  updateImagePatch(patch, { alt: "New alt" });
  assert.equal(patch.credit, "Old credit");
  updateImagePatch(patch, { src: "/old.webp" });
  assert.equal(patch.credit, "Old credit");
  updateImagePatch(patch, { src: "/new.webp" });
  for (const field of ["credit", "sourceUrl", "license", "licenseUrl"]) assert.equal(patch[field], "");
  updateImagePatch(patch, { credit: "New credit", sourceUrl: "https://example.com/new" });
  assert.equal(patch.credit, "New credit");
});

test("Admin catalog carries every editable place field and shares the visitor visiting source after renaming", () => {
  const base = applyTempleCmsRecords("popular", popular, { temples: {} })[0];
  const fields = { name: "CMS place", region: "CMS region", province: "CMS province", district: "CMS district", coordinateAddress: "CMS address", summary: "CMS summary", description: "CMS description", placeType: "CMS type", blessings: "CMS blessing", objectHero: "CMS object", travelModes: "CMS transport", plusCode: "QF2P+W6 Bangkok", latitude: 13.75, longitude: 100.48, imageAlt: "CMS alt", imageSourceLabel: "CMS credit", imageSourceUrl: "https://example.com/source" };
  const record = { collection: "popular", fields, images: { card: { desktop: { url: "/card.webp" }, mobile: { url: "" } }, hero: { desktop: { url: "/hero.webp" }, mobile: { url: "" } }, map: { desktop: { url: "/map.webp" }, mobile: { url: "" } } } };
  const content = { temples: { records: { [base.cmsKey]: record } } };
  const catalog = templeCatalogFromContent(content).find(item => item.key === base.cmsKey);
  for (const [key, value] of Object.entries(fields)) assert.equal(catalog.temple[key], value, key);
  const merged = applyTempleCmsRecords("popular", popular, content).find(item => item.cmsKey === base.cmsKey);
  assert.equal(merged.cmsVisitInfoKey, base.cmsVisitInfoKey);
  assert.deepEqual(getTempleVisitInfo(merged), getTempleVisitInfo(base));
  assert.deepEqual(catalog.visitInfo.hours.timetable, getTempleVisitInfo(base).hours.timetable);
  for (const role of ["card", "hero", "map"]) assert.equal(catalog.temple.images[role].mobile.url, "");
  const model = createPlaceModel({ record: base, visit: getTempleVisitInfo(base) }, record);
  for (const [key, value] of Object.entries(fields)) assert.equal(model.record[key], value, key);
  assert.equal(getTempleSearchCatalog(content).items.find(item => item.id === base.plannerId).name, fields.name);
  const planner = getTemplePlannerData(content).items.find(item => item.id === base.plannerId);
  assert.equal(planner.name, fields.name);
  assert.notEqual(planner.imageMobileUrl, planner.imageUrl);
});

test("map projection applies text, image variants, coordinates, ranking, clears and removal", () => {
  const item = { key: "popular:one", detailUrl: "/temples/popular/one/", rank: 9, name: "Old", province: "Old", latitude: 13, longitude: 100, imageUrl: "/old.webp" };
  const record = { fields: { name: "New", province: "New province", district: "", imageAlt: "", latitude: 14, longitude: 101 }, images: { map: { desktop: { url: "" }, mobile: { url: "/mobile.webp" } } } };
  const content = { temples: { records: { [item.key]: record }, order: { popular: [item.key] } } };
  const [actual] = templeMapItems([item], content, "popular");
  for (const [key, value] of Object.entries(record.fields)) assert.equal(actual[key], value);
  assert.equal(actual.imageUrl, ""); assert.equal(actual.imageMobileUrl, "/mobile.webp"); assert.equal(actual.rank, 1);
  record.fields.latitude = ""; assert.deepEqual(templeMapItems([item], content, "popular"), []);
  record.fields.latitude = 14; record.enabled = false; assert.deepEqual(templeMapItems([item], content, "popular"), []);
  assert.deepEqual(templeMapItems([item], {}, "popular"), [item]);
});

test("visiting fields, summaries, timetable and sources survive edits without resurrecting cleared contacts", () => {
  const record = { visitInfo: { hours: { status: "verified", timetable: [{ day: "Monday", time: "09:00" }] }, contact: { status: "verified", website: "https://old.example.com" }, sources: [] } };
  const edit = {};
  for (const kind of ["hours", "admission", "contact"]) {
    updateVisitContent(edit, record, `${kind}/status`, "verified");
    updateVisitContent(edit, record, `${kind}/summary`, `${kind} summary`);
    editableVisitSection(edit.visitInfo[kind], kind).details.forEach((detail, index) => updateVisitContent(edit, record, `${kind}/details/${index}`, `${kind} value ${index}`));
  }
  updateVisitContent(edit, record, "hours/timetable/0/time", "10:00");
  updateVisitContent(edit, record, "hours/timetable/add", "");
  updateVisitContent(edit, record, "hours/timetable/1/day", "Tuesday");
  updateVisitContent(edit, record, "hours/timetable/1/time", "11:00");
  updateVisitContent(edit, record, "sourceLabel", "CMS source");
  updateVisitContent(edit, record, "sourceUrl", "https://source.example.com");
  const model = () => createPlaceModel({ record: { name: "Place" }, visit: record.visitInfo }, edit);
  let html = renderVisit(model());
  for (const section of Object.values(edit.visitInfo).filter(value => value?.details)) {
    assert.ok(html.includes(section.summary));
    for (const detail of section.details) assert.ok(html.includes(detail.value), detail.term);
  }
  for (const value of ["10:00", "Tuesday", "11:00"]) assert.ok(html.includes(value));
  assert.equal(model().visit.sources.find(source => source.id === "cms-editor").url, "https://source.example.com");
  assert.doesNotMatch(html, /CMS source|source\.example/);
  const index = edit.visitInfo.contact.details.findIndex(detail => detail.term === "เว็บไซต์");
  updateVisitContent(edit, record, `contact/details/${index}`, "");
  updateVisitContent(edit, record, "hours/timetable/1/remove", "");
  updateVisitContent(edit, record, "hours/timetable/0/remove", "");
  html = renderVisit(model());
  assert.doesNotMatch(html, /old\.example|Tuesday|10:00|11:00/);
  assert.equal(edit.visitInfo.hours.timetable.length, 0);
});

test("every registered reading-library field supports publish projection, clearing and restoration", () => {
  const groups = contentCatalog();
  const library = Object.fromEntries(groups.map(group => [group.key, Object.fromEntries(group.records.map(record => [record.id, Object.fromEntries(record.fields.map((field, i) => [field.path, /(?:image|href|url|src|imageThumb|thumbImage)$/i.test(field.path) ? `/cms-field-${i}.webp` : `CMS field ${i}`]))]))]));
  const read = (group, record, path) => {
    const data = managedContent(group.key);
    const item = Array.isArray(data) ? data.find((item, index) => String(item?.id ?? item?.number ?? index) === record.id) : data[record.id];
    return path.split("/").reduce((value, key) => value[key], item);
  };
  try {
    validateContentLibrary(library); applyContentLibrary(library);
    for (const group of groups) {
      assert.deepEqual(libraryForPath(library, group.routes[0])[group.key], library[group.key]);
      for (const record of group.records) for (const field of record.fields) assert.equal(read(group, record, field.path), library[group.key][record.id][field.path]);
    }
    for (const group of Object.values(library)) for (const record of Object.values(group)) for (const key of Object.keys(record)) record[key] = "";
    applyContentLibrary(library);
    for (const group of groups) for (const record of group.records) for (const field of record.fields) assert.equal(read(group, record, field.path), "");
  } finally { applyContentLibrary({}); }
  for (const group of groups) for (const record of group.records) for (const field of record.fields) assert.equal(read(group, record, field.path), field.value);
});
