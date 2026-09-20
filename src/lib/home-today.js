import { createThaiDayInfo, formatThaiDate, formatLunarMonthName, toThaiNumeral } from "../scripts/thai-calendar-core.js";

export function getHomeToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = type => Number(parts.find(value => value.type === type)?.value);
  const info = createThaiDayInfo(new Date(part("year"), part("month") - 1, part("day")));
  const { lunar } = info;
  return {
    date: `วัน${info.weekdayName}ที่ ${formatThaiDate(info)}`,
    weekday: `วัน${info.weekdayName}`,
    lunarLabel: `${lunar.phase} ${toThaiNumeral(lunar.day)} ค่ำ ${formatLunarMonthName(lunar)}`,
    moon: lunar.moon,
  };
}
