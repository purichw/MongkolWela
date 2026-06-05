import { levelBands, lifeHouses } from "./life-graph-data.js?v=20260605-7";

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

export function calculateLifeGraph(input) {
  const birthDate = parseDate(input.birthDate);
  const transitDate = parseDate(input.transitDate);
  const birthHour = Number(input.birthHour);
  const birthMinute = Number(input.birthMinute);

  const seeds = createSeeds(birthDate, transitDate, birthHour, birthMinute);
  const houses = lifeHouses.map((house, index) => {
    const raw = seeds.day + seeds.month * (index + 1) + seeds.year * (index + 2) + seeds.time + index * index;
    const value = wrap12(raw + seeds.transit);
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
    seeds,
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

function createSeeds(birthDate, transitDate, birthHour, birthMinute) {
  const buddhistYear = birthDate.getFullYear() + 543;
  const transitYear = transitDate.getFullYear() + 543;
  const day = birthDate.getDay() + 1;
  const month = birthDate.getMonth() + 1;
  const year = wrap12(sumDigits(buddhistYear));
  const time = wrap12(Math.floor(birthHour / 2) + Math.floor(birthMinute / 10) + 1);
  const transit = wrap12(transitDate.getDate() + transitDate.getMonth() + 1 + sumDigits(transitYear));

  return {
    day,
    month,
    year,
    time,
    transit,
    buddhistYear,
    transitYear,
  };
}

function getLevelBand(value) {
  return levelBands.find((band) => value >= band.min) ?? levelBands[levelBands.length - 1];
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

function sumDigits(value) {
  return String(value)
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);
}

function wrap12(value) {
  return ((value - 1) % 12) + 1;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}
