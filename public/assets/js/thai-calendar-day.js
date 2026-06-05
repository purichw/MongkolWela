import {
  createThaiDayInfo,
  formatLunarLabel,
  formatLunarMonthName,
  formatThaiDate,
  getCalendarSourceNote,
  parseIsoDate,
  thaiMonthNames,
  toThaiNumeral,
  weekdayPlanetNames,
} from "./thai-calendar-core.js";

const detailRoot = document.querySelector("[data-calendar-day-detail]");
const isEnglish = document.documentElement.lang === "en" || location.pathname.startsWith("/en/");
const t = isEnglish
  ? {
      home: "Home",
      calendar: "Thai Calendar",
      detail: "Day Detail",
      dateTitle: (info) => formatDate(info.date),
      previous: "Previous day",
      backYear: "Back to year calendar",
      next: "Next day",
      lunar: "Thai lunar date",
      month: "Month",
      zodiac: "Zodiac year",
      yearType: "Year type",
      diagram: "Day diagram",
      wheelTitle: "Day and lunar markers",
      good: "Supportive markers",
      avoid: "What to avoid",
      advice: "Today advice",
      source: "Data source",
      sourceTitle: "Use as an introductory auspicious calendar",
      noEvents: "No major holiday or festival",
      holy: "Buddhist holy day",
      sourceCopy: (note) => `${note} Important days and traditional markers are modeled from Thai astrological calendar rules. Detailed planetary positions should later connect to a verified ephemeris or licensed astrologer's calendar before being used for formal auspicious timing.`,
      sourceNote: "This phase is for day-reading UX and data modeling. Once verified calendar sources are connected, Mongkol Wela will show source and confidence details in the content database.",
    }
  : {
      home: "หน้าแรก",
      calendar: "ปฏิทินไทย",
      detail: "รายละเอียดวัน",
      dateTitle: (info) => `วันที่ ${formatThaiDate(info)}`,
      previous: "วันก่อนหน้า",
      backYear: "กลับปฏิทินปี",
      next: "วันถัดไป",
      lunar: "จันทรคติ",
      month: "เดือน",
      zodiac: "ปีนักษัตร",
      yearType: "ประเภทปี",
      diagram: "แผนภาพวัน",
      wheelTitle: "จักรวันและดิถี",
      good: "ฤกษ์ที่เกื้อหนุน",
      avoid: "ข้อควรหลีกเลี่ยง",
      advice: "คำแนะนำวันนี้",
      source: "ที่มาของข้อมูล",
      sourceTitle: "ใช้เป็นปฏิทินมงคลเบื้องต้น",
      noEvents: "ไม่มีวันหยุดหรือเทศกาลหลัก",
      holy: "วันพระ",
      sourceCopy: (note) => `${note} วันสำคัญและกฎดิถีอ้างโครงตำราโหราศาสตร์ไทย เช่น ดิถีพิฆาต
        ดิถีเรียงหมอน วันทรธึก และวันลอยวันจมวันฟู ส่วนสมผุสดาวละเอียดควรต่อฐาน ephemeris
        หรือปฏิทินโหรที่มีสิทธิ์ใช้งานก่อนใช้ตัดสินฤกษ์จริง`,
      sourceNote: "ระยะนี้ใช้สำหรับการอ่านวันและวาง UX ก่อน เมื่อเชื่อมฐานข้อมูลโหรฉบับตรวจสอบได้ ระบบจะระบุระดับความแม่นของข้อมูลและที่มาภายในฐานข้อมูลของมงคลเวลา",
    };

if (detailRoot) {
  initDayDetail();
}

