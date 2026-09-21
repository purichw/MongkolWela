import { houses, planetMeanings, zodiacSigns } from "./thai-astrology-data.js";
import { renderChart } from "./thai-astrology-view.js";

const selectors = {
  form: "[data-thai-astrology-form]",
  output: "[data-thai-astrology-output]",
  hour: "[data-hour-options]",
  minute: "[data-minute-options]",
  transit: "[data-transit-date]",
};

const provinceOffsets = {
  bangkok: 0,
  chiangmai: -7,
  khonkaen: 4,
  songkhla: 2,
  phuket: -4,
  foreign: 10,
};

if (typeof document !== "undefined") initThaiAstrology();

function initThaiAstrology() {
  const form = document.querySelector(selectors.form);
  const output = document.querySelector(selectors.output);
  if (!form || !output) return;

  fillTimeOptions(form);
  setDefaultDates(form);
  const feedback = form.querySelector("[data-astro-feedback]");
  const submit = form.querySelector('[type="submit"]');
  let committedInput = null;

  const markDraft = () => {
    const dirty = committedInput !== JSON.stringify(readInput(form));
    output.dataset.state = dirty ? "dirty" : "ready";
    submit.textContent = dirty ? "อัปเดตดวง" : "ผูกดวง";
    feedback.textContent = dirty ? "แก้ไขข้อมูลแล้ว กดอัปเดตดวงเพื่อคำนวณใหม่" : "";
    const notice = output.querySelector("[data-astro-stale]");
    if (notice) notice.hidden = !dirty;
  };

  const commit = (origin) => {
    if (!validateForm(form)) return;
    submit.disabled = true;
    submit.textContent = "กำลังผูกดวง";
    output.dataset.state = "submitting";
    output.setAttribute("aria-busy", "true");
    try {
      const input = readInput(form);
      const chart = calculateChart(input);
      const parts = renderChart(chart, origin, {
        headline: createHeadline(chart),
        overview: readOverview(chart), career: readCareer(chart), wealth: readWealth(chart),
        relationship: readRelationship(chart), advice: readAdvice(chart), caution: readCaution(chart),
        mode: getChartTypeLabel(chart.chartType), system: getSystemLabel(chart.calculationSystem),
      });
      for (const [part, html] of Object.entries(parts)) {
        output.querySelector(`[data-astro-${part}]`).innerHTML = html;
      }
      committedInput = JSON.stringify(input);
      output.dataset.origin = origin;
      output.dataset.provenance = "approximate";
      markDraft();
      if (origin === "user") {
        feedback.textContent = "อัปเดตดวงจากข้อมูลที่กรอกแล้ว";
        const title = output.querySelector("#thai-result-title");
        title.focus({ preventScroll: true });
        title.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      }
    } catch {
      output.dataset.state = "error";
      feedback.textContent = committedInput
        ? "คำนวณไม่สำเร็จ ผลด้านบนยังเป็นข้อมูลชุดก่อนหน้า โปรดตรวจข้อมูลแล้วลองอีกครั้ง"
        : "คำนวณไม่สำเร็จ โปรดตรวจข้อมูลแล้วลองอีกครั้ง";
    } finally {
      submit.disabled = false;
      submit.textContent = output.dataset.state === "ready" ? "ผูกดวง" : "อัปเดตดวง";
      output.removeAttribute("aria-busy");
    }
  };

  commit("sample");
  form.addEventListener("input", markDraft);
  form.addEventListener("change", markDraft);
  output.addEventListener("click", (event) => {
    if (!event.target.closest("[data-edit-birth]")) return;
    event.preventDefault();
    const title = form.querySelector("#thai-form-title");
    title.focus({ preventScroll: true });
    title.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    commit("user");
  });
}

function fillTimeOptions(form) {
  const hourSelect = form.querySelector(selectors.hour);
  const minuteSelect = form.querySelector(selectors.minute);

  if (hourSelect) {
    hourSelect.innerHTML = Array.from({ length: 24 }, (_, hour) => {
      const value = String(hour).padStart(2, "0");
      return `<option value="${hour}"${hour === 7 ? " selected" : ""}>${value}</option>`;
    }).join("");
  }

  if (minuteSelect) {
    minuteSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
      const minute = index * 5;
      const value = String(minute).padStart(2, "0");
      return `<option value="${minute}"${minute === 30 ? " selected" : ""}>${value}</option>`;
    }).join("");
  }
}

