const DAY = 86400000;
export const analyticsDay = value => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const invalidRange = () => Object.assign(new Error("เลือกช่วงวันที่ให้ถูกต้อง ไม่เกิน 90 วัน และไม่เกินวันนี้"), { statusCode: 422 });

export function analyticsRange(from, to, now = new Date()) {
  if (!from && !to) return null;
  if (![from, to].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value || ""))) throw invalidRange();
  const start = Date.parse(`${from}T00:00:00+07:00`);
  const end = Date.parse(`${to}T00:00:00+07:00`);
  if (![start, end].every(Number.isFinite) || analyticsDay(start) !== from || analyticsDay(end) !== to || end < start || end - start >= 90 * DAY || to > analyticsDay(now)) throw invalidRange();
  return { since: new Date(start).toISOString(), until: new Date(Math.min(end + DAY - 1, Number(now))).toISOString(), from, to };
}

export function analyticsPreset(days, now = new Date()) {
  const to = analyticsDay(now);
  const start = Date.parse(`${to}T00:00:00+07:00`) - (Number(days) - 1) * DAY;
  return { from: analyticsDay(start), to };
}

export function analyticsSeries(summary) {
  if (!summary) return [];
  const daily = new Map((summary.daily || []).map(row => [row.date, row.count]));
  const events = new Map((summary.eventDaily || []).map(row => [row.date, row.count]));
  const keys = [...new Set([...daily.keys(), ...events.keys()])].filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  if (summary.coverage && !summary.coverage.limited && Number.isFinite(Date.parse(summary.coverage.since)) && Number.isFinite(Date.parse(summary.coverage.until))) {
    const from = analyticsDay(summary.coverage.since), to = analyticsDay(summary.coverage.until);
    const count = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
    if (count > 0 && count <= 91) {
      return Array.from({ length: count }, (_, index) => new Date(Date.parse(from) + index * DAY).toISOString().slice(0, 10)).map(date => ({ date, pageviews: daily.get(date) || 0, events: events.get(date) || 0 }));
    }
  }
  return keys.map(date => ({ date, pageviews: daily.get(date) || 0, events: events.get(date) || 0 }));
}

export function analyticsReportCsv(summary) {
  const rows = [["รายงานสถิติการใช้งาน", "มงคลเวลา"], ["เริ่มต้น", summary.coverage?.since || "ข้อมูลสะสม"], ["สิ้นสุด", summary.coverage?.until || "ไม่ระบุ"], ["ขอบเขต", summary.coverage?.limited ? "ข้อมูลบางส่วน: เหตุการณ์ล่าสุดตามขีดจำกัดระบบ" : "ข้อมูลที่ระบบบันทึกไว้ ไม่ใช่จำนวนผู้ใช้"], ["การเปิดหน้าเว็บ", summary.totals.pageviews], ["เหตุการณ์", summary.totals.events], [], ["วันที่ (เวลาไทย)", "การเปิดหน้าเว็บ", "เหตุการณ์"], ...analyticsSeries(summary).map(row => [row.date, row.pageviews, Array.isArray(summary.eventDaily) ? row.events : "ไม่มีข้อมูลรายวัน"]), [], ["หน้าเว็บ", "ชื่อหน้า", "จำนวนครั้ง"], ...Object.values(summary.paths || {}).sort((a, b) => b.count - a.count).map(row => [row.path, row.title, row.count]), [], ["เหตุการณ์", "จำนวนครั้ง"], ...Object.values(summary.events || {}).map(row => [row.type, row.count]), [], ["แหล่งอ้างอิงที่บันทึก", "จำนวนครั้ง"], ...(summary.referrers || []).map(row => [row.label, row.count])];
  const cell = value => {
    const text = String(value ?? "");
    const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return `\uFEFF${rows.map(row => row.map(cell).join(",")).join("\r\n")}`;
}
