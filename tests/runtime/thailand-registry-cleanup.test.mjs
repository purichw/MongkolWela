import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { buildThailandAdminAreas } from "../../src/lib/thailand-admin-areas.js";

const root = new URL("../../", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root));
const hash = value => createHash("sha256").update(value).digest("hex");
const receipt = JSON.parse(read("docs/thailand-registry-cleanup.json"));

test("approved registry cleanup retains exact rows, metadata and curated source files", () => {
  const bytes = read(receipt.file);
  const registry = JSON.parse(bytes);
  assert.equal(receipt.removed, 3389);
  assert.equal(receipt.before - receipt.removed, registry.rows.length);
  assert.equal(registry.meta.rowCount, 41316);
  assert.equal(hash(bytes), receipt.retainedSha256);
  assert.equal(hash(JSON.stringify(registry.rows)), receipt.retainedRowsSha256);
  assert.equal(registry.meta.columns.length, 13);
  for (const file of receipt.protectedFiles) assert.equal(hash(read(file.path)), file.sha256, file.path);
});

test("CMS geographic choices survive pruning and contain no temple identities", () => {
  const bytes = read("src/data/thailand-admin-areas.json");
  const areas = JSON.parse(bytes);
  assert.equal(hash(bytes), receipt.areasSha256);
  assert.equal(areas.sourceSha256, receipt.originalSha256);
  assert.equal(areas.sourceRowCount, 44705);
  const provinces = areas.regions.flatMap(region => region.provinces);
  assert.equal(new Set(provinces.map(province => province.name)).size, 77);
  for (const province of provinces) {
    assert.deepEqual(Object.keys(province).sort(), ["districts", "name"]);
    assert.ok(province.districts.length);
    for (const district of province.districts) {
      assert.deepEqual(Object.keys(district).sort(), ["name", "subdistricts"]);
      assert.ok(district.subdistricts.every(name => typeof name === "string"));
    }
  }
  const retained = JSON.parse(read(receipt.file));
  const retainedAreas = buildThailandAdminAreas(retained.rows);
  const addressSet = regions => new Set(regions.flatMap(r => r.provinces.flatMap(p => p.districts.flatMap(d => d.subdistricts.map(s => `${p.name}/${d.name}/${s}`)))));
  const all = addressSet(areas.regions);
  const remaining = addressSet(retainedAreas);
  assert.ok(all.size > remaining.size, "Area-only snapshot retains addresses lost from the pruned registry");
  for (const address of remaining) assert.ok(all.has(address));
});
