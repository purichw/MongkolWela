import { test } from "node:test";
import assert from "node:assert/strict";
import { getTemplePlannerData } from "../../src/data/temple-planner.js";
import popular from "../../src/data/popular-temples.json" with { type: "json" };
import { createLegacyTempleSlug } from "../../src/data/temple-slugs.js";

const base = popular.find((item) => Number(item.latitude) && Number(item.longitude));
const key = `popular:${createLegacyTempleSlug(base)}`;
const content = (record) => ({ temples: { records: { [key]: { key, collection: "popular", ...record } } } });

test("planner uses published edits and keeps identity when a name changes", () => {
  const before = getTemplePlannerData(content({})).items.find((item) => item.name === base.name);
  const after = getTemplePlannerData(content({ fields: { name: "Published name", blessings: "", latitude: 13.5 } })).items.find((item) => item.id === before.id);
  assert.equal(after.name, "Published name");
  assert.deepEqual(after.blessings, []);
  assert.equal(after.latitude, 13.5);
});

test("planner honors deleted and newly published records", () => {
  const record = { key: "popular:new-place", collection: "popular", fields: { name: "New place", province: "Test", latitude: 13, longitude: 100 } };
  const live = { temples: { records: { [record.key]: record } } };
  assert.ok(getTemplePlannerData(live).items.some((item) => item.name === "New place"));
  record.status = "deleted";
  assert.ok(!getTemplePlannerData(live).items.some((item) => item.name === "New place"));
});

test("empty coordinates and cleared images are not replaced by older data", () => {
  const live = content({ fields: { name: "Missing coordinates", latitude: "", longitude: "" } });
  assert.ok(!getTemplePlannerData(live).items.some((item) => item.name === "Missing coordinates"));
  const result = getTemplePlannerData(content({ fields: { name: "Cleared image", imageUrl: "", imageAlt: "" }, images: { card: { desktop: { url: "" }, mobile: { url: "" } } } }));
  const item = result.items.find((item) => item.name === "Cleared image");
  assert.equal(item.imageUrl, result.placeholderImage);
});