function initDayDetail() {
  const params = new URLSearchParams(window.location.search);
  const date = parseIsoDate(params.get("date") || "") || new Date();
  const info = createThaiDayInfo(date);
  const previous = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  document.title = `${isEnglish ? formatDate(info.date) : formatThaiDate(info)} | ${isEnglish ? "Thai Calendar, Mongkol Wela" : "ปฏิทินไทย มงคลเวลา"}`;
  detailRoot.innerHTML = `
    <section class="calendar-day-hero">
      <nav class="calendar-breadcrumb" aria-label="breadcrumb">
        <a href="${isEnglish ? "/en/" : "/"}">${t.home}</a>
        <span>/</span>
        <a href="../?year=${info.beYear}">${t.calendar}</a>
        <span>/</span>
        <span>${isEnglish ? formatDate(info.date) : formatThaiDate(info)}</span>
      </nav>
      <div>
        <p class="section-kicker">${t.detail}</p>
        <h1>${t.dateTitle(info)}</h1>
        <p>${info.weekdayName} ${formatLunarLabel(info.lunar, info.zodiac.name)}</p>
      </div>
      <div class="day-nav">
        <a href="./?date=${toIso(previous)}">${t.previous}</a>
        <a href="../?year=${info.beYear}">${t.backYear}</a>
        <a href="./?date=${toIso(next)}">${t.next}</a>
      </div>
    </section>

    <section class="calendar-day-layout">
      <article class="day-reading-panel">
        <div class="day-title-row">
          <div>
            <p class="section-kicker">${t.lunar}</p>
            <h2>${info.weekdayName} ${info.lunar.phase} ${toThaiNumeral(info.lunar.day)} ค่ำ</h2>
          </div>
          ${renderMoonIcon(info.lunar.moon)}
        </div>
        <dl class="day-facts">
          <div><dt>${t.month}</dt><dd>${formatLunarMonthName(info.lunar)}</dd></div>
          <div><dt>${t.zodiac}</dt><dd>${isEnglish ? "" : "ปี"}${info.zodiac.name}</dd></div>
          <div><dt>จ.ศ.</dt><dd>${info.chulaSakarat}</dd></div>
          <div><dt>ม.ศ.</dt><dd>${info.mahasakarat}</dd></div>
          <div><dt>ร.ศ.</dt><dd>${info.rattanakosinSok}</dd></div>
          <div><dt>${t.yearType}</dt><dd>${info.yearType}</dd></div>
        </dl>
        ${renderEventList(info)}
      </article>

      <article class="astro-wheel-panel">
        <div>
          <p class="section-kicker">${t.diagram}</p>
          <h2>${t.wheelTitle}</h2>
        </div>
        ${renderAstroWheel(info)}
      </article>
    </section>

    <section class="day-omen-grid">
      ${renderOmenCard(t.good, getGoodReadings(info), "good")}
      ${renderOmenCard(t.avoid, getAvoidReadings(info), "avoid")}
      ${renderOmenCard(t.advice, getAdvice(info), "neutral")}
    </section>

    <section class="calendar-reference">
      <div>
        <p class="section-kicker">${t.source}</p>
        <h2>${t.sourceTitle}</h2>
      </div>
      <p>
        ${t.sourceCopy(getCalendarSourceNote())}
      </p>
      <p class="calendar-reference-note">
        ${t.sourceNote}
      </p>
    </section>
  `;
}

function renderEventList(info) {
  const events = info.events.length ? info.events : [{ title: t.noEvents, tone: "quiet" }];
  return `
    <div class="event-list">
      ${events.map((event) => `<span class="event-pill is-${event.tone}">${event.title}</span>`).join("")}
    </div>
  `;
}

function renderAstroWheel(info) {
  const labels = thaiMonthNames.map((month) => month.slice(0, 3));
  const markers = [
    { label: "อา", angle: 15, tone: "sun" },
    { label: "จ", angle: (info.lunar.tithi / 30) * 360, tone: "moon" },
    { label: "ว", angle: info.weekday * (360 / 7), tone: "weekday" },
    { label: toThaiNumeral(info.zodiac.number), angle: info.zodiac.number * 30, tone: "zodiac" },
  ];

  return `
    <svg class="astro-wheel" viewBox="0 0 420 420" role="img" aria-label="แผนภาพวัน ${formatThaiDate(info)}">
      <defs>
        <radialGradient id="calendarWheelGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#f7e6b8" stop-opacity=".42"></stop>
          <stop offset="58%" stop-color="#174637" stop-opacity=".18"></stop>
          <stop offset="100%" stop-color="#2e1715" stop-opacity=".08"></stop>
        </radialGradient>
      </defs>
      <circle cx="210" cy="210" r="190" class="wheel-outer"></circle>
      <circle cx="210" cy="210" r="154" class="wheel-ring"></circle>
      <circle cx="210" cy="210" r="104" class="wheel-ring muted"></circle>
      <circle cx="210" cy="210" r="50" class="wheel-core"></circle>
      ${Array.from({ length: 12 }, (_, index) => renderWheelSegment(index, labels[index])).join("")}
      ${markers.map((marker) => renderMarker(marker)).join("")}
      <text x="210" y="202" text-anchor="middle" class="wheel-core-text">${toThaiNumeral(info.lunar.day)}</text>
      <text x="210" y="228" text-anchor="middle" class="wheel-core-small">${info.lunar.phase}</text>
    </svg>
  `;
}

