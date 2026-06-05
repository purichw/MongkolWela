const MS_PER_DAY = 86400000;
const SYNODIC_MONTH = 29.530588853;
const ANCHOR_NEW_MOON = Date.UTC(2026, 0, 19, 12);
const ANCHOR_LUNATION = {
  month: 3,
  chulaSakarat: 1387,
  isLeapMonth: false,
};

export const thaiMonthNames = [
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

export const weekdayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export const zodiacNames = ["ชวด", "ฉลู", "ขาล", "เถาะ", "มะโรง", "มะเส็ง", "มะเมีย", "มะแม", "วอก", "ระกา", "จอ", "กุน"];
export const weekdayPlanetNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const buddhistFestivalRules = [
  { id: "makha", month: 3, phase: "ขึ้น", day: 15, title: "มาฆบูชา", tone: "holy" },
  { id: "visakha", month: 6, phase: "ขึ้น", day: 15, title: "วิสาขบูชา", tone: "holy" },
  { id: "asalha", month: 8, phase: "ขึ้น", day: 15, title: "อาสาฬหบูชา", tone: "holy" },
  { id: "lent", month: 8, phase: "แรม", day: 1, title: "เข้าพรรษา", tone: "holy" },
  { id: "lent-end", month: 11, phase: "ขึ้น", day: 15, title: "ออกพรรษา", tone: "holy" },
  { id: "thai-sart", month: 10, phase: "แรม", day: 15, title: "สารทไทย", tone: "festival" },
];

const fixedSolarEvents = new Map([
  ["01-01", { title: "วันขึ้นปีใหม่", tone: "holiday" }],
  ["04-06", { title: "วันจักรี", tone: "holiday" }],
  ["04-13", { title: "วันสงกรานต์", tone: "festival" }],
  ["04-14", { title: "วันสงกรานต์", tone: "festival" }],
  ["04-15", { title: "วันสงกรานต์", tone: "festival" }],
  ["05-01", { title: "วันแรงงาน", tone: "holiday" }],
  ["06-03", { title: "วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี", tone: "holiday" }],
  ["07-28", { title: "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว", tone: "holiday" }],
  ["08-12", { title: "วันแม่แห่งชาติ", tone: "holiday" }],
  ["10-13", { title: "วันนวมินทรมหาราช", tone: "holiday" }],
  ["10-23", { title: "วันปิยมหาราช", tone: "holiday" }],
  ["12-05", { title: "วันพ่อแห่งชาติ", tone: "holiday" }],
  ["12-10", { title: "วันรัฐธรรมนูญ", tone: "holiday" }],
  ["12-31", { title: "วันสิ้นปี", tone: "holiday" }],
]);

const pikanDithiByWeekday = [12, 11, 7, 3, 6, 9, 8];
const thonThuekRules = [
  { months: [5, 6, 7], day: 7 },
  { months: [8, 9, 10], day: 8 },
  { months: [11, 12, 1], day: 9 },
  { months: [2, 3, 4], day: 4 },
];

const agniLocations = [
  "วัวควายและปศุสัตว์",
  "ป่าเขาและการตัดไม้",
  "น้ำ เรือ บ่อ สระ",
  "ภูเขาและที่สูง",
  "ที่ดิน เขตคาม การรังวัด",
  "บ้านเรือนและเสาเอก",
  "พระราชพิธีและพิธีใหญ่",
  "ยวดยานและการออกรถ",
  "แผ่นดิน การขุด ถม ปลูกเรือน",
  "เรือ การต่อเรือ การเดินทางน้ำ",
  "พืชพรรณ การเพาะปลูก",
  "คู่ครองและพิธีแต่งงาน",
  "ตัวบุรุษ การเข้าสู่เรือนหอ",
  "พัทธสีมา บรรพชา อุปสมบท",
  "เทวาอารักษ์ การเซ่นสรวงใหญ่",
];

const floatingDayRules = [
  { name: "วันลอย", good: "เหมาะกับการเริ่มต้น เดินทาง และเปิดเรื่องใหม่", weekdays: [1, 4, 5] },
  { name: "วันฟู", good: "เหมาะกับกิจการ งานประจำ ทรัพย์สิน และเรื่องที่ต้องค่อย ๆ เติบโต", weekdays: [2, 6] },
  { name: "วันจม", good: "เหมาะกับงานเก็บ ปิดบัญชี คุมคน หรือสะสางของเก่า", weekdays: [0, 3, 6] },
];

export function createYearOptions() {
  return Array.from({ length: 401 }, (_, index) => 2300 + index);
}

export function createMonthMatrix(beYear, monthIndex) {
  const ceYear = beYear - 543;
  const first = new Date(ceYear, monthIndex, 1);
  const daysInMonth = new Date(ceYear, monthIndex + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < first.getDay(); index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(createThaiDayInfo(new Date(ceYear, monthIndex, day)));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function createThaiDayInfo(date) {
  const normalized = normalizeDate(date);
  const beYear = normalized.getFullYear() + 543;
  const chulaSakarat = getChulaSakarat(normalized);
  const weekday = normalized.getDay();
  const lunar = getLunarInfo(normalized);
  const zodiac = getThaiZodiac(normalized);
  const yearType = getThaiYearType(chulaSakarat);
  const events = getEvents(normalized, lunar);
  const dithi = getDithiMarkers(weekday, lunar);
  const floating = floatingDayRules.find((rule) => rule.weekdays.includes(weekday));

  return {
    date: normalized,
    iso: toIsoDate(normalized),
    beYear,
    ceYear: normalized.getFullYear(),
    chulaSakarat,
    mahasakarat: normalized.getFullYear() - 79,
    rattanakosinSok: beYear - 2325,
    weekday,
    weekdayName: weekdayNames[weekday],
    zodiac,
    yearType,
    lunar,
    events,
    dithi,
    floating,
    isWanPhra: lunar.isWanPhra,
  };
}

export function formatThaiDate(info) {
  return `${info.date.getDate()} ${thaiMonthNames[info.date.getMonth()]} ${info.beYear}`;
}

export function formatLunarLabel(lunar, zodiacName) {
  return `${lunar.phase} ${toThaiNumeral(lunar.day)} ค่ำ ${formatLunarMonthName(lunar)} ปี${zodiacName}`;
}

export function formatLunarMonthName(lunar) {
  return lunar.isLeapMonth ? "เดือนแปดหลัง (๘/๘)" : `เดือน${getThaiMonthWord(lunar.month)} (${toThaiNumeral(lunar.month)})`;
}

export function toThaiNumeral(value) {
  return String(value).replace(/\d/g, (digit) => "๐๑๒๓๔๕๖๗๘๙"[Number(digit)]);
}

export function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseIsoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function getTodayBeYear() {
  return new Date().getFullYear() + 543;
}

export function getCalendarSourceNote() {
  return "คำนวณ MVP ด้วยรอบจันทรคติเฉลี่ยและกฎอธิกมาส 19 ปีแบบไทย พร้อมช่องรองรับฐานข้อมูลปฏิทินโหร/ephemeris จริงในอนาคต";
}

function getLunarInfo(date) {
  const dateAtNoon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const daysFromAnchor = (dateAtNoon - ANCHOR_NEW_MOON) / MS_PER_DAY;
  const lunationIndex = Math.floor(daysFromAnchor / SYNODIC_MONTH);
  const start = ANCHOR_NEW_MOON + lunationIndex * SYNODIC_MONTH * MS_PER_DAY;
  const nextStart = ANCHOR_NEW_MOON + (lunationIndex + 1) * SYNODIC_MONTH * MS_PER_DAY;
  const age = Math.max(0, Math.ceil((dateAtNoon - start) / MS_PER_DAY));
  const daysUntilNext = Math.round((nextStart - dateAtNoon) / MS_PER_DAY);
  const lunation = getLunationMonth(lunationIndex);
  const isWaxing = age <= 14;
  const day = isWaxing ? age + 1 : Math.max(1, Math.min(15, age - 14));
  const phase = isWaxing ? "ขึ้น" : "แรม";
  const isLastWaning = !isWaxing && daysUntilNext <= 1;

  return {
    phase,
    day: isLastWaning ? Math.max(day, 14) : day,
    tithi: isWaxing ? day : 15 + day,
    month: lunation.month,
    isLeapMonth: lunation.isLeapMonth,
    moon: getMoonSymbol(phase, day, isLastWaning),
    isWanPhra: day === 8 || (phase === "ขึ้น" && day === 15) || isLastWaning,
  };
}

function getLunationMonth(offset) {
  if (offset === 0) return ANCHOR_LUNATION;

  let month = ANCHOR_LUNATION.month;
  let chulaSakarat = ANCHOR_LUNATION.chulaSakarat;
  let isLeapMonth = false;
  let insertedLeapMonth = false;
  const step = offset > 0 ? 1 : -1;

  for (let index = 0; index !== offset; index += step) {
    if (step > 0) {
      const next = getNextLunarMonth(month, chulaSakarat, insertedLeapMonth);
      month = next.month;
      chulaSakarat = next.chulaSakarat;
      isLeapMonth = next.isLeapMonth;
      insertedLeapMonth = next.insertedLeapMonth;
    } else {
      const previous = getPreviousLunarMonth(month, chulaSakarat, isLeapMonth);
      month = previous.month;
      chulaSakarat = previous.chulaSakarat;
      isLeapMonth = previous.isLeapMonth;
      insertedLeapMonth = previous.insertedLeapMonth;
    }
  }

  return { month, chulaSakarat, isLeapMonth };
}

function getNextLunarMonth(month, chulaSakarat, insertedLeapMonth) {
  if (month === 8 && isIntercalaryMonthYear(chulaSakarat) && !insertedLeapMonth) {
    return { month: 8, chulaSakarat, isLeapMonth: true, insertedLeapMonth: true };
  }

  if (month === 12) {
    return { month: 1, chulaSakarat: chulaSakarat + 1, isLeapMonth: false, insertedLeapMonth: false };
  }

  return { month: month + 1, chulaSakarat, isLeapMonth: false, insertedLeapMonth };
}

function getPreviousLunarMonth(month, chulaSakarat, isLeapMonth) {
  if (month === 8 && isLeapMonth) {
    return { month: 8, chulaSakarat, isLeapMonth: false, insertedLeapMonth: false };
  }

  if (month === 1) {
    return { month: 12, chulaSakarat: chulaSakarat - 1, isLeapMonth: false, insertedLeapMonth: false };
  }

  const previousMonth = month - 1;
  return {
    month: previousMonth,
    chulaSakarat,
    isLeapMonth: previousMonth === 8 && isIntercalaryMonthYear(chulaSakarat),
    insertedLeapMonth: previousMonth > 8,
  };
}

function getEvents(date, lunar) {
  const key = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const events = [];

  if (fixedSolarEvents.has(key)) events.push(fixedSolarEvents.get(key));

  buddhistFestivalRules.forEach((rule) => {
    if (rule.month === lunar.month && rule.phase === lunar.phase && rule.day === lunar.day) {
      events.push({ title: rule.title, tone: rule.tone });
    }
  });

  if (lunar.isWanPhra) {
    events.unshift({ title: "วันพระ", tone: "wanphra" });
  }

  return events;
}

function getDithiMarkers(weekday, lunar) {
  const markers = [];

  if (lunar.day === pikanDithiByWeekday[weekday]) {
    markers.push({
      name: "ดิถีพิฆาต",
      tone: "avoid",
      description: "วันห้ามมงคลตามตำราดิถีพิฆาต ควรเลี่ยงงานใหญ่และการเริ่มสิ่งที่ผูกพันยาว",
    });
  }

  const thonThuek = thonThuekRules.find((rule) => rule.months.includes(lunar.month) && rule.day === lunar.day);
  if (thonThuek) {
    markers.push({
      name: "วันทรธึก",
      tone: "avoid",
      description: "ดิถีแรงตามกลุ่มเดือนจันทรคติ เหมาะกับการระวังตัวมากกว่าการเปิดงานมงคล",
    });
  }

  if ((lunar.phase === "ขึ้น" && [7, 10, 13].includes(lunar.day)) || (lunar.phase === "แรม" && [4, 8, 10, 14].includes(lunar.day))) {
    markers.push({
      name: "ดิถีเรียงหมอน",
      tone: "auspicious",
      description: "ดิถีที่ตำราฤกษ์แต่งงานนิยมใช้เป็นฐาน ก่อนตรวจองค์ประกอบอื่นร่วม",
    });
  }

  if (weekday + 1 === lunar.day || lunar.month === lunar.day) {
    markers.push({
      name: "กระทิงวัน",
      tone: "power",
      description: "วันแข็ง มีแรง เหมาะกับงานปลุกเสกหรือการตั้งมั่นมากกว่างานอ่อนหวาน",
    });
  }

  markers.push({
    name: "อัคนิโรธ",
    tone: "watch",
    description: `ตำราระบุให้ระวังเรื่อง${agniLocations[lunar.day - 1] || "งานมงคลใหญ่"}ในดิถีนี้`,
  });

  return markers;
}

function getThaiYearType(chulaSakarat) {
  if (isIntercalaryMonthYear(chulaSakarat)) return "อธิกมาส";
  if ([2, 5, 10, 13, 16].includes(mod(chulaSakarat - 8, 19))) return "อธิกวาร";
  return "ปกติมาส";
}

function isIntercalaryMonthYear(chulaSakarat) {
  return [3, 6, 9, 11, 14, 17, 0].includes(mod(chulaSakarat - 8, 19));
}

function getChulaSakarat(date) {
  const songkranPassed = date.getMonth() > 3 || (date.getMonth() === 3 && date.getDate() >= 13);
  return date.getFullYear() - (songkranPassed ? 638 : 639);
}

function getThaiZodiac(date) {
  const songkranPassed = date.getMonth() > 3 || (date.getMonth() === 3 && date.getDate() >= 13);
  const zodiacYear = date.getFullYear() - (songkranPassed ? 2020 : 2021);
  const number = mod(zodiacYear, 12);

  return {
    number: number + 1,
    name: zodiacNames[number],
  };
}

function getMoonSymbol(phase, day, isLastWaning) {
  if (phase === "ขึ้น" && day === 15) return "full";
  if (isLastWaning) return "new";
  if (day === 8) return phase === "ขึ้น" ? "first-quarter" : "last-quarter";
  return phase === "ขึ้น" ? "waxing" : "waning";
}

function getThaiMonthWord(month) {
  const words = {
    1: "อ้าย",
    2: "ยี่",
    3: "สาม",
    4: "สี่",
    5: "ห้า",
    6: "หก",
    7: "เจ็ด",
    8: "แปด",
    9: "เก้า",
    10: "สิบ",
    11: "สิบเอ็ด",
    12: "สิบสอง",
  };
  return words[month] || toThaiNumeral(month);
}

function normalizeDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}
