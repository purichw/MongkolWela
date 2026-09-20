import { createMonthMatrix, formatLunarLabel, formatThaiDate, thaiMonthNames, toIsoDate, toThaiNumeral } from "./thai-calendar-core.js";

export const YEAR_MIN = 2300;
export const YEAR_MAX = 2700;
export const monthShortNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const eventTypes = {
  "holy-day": { label: "วันพระ", symbol: "●" },
  holiday: { label: "วันหยุด", symbol: "◆" },
  important: { label: "วันสำคัญ", symbol: "◆" },
  favorable: { label: "ดิถีเกื้อหนุน", symbol: "+" },
  caution: { label: "ดิถีควรระวัง", symbol: "!" },
};
const eventOrder = { holiday: 0, "holy-day": 1, important: 2, favorable: 3, caution: 4 };
const validYear = value => Number.isInteger(value) && value >= YEAR_MIN && value <= YEAR_MAX;
const validMonth = value => Number.isInteger(value) && value >= 1 && value <= 12;

export function readCalendarState(href, now = new Date()) {
  const url = new URL(href, "https://calendar.local");
  const requestedYear = Number(url.searchParams.get("year"));
  const currentYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX, now.getFullYear() + 543));
  const year = validYear(requestedYear) ? requestedYear : currentYear;
  const requestedMonth = Number(url.searchParams.get("month"));
  const anchorMonth = Number(url.hash.match(/^#month-(\d+)$/)?.[1]);
  const month = validMonth(requestedMonth) ? requestedMonth : validMonth(anchorMonth) ? anchorMonth : year === currentYear ? now.getMonth() + 1 : 1;
  const requestedView = url.searchParams.get("view");
  const view = ["overview", "month", "events"].includes(requestedView) ? requestedView : "overview";
  return { year, month, view };
}

export function calendarUrl(href, state) {
  const url = new URL(href, "https://calendar.local");
  for (const key of ["year", "month", "view"]) url.searchParams.set(key, String(state[key]));
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

export function shiftMonth(state, delta) {
  const date = new Date(state.year - 543, state.month - 1 + delta, 1);
  const year = date.getFullYear() + 543;
  return validYear(year) ? { ...state, year, month: date.getMonth() + 1 } : null;
}

export function normalizeDay(info) {
  const events = info.events.map(event => ({
    label: event.title,
    type: event.tone === "wanphra" ? "holy-day" : event.tone === "holiday" ? "holiday" : "important",
    sourceKind: event.tone === "holiday" ? "static-rule" : "computed",
    belief: false,
  }));
  for (const marker of info.dithi) {
    if (!["auspicious", "power", "avoid"].includes(marker.tone)) continue;
    events.push({ label: marker.name, type: marker.tone === "avoid" ? "caution" : "favorable", sourceKind: "computed", belief: true });
  }
  const unique = [...new Map(events.map(event => [event.label, event])).values()];
  unique.sort((a, b) => eventOrder[a.type] - eventOrder[b.type]);
  return {
    ...info,
    day: info.date.getDate(),
    fullDate: formatThaiDate(info),
    lunarLabel: formatLunarLabel(info.lunar, info.zodiac.name),
    lunarShort: `${info.lunar.phase} ${toThaiNumeral(info.lunar.day)} ค่ำ`,
    events: unique,
    href: `/calendar/day/?date=${info.iso}`,
  };
}

export function createCalendarStore({ monthFactory = createMonthMatrix } = {}) {
  const cache = new Map();
  return {
    getYear(year) {
      if (!validYear(year)) throw new Error("Unsupported calendar year");
      if (cache.has(year)) return cache.get(year);
      const months = thaiMonthNames.map((name, index) => {
        const cells = monthFactory(year, index);
        const expectedDays = new Date(year - 543, index + 1, 0).getDate();
        if (!Array.isArray(cells) || cells.filter(Boolean).length !== expectedDays || cells.length % 7) {
          throw new Error("Incomplete calendar month");
        }
        const normalized = cells.map(info => info ? normalizeDay(info) : null);
        const days = normalized.filter(Boolean);
        return { month: index + 1, name, year, cells: normalized, days, holyDayCount: days.filter(day => day.isWanPhra).length };
      });
      const result = { year, months, days: months.flatMap(month => month.days) };
      cache.set(year, result);
      if (cache.size > 3) cache.delete(cache.keys().next().value);
      return result;
    },
    invalidate(year) { cache.delete(year); },
  };
}

export function getImportantDays(month) {
  return month.days.filter(day => day.events.some(event => !event.belief));
}

export function getPeriodSummary(store, state, now = new Date()) {
  const year = store.getYear(state.year);
  const currentPeriod = state.year === now.getFullYear() + 543 && state.month === now.getMonth() + 1;
  const today = toIsoDate(now);
  let candidates = currentPeriod ? year.days.filter(day => day.iso > today) : year.months[state.month - 1].days;
  let holyDay = candidates.find(day => day.isWanPhra);
  let importantDay = candidates.find(day => day.events.some(event => !event.belief && event.type !== "holy-day"));
  // Upcoming summaries may cross New Year; a browsed month always stays in that month.
  if (currentPeriod && (!holyDay || !importantDay) && state.year < YEAR_MAX) {
    candidates = store.getYear(state.year + 1).days;
    holyDay ||= candidates.find(day => day.isWanPhra);
    importantDay ||= candidates.find(day => day.events.some(event => !event.belief && event.type !== "holy-day"));
  }
  return { currentPeriod, holyDay, importantDay };
}
