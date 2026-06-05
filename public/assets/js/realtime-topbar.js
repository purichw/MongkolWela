import { createThaiDayInfo, toThaiNumeral } from "./thai-calendar-core.js";

const thaiMonthNames = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const thaiWeekdayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export function initRealtimeTopbar() {
  const realtimeNodes = document.querySelectorAll("[data-topbar-realtime]");
  if (!realtimeNodes.length) return;

  const today = getBangkokDate();
  const info = createThaiDayInfo(today);
  const values = {
    lunarToday: `วันนี้ ${info.lunar.phase} ${toThaiNumeral(info.lunar.day)} ค่ำ เดือน ${toThaiNumeral(info.lunar.month)}`,
    solarToday: `วัน${thaiWeekdayNames[today.getDay()]}ที่ ${today.getDate()} ${thaiMonthNames[today.getMonth()]} ${today.getFullYear() + 543}`,
  };

  realtimeNodes.forEach((node) => {
    const key = node.dataset.topbarRealtime;
    if (values[key]) node.textContent = values[key];
  });
}

function getBangkokDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}