function renderWheelSegment(index, label) {
  const angle = index * 30 - 90;
  const x2 = 210 + Math.cos((angle * Math.PI) / 180) * 188;
  const y2 = 210 + Math.sin((angle * Math.PI) / 180) * 188;
  const labelAngle = (index * 30 - 75) * (Math.PI / 180);
  const lx = 210 + Math.cos(labelAngle) * 174;
  const ly = 210 + Math.sin(labelAngle) * 174;

  return `
    <line x1="210" y1="210" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" class="wheel-spoke"></line>
    <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" class="wheel-label">${label}</text>
  `;
}

function renderMarker(marker) {
  const radians = (marker.angle - 90) * (Math.PI / 180);
  const x = 210 + Math.cos(radians) * 132;
  const y = 210 + Math.sin(radians) * 132;
  const x2 = 210 + Math.cos(radians) * 188;
  const y2 = 210 + Math.sin(radians) * 188;

  return `
    <line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" class="marker-line is-${marker.tone}"></line>
    <circle cx="${x2.toFixed(2)}" cy="${y2.toFixed(2)}" r="17" class="wheel-marker is-${marker.tone}"></circle>
    <text x="${x2.toFixed(2)}" y="${(y2 + 6).toFixed(2)}" text-anchor="middle" class="marker-text">${marker.label}</text>
  `;
}

function renderOmenCard(title, items, tone) {
  return `
    <article class="omen-card is-${tone}">
      <h2>${title}</h2>
      <ul>
        ${items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </article>
  `;
}

function getGoodReadings(info) {
  const readings = [];
  const goodMarkers = info.dithi.filter((marker) => marker.tone === "auspicious" || marker.tone === "power");
  goodMarkers.forEach((marker) => readings.push(`${marker.name}: ${marker.description}`));
  if (info.isWanPhra) readings.push("วันพระ: เหมาะกับการทำบุญ สวดมนต์ เจริญสติ และตั้งสัตย์ปฏิญาณที่สงบ");
  if (info.floating?.name !== "วันจม") readings.push(`${info.floating.name}: ${info.floating.good}`);
  if (!readings.length) readings.push("เหมาะกับงานทั่วไปที่เตรียมข้อมูลครบและไม่เร่งเกินจังหวะ");
  return readings;
}

function getAvoidReadings(info) {
  const avoid = info.dithi.filter((marker) => marker.tone === "avoid" || marker.tone === "watch");
  const items = avoid.map((marker) => `${marker.name}: ${marker.description}`);
  if (info.floating?.name === "วันจม") items.push(`${info.floating.name}: ${info.floating.good}`);
  return items.slice(0, 4);
}

function getAdvice(info) {
  const planet = weekdayPlanetNames[info.weekday];
  return [
    `บูชาพระประจำวัน${info.weekdayName}หรือภาวนาโดยตั้งจิตกับพลังดาว${planet}`,
    `งานสำคัญควรตรวจวันเกิดของเจ้างาน ฤกษ์ยาม และทิศทางประกอบ ไม่ใช้ดิถีวันเดียวตัดสินทั้งหมด`,
    `หากเป็นวันมีข้อห้าม ให้เปลี่ยนเป็นงานเตรียมเอกสาร สำรวจพื้นที่ หรือสวดมนต์ก่อนเริ่มจริง`,
  ];
}

function renderMoonIcon(type) {
  return `<i class="moon-icon moon-${type}" aria-hidden="true"></i>`;
}

function toIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
