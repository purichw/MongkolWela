import test from "node:test";
import assert from "node:assert/strict";
import { coordinates, mapUrl, createPlaceModel, normalizeVisit, hoursSummary, renderVisit, renderHighlights, renderTravel, safeLink } from "../../src/lib/place-detail-view.js";
import { getTempleTravel } from "../../src/data/temple-travel.js";

test("coordinates reject absent/invalid values but accept zero", () => {
  for (const value of [null, undefined, true, false, [], [0], "", " ", "unknown", Infinity, 91]) assert.equal(coordinates({ latitude: value, longitude: 100 }), null);
  assert.deepEqual(coordinates({ latitude: 0, longitude: 0 }), [0, 0]);
  assert.equal(coordinates({ latitude: 13, longitude: 181 }), null);
});
test("Google Maps prefers a valid Plus Code, then valid coordinates", () => {
  assert.match(mapUrl({ plusCode: "PG2W+75 Bangkok", latitude: 13, longitude: 100 }), /PG2W%2B75/);
  assert.match(mapUrl({ plusCode: "javascript:alert(1)", latitude: 13, longitude: 100 }), /13%2C100/);
  assert.equal(mapUrl({ latitude: null, longitude: null }), "");
});
test("links allow verified protocols, never active content", () => {
  assert.equal(safeLink("javascript:alert(1)"), "");
  assert.equal(safeLink("https://"), "");
  assert.equal(safeLink("tel:+6621234567", true), "tel:+6621234567");
  assert.equal(safeLink("mailto:hello@example.com", true), "mailto:hello@example.com");
});
test("daily hours need all seven distinct weekdays with the same time", () => {
  const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
  const raw = { status: "verified", timetable: days.map(day => ({ day, time: "08:00–17:00" })) };
  assert.match(hoursSummary(normalizeVisit({ hours: raw }).hours), /^ทุกวัน/);
  assert.doesNotMatch(hoursSummary(normalizeVisit({ hours: { ...raw, timetable: raw.timetable.slice(0, 6) } }).hours), /^ทุกวัน/);
  assert.doesNotMatch(hoursSummary(normalizeVisit({ hours: { ...raw, timetable: Array(7).fill(raw.timetable[0]) } }).hours), /^ทุกวัน/);
  assert.doesNotMatch(hoursSummary(normalizeVisit({ hours: { status: "unknown" } }).hours), /^ทุกวัน/);
});
test("unknown admission is not free, and raw CMS audiences/contacts remain visible", () => {
  const vm = { visit: normalizeVisit({}, { hours: null, admission: { status: "verified", thai: "ไม่มีค่าเข้าชม", foreign: "100 บาท", adult: "100 บาท", child: "50 บาท" }, contact: { status: "verified", email: "hi@example.com", website: "https://example.com" } }) };
  const html = renderVisit(vm);
  for (const value of ["คนไทย", "ชาวต่างชาติ", "ผู้ใหญ่", "เด็ก", "100 บาท", "50 บาท", "mailto:hi@example.com", "https://example.com/"]) assert.ok(html.includes(value), value);
  const missing = renderVisit({ visit: normalizeVisit() });
  assert.ok(missing.includes("ยังไม่มีข้อมูลค่าเข้าชมที่ยืนยัน"));
  assert.ok(!missing.includes("ไม่มีค่าเข้าชม"));
});
test("CMS clears preserve stable identity, travel source and all highlights", () => {
  const seed = { key: "popular:stable", record: { name: "วัดเดิม", latitude: 13, longitude: 100, travelDetail: { confidence: "high" } }, visit: {}, collectionLabel: "ชุดเดิม" };
  const vm = createPlaceModel(seed, { fields: { name: "", latitude: null, blessings: Array.from({ length: 10 }, (_, i) => `หัวข้อ ${i}`).join(";") } });
  assert.equal(vm.key, seed.key); assert.equal(vm.record.name, "วัดเดิม"); assert.equal(vm.coords, null);
  assert.equal(vm.record.travelDetail, seed.record.travelDetail);
  assert.ok(renderHighlights(vm).includes("หัวข้อ 9"));
  assert.ok(renderHighlights(vm).includes("<details"));
});
test("transport retains directions, unknown modes, stop links and stable keys", () => {
  const routes = [{ mode: "rail", stop: "สถานีเดียวกัน", direction: "เหนือ", operator: "A", distance: "~ 1.4 กม.", locationUrl: "https://example.com/stop" }, { mode: "rail", stop: "สถานีเดียวกัน", direction: "ใต้", operator: "A", distance: "~ 2 กม." }, { mode: "shuttle", stop: "จุดรถรับส่ง", distance: "ไม่ทราบ" }];
  const view = getTempleTravel({ routes });
  assert.equal(view.routes.length, 3); assert.notEqual(view.routes[0].id, view.routes[1].id);
  assert.equal(view.routes[0].distanceMeters, 1400);
  assert.equal(view.routes[2].distanceMeters, Infinity);
  assert.ok(view.sections.some(s => s.mode === "shuttle"));
  assert.equal(view.routes[0].id, getTempleTravel({ routes: [...routes].reverse() }).routes[2].id);
  const html = renderTravel(view, { travelDetail: { confidence: "high" } });
  assert.ok(html.includes("https://example.com/stop")); assert.ok(html.includes("ไม่ระบุระยะ"));
  assert.ok(!html.includes('role="progressbar"')); assert.ok(html.includes('aria-hidden="true"'));
});
