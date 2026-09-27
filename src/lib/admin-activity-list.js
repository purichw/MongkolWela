import { ACTIVITY_STATUSES, activityIsPast } from "./temple-activities.js";

export const activityIsVisible = event => ["published", "postponed", "cancelled"].includes(event.status);

export function activityPhase(event, now = new Date()) {
  if (event.status !== "published") return event.status;
  if (activityIsPast(event, now)) return "past";
  if (!event.startDate) return "undated";
  const start = `${event.startDate}T${event.timeMode === "timed" && event.startTime ? event.startTime : "00:00"}:00+07:00`;
  return Date.parse(start) > now.getTime() ? "upcoming" : "ongoing";
}

export function activityPhaseLabel(event, now = new Date()) {
  const phase = activityPhase(event, now);
  return { upcoming: "กำลังจะมาถึง", ongoing: "กำลังจัดอยู่", past: "จัดแล้ว", undated: "รอกำหนดการ", ...ACTIVITY_STATUSES }[phase] || "ไม่ทราบสถานะ";
}

export function filterAdminActivities(events, { search = "", phase = "all", type = "all", status = "all", from = "", to = "", temples = [], now = new Date() } = {}) {
  const names = new Map(temples.map(item => [item.key, `${item.temple.name} ${item.temple.province}`]));
  const query = search.trim().toLocaleLowerCase("th");
  const priority = { ongoing: 0, upcoming: 1, postponed: 2, draft: 3, cancelled: 4, past: 5, archived: 6, undated: 7 };
  return events.filter(event => (phase === "all" || activityPhase(event, now) === phase)
    && (type === "all" || type === event.type) && (status === "all" || status === event.status)
    && (!from || Boolean(event.startDate && (event.endDate || event.startDate) >= from))
    && (!to || Boolean(event.startDate && event.startDate <= to))
    && `${event.title} ${event.description || ""} ${names.get(event.templeId) || ""}`.toLocaleLowerCase("th").includes(query))
    .sort((a, b) => (priority[activityPhase(a, now)] ?? 8) - (priority[activityPhase(b, now)] ?? 8) || (a.startDate || "9999").localeCompare(b.startDate || "9999") || a.title.localeCompare(b.title, "th") || a.id.localeCompare(b.id));
}

export function activityDateRange(from, to) {
  if (!from && !to) return "เลือกช่วงวันที่";
  const format = value => value ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(`${value}T12:00:00+07:00`)) : "ไม่จำกัด";
  return `${format(from)} – ${format(to)}`;
}
