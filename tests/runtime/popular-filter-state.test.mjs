import test from "node:test";
import assert from "node:assert/strict";
import { filterSnapshotKey, normalizeFilterText } from "../../src/scripts/popular-filters.js";

test("draft identity compares unordered sets without changing Thai text", () => {
  const snapshot = { query: "  WAT วัด  ", regions: new Set(["ภาคเหนือ", "ภาคกลาง"]), provinces: new Set(), purposes: new Set(["การงาน", "การเงิน"]) };
  const equivalent = { ...snapshot, query: "wat วัด", regions: new Set(["ภาคกลาง", "ภาคเหนือ"]), purposes: new Set(["การเงิน", "การงาน"]) };
  assert.equal(filterSnapshotKey(snapshot), filterSnapshotKey(equivalent));
  assert.notEqual(filterSnapshotKey(snapshot), filterSnapshotKey({ ...snapshot, provinces: new Set(["เชียงใหม่"]) }));
  assert.equal(normalizeFilterText(" ปฏิบัติธรรม "), "ปฏิบัติธรรม");
  assert.notEqual(normalizeFilterText("ปฏิบัติธรรม"), normalizeFilterText("ปฏิบตธรรม"));
});
