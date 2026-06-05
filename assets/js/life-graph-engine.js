import { levelBands, lifeHouses } from "./life-graph-data.js?v=20260605-10";
import { ThaiCalendarProvider, createProgression, reduceToTwelve } from "./thai-calendar-provider.js?v=20260605-10";

const thaiMonths = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export async function calculateLifeGraph(input, calendarProvider = new ThaiCalendarProvider()) {
  const birthDate = parseDate(input.birthDate);
  const transitDate = parseDate(input.transitDate);
  const birthHour = Number(input.birthHour);
  const birthMinute = Number(input.birthMinute);
  const calendar = await calendarProvider.getDateInfo(birthDate);
  const rows = createLifeGraphRows(calendar);

  const houses = lifeHouses.map((house, index) => {
    const value = rows.graph[index];
    const band = getLevelBand(value);
    const period = getPeriod(transitDate, index);

    return {
      ...house,
      index,
      value,
      band,
      period,
      age: getAgeAt(birthDate, period.date),
      reading: house[band.tone],
    };
  });

  return {
    name: input.name?.trim() || "ผู้มาเยือน",
    birthDate,
    transitDate,
    birthTime: `${pad2(birthHour)}:${pad2(birthMinute)}`,
    calendar,
    rows,
    houses,
    summary: createSummary(houses),
  };
}

export function formatThaiDate(date) {
  return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getLevelBand(value) {
  return levelBands.find((band) => value >= band.min) ?? levelBands[levelBands.length - 1];
}

function createLifeGraphRows(calendar) {
  const day = createProgression(calendar.weekdayNumber, 7);
  const month = createProgression(calendar.lunarMonth, 12);
  const year = createProgression(calendar.zodiacNumber, 12);
  const total = day.map((value, index) => value + month[index] + year[index]);
  const graph = total.map(reduceToTwelve);

  return { day, month, year, total, graph };
}

function createSummary(houses) {
  const strongest = [...houses].sort((a, b) => b.value - a.value)[0];
  const weakest = [...houses].sort((a, b) => a.value - b.value)[0];
  const average = houses.reduce((sum, house) => sum + house.value, 0) / houses.length;
  const tone = average >= 8 ? "ขาขึ้น" : average >= 5 ? "ทรงตัว" : "ควรประคอง";

  return {
    tone,
    average: Number(average.toFixed(1)),
    strongest,
    weakest,
  };
}

function getPeriod(transitDate, offset) {
  const date = new Date(transitDate.getFullYear(), transitDate.getMonth() + offset, 1);
  return {
    date,
    label: `${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`,
  };
}

function getAgeAt(birthDate, date) {
  let age = date.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    date.getMonth() > birthDate.getMonth() ||
    (date.getMonth() === birthDate.getMonth() && date.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) age -= 1;
  return Math.max(age, 0);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}
