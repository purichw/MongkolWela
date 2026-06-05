const CALENOS_BASE_URL = "https://calenos.com/api/thai";

const zodiacNumbers = new Map([
  ["ชวด", 1],
  ["ฉลู", 2],
  ["ขาล", 3],
  ["เถาะ", 4],
  ["มะโรง", 5],
  ["มะเส็ง", 6],
  ["มะเมีย", 7],
  ["มะแม", 8],
  ["วอก", 9],
  ["ระกา", 10],
  ["จอ", 11],
  ["กุน", 12],
  ["กุล", 12],
]);

const zodiacNames = [
  "ชวด",
  "ฉลู",
  "ขาล",
  "เถาะ",
  "มะโรง",
  "มะเส็ง",
  "มะเมีย",
  "มะแม",
  "วอก",
  "ระกา",
  "จอ",
  "กุน",
];

export class ThaiCalendarProvider {
  constructor({ endpoint = readCalendarEndpoint(), apiKey = readCalendarApiKey(), fetcher = fetch } = {}) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.cache = new Map();
    this.shouldUseRemote = Boolean(apiKey) || endpoint !== CALENOS_BASE_URL;
  }

  async getDateInfo(date) {
    const key = toInputDate(date);
    if (this.cache.has(key)) return this.cache.get(key);

    const info = this.shouldUseRemote
      ? await this.readCalenos(key).catch(() => this.createFallbackInfo(date))
      : this.createFallbackInfo(date);
    this.cache.set(key, info);
    return info;
  }

  async readCalenos(dateKey) {
    const url = new URL(`${this.endpoint}/${dateKey}`);
    const headers = {};

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await this.fetcher(url, { headers });
    if (!response.ok) throw new Error(`Thai calendar request failed: ${response.status}`);

    const payload = await response.json();
    const lunarDate = payload?.data?.lunar_date;
    if (!lunarDate) throw new Error("Thai calendar response missing lunar_date");

    const rawMonth = Number(lunarDate.month);
    const normalizedMonth = normalizeLunarMonth(rawMonth);
    const yearAnimal = lunarDate.year_animal;
    const zodiacNumber = zodiacNumbers.get(yearAnimal);

    if (!normalizedMonth || !zodiacNumber) {
      throw new Error("Thai calendar response has unsupported month or zodiac");
    }

    return {
      date: dateKey,
      source: lunarDate.source ? `CalenOS/${lunarDate.source}` : "CalenOS",
      weekdayNumber: new Date(`${dateKey}T00:00:00`).getDay() + 1,
      lunarMonth: normalizedMonth,
      rawLunarMonth: rawMonth,
      lunarLabel: `${lunarDate.phase} ${lunarDate.day} ค่ำ ${lunarDate.month_name}`,
      zodiacName: yearAnimal,
      zodiacNumber,
      yearType: lunarDate.year_type,
      isWanPhra: Boolean(lunarDate.is_wan_phra),
    };
  }

  createFallbackInfo(date) {
    const zodiacNumber = getApproximateZodiac(date);
    const lunarMonth = normalizeLunarMonth(date.getMonth() + 2);

    return {
      date: toInputDate(date),
      source: "ประมาณค่าในเครื่อง",
      weekdayNumber: date.getDay() + 1,
      lunarMonth,
      rawLunarMonth: lunarMonth,
      lunarLabel: `เดือน ${lunarMonth} โดยประมาณ`,
      zodiacName: zodiacNames[zodiacNumber - 1],
      zodiacNumber,
      yearType: "ไม่ทราบ",
      isWanPhra: false,
    };
  }
}

export function createProgression(start, limit, count = 12) {
  return Array.from({ length: count }, (_, index) => wrap(start + index, limit));
}

export function reduceToTwelve(value) {
  return wrap(value, 12);
}

function normalizeLunarMonth(month) {
  if (month === 13) return 8;
  return wrap(month, 12);
}

function getApproximateZodiac(date) {
  return wrap(date.getFullYear() - 2020 + 1, 12);
}

function wrap(value, limit) {
  return ((value - 1) % limit + limit) % limit + 1;
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readCalendarEndpoint() {
  return globalThis.MONKOL_WELA_THAI_CALENDAR_ENDPOINT || CALENOS_BASE_URL;
}

function readCalendarApiKey() {
  try {
    return globalThis.MONKOL_WELA_CALENDAR_API_KEY || localStorage.getItem("monkolWelaCalendarApiKey") || "";
  } catch {
    return globalThis.MONKOL_WELA_CALENDAR_API_KEY || "";
  }
}
