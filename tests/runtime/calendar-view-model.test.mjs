import test from "node:test";
import assert from "node:assert/strict";
import { createMonthMatrix, createThaiDayInfo } from "../../src/scripts/thai-calendar-core.js";
import {
  readCalendarState, calendarUrl, shiftMonth, normalizeDay, createCalendarStore,
  getPeriodSummary, getImportantDays,
} from "../../src/scripts/calendar-view-model.js";

const now = new Date(2026, 8, 20, 12);

test("calendar state preserves BE years, explicit months, views and legacy anchors", () => {
  assert.deepEqual(readCalendarState("https://example.com/calendar/", now), { year: 2569, month: 9, view: "overview" });
  assert.deepEqual(readCalendarState("https://example.com/calendar/?year=2568", now), { year: 2568, month: 1, view: "overview" });
  assert.deepEqual(readCalendarState("https://example.com/calendar/?year=2569&month=2&view=events", now), { year: 2569, month: 2, view: "events" });
  assert.equal(readCalendarState("https://example.com/calendar/?year=2569#month-7", now).month, 7);
  assert.equal(readCalendarState("https://example.com/calendar/?month=3#month-7", now).month, 3);
  for (const query of ["year=abc&month=13&view=broken", "year=2569.5&month=0", "year=2701&month=-1"]) {
    assert.deepEqual(readCalendarState(`https://example.com/calendar/?${query}`, now), { year: 2569, month: 9, view: "overview" });
  }
  const url = calendarUrl("https://example.com/calendar/?tracking=keep#month-1", { year: 2569, month: 9, view: "month" });
  assert.equal(url, "/calendar/?tracking=keep&year=2569&month=9&view=month");
});

test("month navigation crosses years without escaping the supported range", () => {
  assert.deepEqual(shiftMonth({ year: 2569, month: 1, view: "overview" }, -1), { year: 2568, month: 12, view: "overview" });
  assert.deepEqual(shiftMonth({ year: 2569, month: 12, view: "events" }, 1), { year: 2570, month: 1, view: "events" });
  assert.equal(shiftMonth({ year: 2300, month: 1 }, -1), null);
  assert.equal(shiftMonth({ year: 2700, month: 12 }, 1), null);
});

test("one normalized year preserves core dates, lunar values, and all co-occurring events", () => {
  const store = createCalendarStore();
  const year = store.getYear(2569);
  assert.equal(store.getYear(2569), year);
  assert.equal(year.months.length, 12);
  assert.equal(year.days.length, 365);
  let concurrent = 0;
  for (let m = 0; m < 12; m++) {
    const original = createMonthMatrix(2569, m);
    const month = year.months[m];
    assert.equal(month.cells.length, original.length);
    assert.equal(month.holyDayCount, original.filter(d => d?.isWanPhra).length);
    original.forEach((day, i) => {
      if (!day) return assert.equal(month.cells[i], null);
      const normalized = month.cells[i];
      assert.equal(normalized.iso, day.iso);
      assert.deepEqual(normalized.lunar, day.lunar);
      assert.deepEqual(normalized.zodiac, day.zodiac);
      for (const event of day.events) assert.ok(normalized.events.some(e => e.label === event.title));
      if (day.events.length > 1) concurrent++;
    });
  }
  assert.ok(concurrent > 0, "fixture must include real co-occurring events");
  assert.equal(store.getYear(2567).months[1].days.length, 29);
  assert.equal(year.months[1].days.length, 28);
  assert.equal(store.getYear(2569).months[1].cells[0].weekday, 0);
  assert.equal(store.getYear(2569).months[7].cells.slice(0, 6).every(d => d === null), true);
});

test("event normalization deduplicates labels without discarding concurrent festivals or belief rules", () => {
  const info = createThaiDayInfo(now);
  const day = normalizeDay({ ...info, events: [
    { title: "วันพระ", tone: "wanphra" }, { title: "วันทดสอบ", tone: "holiday" },
    { title: "เทศกาลทดสอบ", tone: "festival" }, { title: "วันพระ", tone: "wanphra" },
  ] });
  assert.deepEqual(day.events.slice(0, 3).map(e => e.label), ["วันทดสอบ", "วันพระ", "เทศกาลทดสอบ"]);
  assert.equal(day.events.filter(e => e.label === "วันพระ").length, 1);
  assert.ok(day.events.every(e => e.sourceKind === "computed" || e.sourceKind === "static-rule"));
});

test("summary dates use current output, distinguish the browsed month, and can cross December", () => {
  const store = createCalendarStore();
  const state = { year: 2569, month: 9, view: "overview" };
  const summary = getPeriodSummary(store, state, now);
  assert.ok(summary.holyDay.iso > "2026-09-20");
  assert.ok(summary.importantDay.events.some(e => e.type !== "holy-day" && !e.belief));
  const january = getPeriodSummary(store, { ...state, month: 1 }, now);
  assert.equal(january.currentPeriod, false);
  assert.equal(january.holyDay, store.getYear(2569).months[0].days.find(d => d.isWanPhra));
  const december = getPeriodSummary(store, { ...state, month: 12 }, new Date(2026, 11, 31, 12));
  assert.ok(december.holyDay.iso.startsWith("2027-"));
  assert.equal(getImportantDays({ days: [] }).length, 0);
});

test("failed calculations do not become empty years or poison the retry cache", () => {
  let failing = true;
  const store = createCalendarStore({ monthFactory: (year, month) => {
    if (failing) throw new Error("calculation failed");
    return createMonthMatrix(year, month);
  } });
  assert.throws(() => store.getYear(2569), /calculation failed/);
  failing = false;
  assert.equal(store.getYear(2569).days.length, 365);
  const invalid = createCalendarStore({ monthFactory: () => [] });
  assert.throws(() => invalid.getYear(2569), /calendar month/i);
  assert.throws(() => store.getYear(2701), /year/i);
});
