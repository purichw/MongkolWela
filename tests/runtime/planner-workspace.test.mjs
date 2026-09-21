import test from "node:test";
import assert from "node:assert/strict";
import { criteriaKey, observeDraft, freshness, responseIsCurrent, validatePlan, stageReplacement } from "../../src/scripts/planner/workspace-state.js";
import { createTemplePlannerPlan } from "../../src/lib/temple-planner-engine.js";
import { formatClock } from "../../src/scripts/planner/format.js";

const criteria = { count: 9, startTime: "09:00", startDate: "2026-09-21", budget: "300", regions: [], provinces: [], purposes: [], currentLocation: null };
const items = Array.from({ length: 9 }, (_, i) => ({ id: String(i), name: "สถานที่ " + i, latitude: 13.7 + i * .01, longitude: 100.5, province: "กรุงเทพมหานคร", district: "", blessings: [], globalRank: i + 1, globalMentions: 1, visitMinutes: 30 }));
const createState = () => ({ selected: ["0", "1", "2"], itemById: new Map(items.map(item => [item.id, item])), revision: "v1", draftVersion: 0, requestToken: 1, manualSelectionOrder: false });

test("draft and view edits cannot mutate committed records, times or criteria", () => {
  const state = createState();
  state.committed = { revision: "v1", criteria: structuredClone(criteria), planIds: [...state.selected] };
  observeDraft(state, criteria);
  assert.equal(freshness(state, criteria), "synced");
  const version = state.draftVersion;
  state.view = "both";
  observeDraft(state, criteria);
  assert.equal(state.draftVersion, version);
  state.selected.push("3");
  observeDraft(state, criteria);
  assert.equal(state.draftVersion, version + 1);
  assert.equal(freshness(state, criteria), "draft-changed");
  assert.deepEqual(state.committed.planIds, ["0", "1", "2"]);
  state.revision = "v2";
  state.selected.pop();
  assert.equal(freshness(state, criteria), "catalog-stale");
});

test("request guard requires current token, draft version AND catalog revision", () => {
  const state = createState();
  const submitted = { token: 1, version: 0, revision: "v1" };
  assert.equal(responseIsCurrent(state, submitted), true);
  for (const update of [{ requestToken: 2 }, { draftVersion: 1 }, { revision: "v2" }]) {
    assert.equal(responseIsCurrent({ ...state, ...update }, submitted), false);
  }
});

test("criteria identity includes nested coordinates but ignores server source", () => {
  assert.equal(criteriaKey(criteria), criteriaKey({ ...criteria, source: "manual" }));
  assert.notEqual(criteriaKey({ ...criteria, currentLocation: { latitude: 13, longitude: 100 } }), criteriaKey({ ...criteria, currentLocation: { latitude: 14, longitude: 100 } }));
});

test("partial manual plan remains partial, validates exact IDs/order and captures records", () => {
  const state = createState();
  const submitted = { mode: "manual", criteria, selectedIds: ["2", "0"], manualSelectionOrder: true, revision: "v1" };
  const payload = { ...createTemplePlannerPlan({ items }, submitted), revision: "v1", items };
  const committed = validatePlan(payload, submitted, state.itemById);
  assert.deepEqual(committed.planIds, ["2", "0"]);
  assert.equal(committed.details.stops.length, 2);
  items[0].name = "Changed later";
  assert.notEqual(committed.items[1].name, items[0].name);
  assert.throws(() => validatePlan({ ...payload, planIds: ["0"] }, submitted, state.itemById));
  assert.throws(() => validatePlan({ ...payload, revision: "v2" }, submitted, state.itemById));
  assert.throws(() => validatePlan({ ...payload, details: { ...payload.details, totalMinutes: -1 } }, submitted, state.itemById));
});

test("staged replacement preserves old slot until confirm and rejects stale transactions", () => {
  const state = createState();
  const replacement = { oldId: "1", slot: 1, version: 0, revision: "v1" };
  state.replacement = replacement;
  assert.deepEqual(state.selected, ["0", "1", "2"]);
  state.replacement = null;
  assert.deepEqual(state.selected, ["0", "1", "2"]);
  state.replacement = replacement;
  assert.equal(stageReplacement(state, "1", "0"), false);
  state.draftVersion++;
  assert.equal(stageReplacement(state, "1", "3"), false);
  state.draftVersion = 0;
  assert.equal(stageReplacement(state, "1", "3"), true);
  assert.deepEqual(state.selected, ["0", "3", "2"]);
  assert.equal(state.manualSelectionOrder, true);
});

test("times crossing midnight keep the day offset", () => {
  assert.equal(formatClock(945), "15:45 น.");
  assert.equal(formatClock(1505), "วันถัดไป 01:05 น.");
  assert.equal(formatClock(2900), "+2 วัน 00:20 น.");
});
