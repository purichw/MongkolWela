import test from "node:test";
import assert from "node:assert/strict";
import { activityIsVisible, activityPhase, activityPhaseLabel, filterAdminActivities, activityDateRange } from "../../src/lib/admin-activity-list.js";

const now = new Date("2026-09-27T02:00:00Z");
const event = { id: "a", title: "ทำบุญ", templeId: "wat", status: "published", type: "ceremony", startDate: "2026-09-27", timeMode: "allDay" };
test("activity phases respect Bangkok times and explicit editorial statuses", () => {
  assert.equal(activityPhase(event, now), "ongoing");
  assert.equal(activityPhase({ ...event, startTime: "10:00", timeMode: "timed" }, now), "upcoming");
  assert.equal(activityPhase({ ...event, startDate: "2026-09-26" }, now), "past");
  assert.equal(activityPhase({ ...event, endDate: "2026-09-28" }, now), "ongoing");
  for (const status of ["draft", "archived", "postponed", "cancelled"]) assert.equal(activityPhase({ ...event, status }, now), status);
  assert.equal(activityPhaseLabel({ ...event, status: "cancelled" }, now), "ยกเลิก");
  assert.equal(activityIsVisible({ ...event, status: "cancelled" }), true);
  assert.equal(activityIsVisible({ ...event, status: "archived" }), false);
});
test("filters intersect, overlap ranges, search place/description, and do not mutate input", () => {
  const rows = [{ ...event, id: "b", startDate: "2026-09-20", endDate: "2026-09-28" }, { ...event, id: "a", status: "draft", description: "ฟังธรรม" }];
  const temples = [{ key: "wat", temple: { name: "วัดทดสอบ", province: "กรุงเทพมหานคร" } }];
  assert.equal(filterAdminActivities(rows, { from: "2026-09-28", to: "2026-09-29" }).length, 1);
  assert.equal(filterAdminActivities(rows, { search: "กรุงเทพ", temples }).length, 2);
  assert.equal(filterAdminActivities(rows, { search: "ฟังธรรม", temples }).length, 1);
  assert.equal(filterAdminActivities(rows, { type: "teaching", temples }).length, 0);
  assert.equal(filterAdminActivities(rows, { status: "draft", phase: "upcoming", now }).length, 0);
  assert.equal(filterAdminActivities(rows, { phase: "ongoing", now })[0].id, "b");
  assert.deepEqual(rows.map(item => item.id), ["b", "a"]);
  assert.equal(activityDateRange("", ""), "เลือกช่วงวันที่");
  assert.match(activityDateRange("2026-09-27", ""), /27.*ไม่จำกัด/);
});
