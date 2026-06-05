import {
  createMonthMatrix,
  createThaiDayInfo,
  createYearOptions,
  formatLunarLabel,
  formatLunarMonthName,
  formatThaiDate,
  getCalendarSourceNote,
  getTodayBeYear,
  thaiMonthNames,
  toThaiNumeral,
  weekdayNames,
} from "./thai-calendar-core.js?v=20260605-21";

const yearForm = document.querySelector("[data-calendar-form]");
const yearSelect = document.querySelector("[data-calendar-year]");
const monthNav = document.querySelector("[data-calendar-months]");
const calendarGrid = document.querySelector("[data-calendar-grid]");
const yearSummary = document.querySelector("[data-calendar-summary]");
const todayLink = document.querySelector("[data-calendar-today]");

if (yearForm && yearSelect && calendarGrid) {
  initThaiCalendar();
}

function initThaiCalendar() {
  const params = new URLSearchParams(window.location.search);
  const requestedYear = Number(params.get("year"));
  const selectedYear = requestedYear >= 2300 && requestedYear <= 2700 ? requestedYear : clamp(getTodayBeYear(), 2300, 2700);

  yearSelect.innerHTML = createYearOptions()
    .map((year) => `<option value="${year}" ${year === selectedYear ? "selected" : ""}>${year} / ${year - 543}</option>`)
    .join("");

  todayLink.href = `./day/?date=${toInputDate(new Date())}`;
  renderYear(selectedYear);

  yearForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const year = Number(yearSelect.value);
    history.replaceState(null, "", `?year=${year}`);
    renderYear(year);
  });

  yearSelect.addEventListener("change", () => {
    yearForm.requestSubmit();
  });
}

function renderYear(beYear) {
  const ceYear = beYear - 543;
  const firstDay = createThaiDayInfo(new Date(ceYear, 0, 1));
  const songkranDay = createThaiDayInfo(new Date(ceYear, 3, 13));

  yearSummary.innerHTML = `
    <div class="calendar-summary-copy">
      <p class="section-kicker">ปฏิทินไทย ${beYear}</p>
      <h1>ปฏิทินไทย พ.ศ.${beYear}</h1>
      <p>
        ${beYear} / ${ceYear} เริ่มด้วยปี${firstDay.zodiac.name}
        และเปลี่ยนรอบนักษัตรหลังสงกรานต์เป็นปี${songkranDay.zodiac.name}
        พร้อมวันพระ ดิถี หมายเหตุ และแรมค่ำเดือนปีสำหรับทุกวัน
      </p>
    </div>
    <dl>
      <div><dt>จ.ศ.</dt><dd>${firstDay.chulaSakarat} - ${songkranDay.chulaSakarat}</dd></div>
      <div><dt>ระบบปี</dt><dd>${firstDay.yearType}</dd></div>
      <div><dt>หมายเหตุ</dt><dd>${getCalendarSourceNote()}</dd></div>
    </dl>
  `;

  monthNav.innerHTML = thaiMonthNames
    .map((month, index) => `<a href="#month-${index + 1}">${month.slice(0, 3)}</a>`)
    .join("");

  calendarGrid.innerHTML = thaiMonthNames.map((month, index) => renderMonth(beYear, month, index)).join("");
}

function renderMonth(beYear, monthName, monthIndex) {
  const cells = createMonthMatrix(beYear, monthIndex);

  return `
    <section class="thai-month" id="month-${monthIndex + 1}" aria-labelledby="month-${monthIndex + 1}-title">
      <header class="thai-month-head">
        <div>
          <h2 id="month-${monthIndex + 1}-title">${monthName} ${beYear}</h2>
          <span lang="en">${monthNameEn(monthIndex)} ${beYear - 543}</span>
        </div>
        <a href="#calendar-top" aria-label="กลับด้านบน">↑</a>
      </header>
      <div class="thai-weekdays" aria-hidden="true">
        ${weekdayNames.map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="thai-days">
        ${cells.map((info) => (info ? renderDay(info) : '<span class="thai-day is-empty"></span>')).join("")}
      </div>
    </section>
  `;
}

function renderDay(info) {
  const lunarLabel = formatLunarLabel(info.lunar, info.zodiac.name);
  const isToday = info.iso === toInputDate(new Date());
  const primaryEvent = info.events[0];
  const auspicious = info.dithi.find((marker) => marker.tone === "auspicious" || marker.tone === "power");
  const avoid = info.dithi.find((marker) => marker.tone === "avoid");
  const badges = [
    info.isWanPhra ? '<span class="day-badge is-holy">วันพระ</span>' : "",
    primaryEvent && primaryEvent.title !== "วันพระ" ? `<span class="day-badge is-event">${primaryEvent.title}</span>` : "",
    auspicious ? `<span class="day-badge is-good">${auspicious.name}</span>` : "",
    avoid ? `<span class="day-badge is-avoid">${avoid.name}</span>` : "",
  ].join("");

  return `
    <a class="thai-day ${info.isWanPhra ? "has-wanphra" : ""} ${isToday ? "is-today" : ""}" href="./day/?date=${info.iso}" aria-label="${formatThaiDate(info)} ${lunarLabel}">
      <span class="day-top">
        <strong>${info.date.getDate()}</strong>
        ${renderMoonIcon(info.lunar.moon)}
      </span>
      <span class="lunar-line">${info.lunar.phase} ${toThaiNumeral(info.lunar.day)} ค่ำ</span>
      <span class="lunar-line">${formatLunarMonthName(info.lunar)}</span>
      <span class="lunar-line">ปี${info.zodiac.name}</span>
      <span class="day-badges">${badges}</span>
    </a>
  `;
}

function renderMoonIcon(type) {
  return `<i class="moon-icon moon-${type}" aria-hidden="true"></i>`;
}

function monthNameEn(index) {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][index];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