function setDefaultDates(form) {
  const today = new Date();
  const defaultBirth = new Date(today.getFullYear() - 32, today.getMonth(), today.getDate());
  const birthInput = form.elements.birthDate;
  const transitInput = form.querySelector(selectors.transit);

  if (birthInput && !birthInput.value) birthInput.value = toInputDate(defaultBirth);
  if (transitInput && !transitInput.value) transitInput.value = toInputDate(today);
}

function readInput(form) {
  return {
    name: form.elements.name.value.trim() || "เจ้าชะตา",
    birthDate: form.elements.birthDate.value,
    birthHour: Number(form.elements.birthHour.value),
    birthMinute: Number(form.elements.birthMinute.value),
    place: form.elements.birthPlace.value,
    chartType: form.elements.chartType.value,
    calculationSystem: form.elements.calculationSystem.value,
    transitDate: form.elements.transitDate.value,
  };
}

function validateForm(form) {
  form.querySelectorAll("[data-field-error]").forEach((element) => element.remove());
  const fields = [...form.elements].filter((field) => field.willValidate);
  let firstInvalid;
  for (const field of fields) {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    if (field.validity.valid) continue;
    const error = document.createElement("small");
    error.dataset.fieldError = "";
    error.id = `thai-error-${field.name}`;
    error.className = "thai-field-error";
    error.textContent = field.validationMessage;
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", error.id);
    field.closest("label")?.append(error);
    firstInvalid ??= field;
  }
  firstInvalid?.focus();
  return !firstInvalid;
}

export function calculateChart(input) {
  const birthDate = parseInputDate(input.birthDate);
  const transitDate = parseInputDate(input.transitDate);
  const birthDays = daysSinceEpoch(birthDate) + input.birthHour / 24 + input.birthMinute / 1440;
  const transitDays = daysSinceEpoch(transitDate);
  const placeOffset = provinceOffsets[input.place] ?? 0;
  const ayanamsa = input.calculationSystem === "suriyayatra" ? 23.85 : 24.2;
  const ascLongitude = wrapDegrees(input.birthHour * 15 + input.birthMinute / 4 + (birthDate.getMonth() + 1) * 27.4 + placeOffset - ayanamsa);
  const ascSignIndex = longitudeToSignIndex(ascLongitude);
  const sunLongitude = approximateSunLongitude(birthDate, ayanamsa);
  const moonLongitude = approximateMoonLongitude(birthDays, ayanamsa);
  const transitSunLongitude = approximateSunLongitude(transitDate, ayanamsa);

  const planets = planetMeanings.map((planet) => {
    const longitude = planet.id === "sun"
      ? sunLongitude
      : planet.id === "moon"
        ? moonLongitude
        : wrapDegrees(planet.base + birthDays * planet.speed - ayanamsa);
    const signIndex = longitudeToSignIndex(longitude);
    const houseIndex = wrapIndex(signIndex - ascSignIndex, 12);

    return {
      ...planet,
      longitude,
      degree: Math.floor(longitude % 30),
      sign: zodiacSigns[signIndex],
      house: houses[houseIndex],
      houseIndex,
    };
  });

  const transitSign = zodiacSigns[longitudeToSignIndex(transitSunLongitude)];
  const activeHouseIndex = wrapIndex(longitudeToSignIndex(transitSunLongitude) - ascSignIndex, 12);
  const activeHouse = houses[activeHouseIndex];
  const ascSign = zodiacSigns[ascSignIndex];
  const moonSign = zodiacSigns[longitudeToSignIndex(moonLongitude)];
  const strongestHouses = rankHouses(planets);

  return {
    ...input,
    birthDate,
    transitDate,
    ayanamsa,
    ascSign,
    moonSign,
    transitSign,
    activeHouse,
    planets,
    strongestHouses,
  };
}


function createHeadline(chart) {
  const first = chart.strongestHouses[0];
  return {
    title: `ดวงนี้เด่นที่ภพ${first.house.th}`,
    copy: `พลังหลักไปอยู่ที่เรื่อง${first.house.topic} โดยมีลัคนา${chart.ascSign.th}เป็นประตูของดวง ช่วงจรปัจจุบันกระตุ้นภพ${chart.activeHouse.th} จึงควรอ่านทั้งพื้นดวงและสถานการณ์ปัจจุบันประกอบกัน`,
  };
}

function readOverview(chart) {
  return `ลัคนา${chart.ascSign.th}ให้บุคลิกแบบ${chart.ascSign.tone} ส่วนจันทร์${chart.moonSign.th}ทำให้โลกด้านในต้องการจังหวะที่สอดคล้องกับธาตุ${chart.moonSign.element} เมื่ออ่านร่วมกัน ดวงนี้ควรเริ่มจากการรู้จังหวะใจตนเองก่อนตัดสินใจเรื่องใหญ่`;
}

