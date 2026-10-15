import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildThailandAdminAreas } from "../src/lib/thailand-admin-areas.js";

const root = new URL("../", import.meta.url);
const hash = value => createHash("sha256").update(value).digest("hex");
const read = file => fs.readFile(new URL(file, root));
const write = (file, value) => fs.writeFile(new URL(file, root), `${JSON.stringify(value)}\n`);
assert.equal(process.argv[2], "--approved-3389", "Requires the exact approved cleanup scope");
const proposal = JSON.parse(await read("artifacts/directory-places/pre-prune-20261016/deletion-proposal.json"));
const original = await read("public/assets/data/temples-thailand.json");
assert.equal(hash(original), "df1585a52438ca7616250a4572fe9cf06f97c707851fa169aba1ba30d712a35a");
assert.deepEqual(original, await read("artifacts/directory-places/pre-prune-20261016/temples-thailand.json"));
const dataset = JSON.parse(original);
assert.equal(dataset.rows.length, 44705);
for (const file of proposal.protectedFiles) assert.equal(hash(await read(file.path)), file.sha256, file.path);
const removeIds = new Set(proposal.candidates.map(row => row.id));
assert.equal(removeIds.size, 3389);
const removed = dataset.rows.filter(row => removeIds.has(row[1]));
assert.equal(removed.length, 3389);
assert.equal(new Set(removed.map(row => row[1])).size, 3389);
const retained = dataset.rows.filter(row => !removeIds.has(row[1]));
assert.equal(retained.length, 41316);

// Save only geography, never removed temple identities, for the shared CMS editor.
const areas = { source: "Original national registry address choices", sourceRowCount: 44705,
  sourceSha256: hash(original), regions: buildThailandAdminAreas(dataset.rows) };
await write("src/data/thailand-admin-areas.json", areas);
const pruned = { ...dataset, meta: { ...dataset.meta, rowCount: retained.length }, rows: retained };
await write("public/assets/data/temples-thailand.json", pruned);
const saved = JSON.parse(await read("public/assets/data/temples-thailand.json"));
assert.deepEqual(saved.rows, retained);
assert.deepEqual(saved.meta, { ...dataset.meta, rowCount: 41316 });
for (const file of proposal.protectedFiles) assert.equal(hash(await read(file.path)), file.sha256, file.path);
const receipt = {
  status: "APPLIED_USER_APPROVED", approvedOn: "2026-10-16",
  file: "public/assets/data/temples-thailand.json", before: 44705, removed: 3389, retained: 41316,
  originalSha256: hash(original), retainedSha256: hash(await read("public/assets/data/temples-thailand.json")),
  removedIdsSha256: hash(JSON.stringify([...removeIds].sort())),
  retainedRowsSha256: hash(JSON.stringify(retained)),
  areasSha256: hash(await read("src/data/thailand-admin-areas.json")),
  protectedFiles: proposal.protectedFiles,
  scope: proposal.scope,
};
await write("docs/thailand-registry-cleanup.json", receipt);
console.log(JSON.stringify(receipt, null, 2));
