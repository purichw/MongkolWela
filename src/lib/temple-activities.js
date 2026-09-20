export const ACTIVITY_TYPES = { ceremony: "งานบุญและพิธี", meditation: "ปฏิบัติธรรม", teaching: "ฟังธรรม", volunteer: "จิตอาสา", other: "กิจกรรมอื่น ๆ" };
export const ACTIVITY_STATUSES = { draft: "ฉบับร่าง", published: "เผยแพร่", postponed: "เลื่อนกำหนดการ", cancelled: "ยกเลิก", archived: "เก็บเข้าคลัง" };
export const TIME_MODES = { timed: "ระบุเวลา", allDay: "ตลอดวัน", unknown: "รอประกาศเวลา" };
export const TIME_ZONE = "Asia/Bangkok";
const visibleStatuses = new Set(["published", "postponed", "cancelled"]);

export function bangkokToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function safeActivityUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

export function validateActivity(input, { templeIds, today = bangkokToday() } = {}) {
  const fail = (message) => { throw Object.assign(new Error(message), { statusCode: 422 }); };
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("ข้อมูลกิจกรรมไม่ถูกต้อง");
  const text = (key, max = 2000) => {
    const value = String(input[key] ?? "").trim();
    if (value.length > max) fail(`ข้อความ ${key} ยาวเกินกำหนด (${max})`);
    return value;
  };
  const event = Object.fromEntries([
    ["templeId", 250], ["title", 160], ["type", 30], ["status", 30], ["startDate", 10], ["endDate", 10],
    ["timeMode", 20], ["startTime", 5], ["endTime", 5], ["venue", 200], ["description", 4000],
    ["participation", 2000], ["cost", 200], ["preparation", 2000], ["sourceUrl", 2000],
    ["registrationUrl", 2000], ["verifiedAt", 10], ["statusNote", 500],
  ].map(([key, max]) => [key, text(key, max)]));
  if (!event.title) fail("กรุณาระบุชื่อกิจกรรม");
  if (!event.templeId || (templeIds && !templeIds.has(event.templeId))) fail("กรุณาเลือกสถานที่ที่เปิดใช้งาน");
  if (!Object.hasOwn(ACTIVITY_TYPES, event.type) || !Object.hasOwn(ACTIVITY_STATUSES, event.status) || !Object.hasOwn(TIME_MODES, event.timeMode)) fail("ประเภทหรือสถานะกิจกรรมไม่ถูกต้อง");
  for (const field of ["startDate", "endDate", "verifiedAt"]) {
    if (event[field] && !validDate(event[field])) fail("วันที่ไม่ถูกต้อง");
  }
  if (event.verifiedAt > today) fail("วันที่ตรวจสอบต้องไม่เป็นวันในอนาคต");
  if (event.endDate && (!event.startDate || event.endDate < event.startDate)) fail("วันสิ้นสุดต้องไม่ก่อนวันเริ่มกิจกรรม");
  if (event.timeMode === "timed") {
    for (const field of ["startTime", "endTime"]) if (event[field] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(event[field])) fail("เวลาไม่ถูกต้อง");
    if (event.endTime && !event.startTime) fail("กรุณาระบุเวลาเริ่ม");
    if ((!event.endDate || event.endDate === event.startDate) && event.endTime && event.endTime <= event.startTime) fail("เวลาสิ้นสุดต้องหลังเวลาเริ่ม หรือระบุวันสิ้นสุดถัดไป");
  } else { event.startTime = ""; event.endTime = ""; }
  for (const field of ["sourceUrl", "registrationUrl"]) {
    if (event[field] && !safeActivityUrl(event[field])) fail("ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://");
  }
  if (visibleStatuses.has(event.status)) {
    if (!event.startDate || !event.sourceUrl || !event.verifiedAt) fail("ก่อนเผยแพร่ กรุณาระบุวันเริ่ม แหล่งประกาศ และวันที่ตรวจสอบ");
    if (event.timeMode === "timed" && !event.startTime) fail("กรุณาระบุเวลาเริ่ม หรือเลือก รอประกาศเวลา");
    if (["postponed", "cancelled"].includes(event.status) && !event.statusNote) fail("กรุณาระบุรายละเอียดการเลื่อนหรือยกเลิก");
  }
  return { ...event, timeZone: TIME_ZONE };
}

export function activityIsPast(event, now = new Date()) {
  // An undated postponement stays visible until an editor confirms or archives it.
  if (event.status === "postponed") return false;
  const day = event.endDate || event.startDate;
  const end = event.timeMode === "timed" && event.endTime ? `${day}T${event.endTime}:00+07:00` : `${day}T23:59:59.999+07:00`;
  return Date.parse(end) < now.getTime();
}

export function publicActivities(events, templeId, now = new Date()) {
  return events.filter((event) => event.templeId === templeId && visibleStatuses.has(event.status)).map((event) => {
    const fields = ["id", "templeId", "title", "type", "status", "startDate", "endDate", "timeMode", "startTime", "endTime", "timeZone", "venue", "description", "participation", "cost", "preparation", "sourceUrl", "registrationUrl", "verifiedAt", "statusNote", "updatedAt"];
    const publicEvent = Object.fromEntries(fields.map((key) => [key, event[key]]));
    return { ...publicEvent, past: activityIsPast(event, now) };
  }).sort((a, b) => Number(a.past) - Number(b.past) || (a.past ? -1 : 1) * `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`) || a.id.localeCompare(b.id));
}

export function activityDateLabel(event) {
  if (!event.startDate) return "ยังไม่ระบุวัน";
  const format = (value) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(`${value}T12:00:00+07:00`));
  return `${format(event.startDate)}${event.endDate && event.endDate !== event.startDate ? ` – ${format(event.endDate)}` : ""}`;
}