function readCareer(chart) {
  const careerHouse = findHouseScore(chart, "career");
  const sun = chart.planets.find((planet) => planet.id === "sun");
  return `ภพกัมมะมีน้ำหนัก ${careerHouse.score} จุด ดาวอาทิตย์อยู่ภพ${sun.house.th} บอกว่าความสำเร็จมาจากการแสดงบทบาทให้ชัด ถ้างานช่วงนี้ต้องใช้ชื่อเสียงหรือความรับผิดชอบ ควรวางหลักฐาน ผลลัพธ์ และผู้รับผิดชอบให้เป็นระบบ`;
}

function readWealth(chart) {
  const wealthHouse = findHouseScore(chart, "wealth");
  const venus = chart.planets.find((planet) => planet.id === "venus");
  return `ภพกดุมภะมีน้ำหนัก ${wealthHouse.score} จุด และดาวศุกร์สัมพันธ์กับภพ${venus.house.th} รายได้จึงควรมาจากคุณค่าเฉพาะตัว งานบริการ งานศิลป์ หรือความสัมพันธ์ที่ไว้ใจกัน ระวังใช้เงินเพื่อปลอบใจตัวเอง`;
}

function readRelationship(chart) {
  const partnerHouse = findHouseScore(chart, "partner");
  const moon = chart.planets.find((planet) => planet.id === "moon");
  return `ภพปัตนิมีน้ำหนัก ${partnerHouse.score} จุด จันทร์อยู่ภพ${moon.house.th} ความสัมพันธ์ต้องการความปลอดภัยทางใจมากกว่าคำสัญญาสวย ๆ ถ้าจะตกลงเรื่องสำคัญ ให้พูดเรื่องขอบเขต เวลา และความคาดหวังให้ตรง`;
}

function readAdvice(chart) {
  return `ดวงจรปัจจุบันกระตุ้นภพ${chart.activeHouse.th}: ${chart.activeHouse.advice} เหมาะกับการทำสิ่งที่มีพิธี มีลำดับ และมีพยานรู้เห็น เช่น จดบันทึกเจตนา ทำบุญตามกำลัง หรือขอพรครูอาจารย์ก่อนเริ่มเรื่องใหม่`;
}

function readCaution(chart) {
  const saturn = chart.planets.find((planet) => planet.id === "saturn");
  const rahu = chart.planets.find((planet) => planet.id === "rahu");
  return `เสาร์อยู่ภพ${saturn.house.th} จึงไม่ควรเร่งผลลัพธ์ก่อนฐานพร้อม ส่วนราหูอยู่ภพ${rahu.house.th} ทำให้เรื่องนั้นดึงดูดใจเป็นพิเศษ ระวังตัดสินใจเพราะความกลัวพลาดหรือความอยากได้เร็ว`;
}

function rankHouses(planets) {
  return houses
    .map((house, index) => ({
      house,
      score: planets.filter((planet) => planet.houseIndex === index).reduce((sum, planet) => sum + getPlanetWeight(planet.id), 0),
    }))
    .sort((a, b) => b.score - a.score);
}

function findHouseScore(chart, houseId) {
  return chart.strongestHouses.find((item) => item.house.id === houseId) ?? { score: 0 };
}

function getPlanetWeight(planetId) {
  if (planetId === "sun" || planetId === "moon") return 3;
  if (planetId === "jupiter" || planetId === "saturn" || planetId === "rahu") return 2;
  return 1;
}

function approximateSunLongitude(date, ayanamsa) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = (date - start) / 86400000;
  return wrapDegrees(((day - 80) / 365.2422) * 360 - ayanamsa);
}

function approximateMoonLongitude(days, ayanamsa) {
  return wrapDegrees(218.316 + days * 13.176358 - ayanamsa);
}

function daysSinceEpoch(date) {
  return (date - new Date(2000, 0, 1)) / 86400000;
}

function longitudeToSignIndex(longitude) {
  return Math.floor(wrapDegrees(longitude) / 30);
}

function wrapDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function wrapIndex(value, limit) {
  return ((value % limit) + limit) % limit;
}

function parseInputDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toInputDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatThaiDate(date) {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function getSystemLabel(value) {
  return value === "suriyayatra" ? "สุริยยาตร์ไทย (ต้นแบบ)" : "นิรายนะ ลาหิรี (ต้นแบบ)";
}

function getChartTypeLabel(value) {
  const labels = {
    natal: "ดวงกำเนิด",
    transit: "ดวงจร",
    newmoon: "ดวงอมาวสี",
    fullmoon: "ดวงปูรณมี",
  };

  return labels[value] ?? labels.natal;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}
