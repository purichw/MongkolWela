import {
  createThaiDayInfo,
  formatLunarLabel,
  formatLunarMonthName,
  formatThaiDate,
  parseIsoDate,
  thaiMonthNames,
  toThaiNumeral,
  weekdayPlanetNames,
} from "./thai-calendar-core.js";
import { imageCreditUrl } from "../lib/home-hero-media.js";
import { renderIconMedallion } from "../lib/ui-markup.js";

const detailRoot = document.querySelector("[data-calendar-day-detail]");

if (detailRoot) {
  try {
    initDayDetail();
  } catch (error) {
    detailRoot.dataset.state = "error";
    detailRoot.querySelector("[data-day-content]").innerHTML = '<p role="alert">ไม่สามารถแสดงข้อมูลวันนี้ได้ <a href="">ลองอีกครั้ง</a> หรือ <a href="/calendar/">กลับสู่ปฏิทิน</a></p>';
    console.error("Calendar day could not render", error);
  }
}

function icon(name) {
  return detailRoot.querySelector(`[data-day-symbol="${name}"]`)?.innerHTML || "";
}

function medallion(name, tone = "gold") {
  return renderIconMedallion(icon(name), `day-medallion is-${tone}`);
}

function panelHeading(name, title, subtitle, id = "") {
  return `<div class="day-panel-heading">${medallion(name)}<div><h2 ${id ? `id="${id}"` : ""}>${title}</h2><p>${subtitle}</p></div></div>`;
}

function initDayDetail() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("date") || "";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? parseIsoDate(requested) : null;
  const valid = parsed && Number.isFinite(parsed.getTime()) && toIso(parsed) === requested
    && parsed.getFullYear() >= 1757 && parsed.getFullYear() <= 2157;
  const date = valid ? parsed : new Date();
  const info = createThaiDayInfo(date);
  const previous = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const calendarHref = `/calendar/?year=${info.beYear}&month=${date.getMonth() + 1}`;

  document.title = `${formatThaiDate(info)} | ปฏิทินไทย มงคลเวลา`;
  detailRoot.querySelector("[data-day-hero]").innerHTML = `
      <nav class="page-banner__breadcrumb" aria-label="เส้นทางนำทาง">
        <a href="/">หน้าแรก</a><span aria-hidden="true">/</span>
        <a href="${calendarHref}">ปฏิทินไทย</a><span aria-hidden="true">/</span>
        <span aria-current="page">${formatThaiDate(info)}</span>
      </nav>
      <div class="page-banner__copy">
        <p class="day-eyebrow page-banner__kicker">${icon("calendar-days")} รายละเอียดวัน</p>
        <h1 id="day-title">วันที่ ${formatThaiDate(info)}</h1>
        <p class="page-banner__subtitle">${info.weekdayName} ${formatLunarLabel(info.lunar, info.zodiac.name)}</p>
      </div>
      <div class="day-hero-bottom">
        <p class="day-reflection">“ทุกวัน คือ โอกาสดีในการทำสิ่งดี”</p>
        <nav class="day-nav" aria-label="เลือกวัน">
          ${dayLink(previous, "วันก่อนหน้า", "arrow-left", "previous")}
          <a href="${calendarHref}" data-day-back>${icon("calendar-days")}<span>กลับสู่ปฏิทิน</span></a>
          ${dayLink(next, "วันถัดไป", "arrow-right", "next")}
        </nav>
      </div>
  `;
  detailRoot.querySelector("[data-day-content]").innerHTML = `
    ${requested && !valid ? '<p class="day-input-note" role="status">วันที่ในลิงก์ไม่ถูกต้องหรืออยู่นอกช่วง พ.ศ. 2300–2700 จึงแสดงข้อมูลวันนี้</p>' : ""}
    <section class="day-primary-grid" aria-label="ข้อมูลของวันที่เลือก">
      <article class="day-panel day-reading-panel" aria-labelledby="day-facts-title">
        <div class="day-reading-header">
          ${panelHeading("calendar-days", "ข้อมูลปฏิทิน", "ข้อมูลตามปฏิทินไทย", "day-facts-title")}
          <span class="day-phase">${renderMoonIcon(info.lunar.moon)}<span>${info.lunar.phase} ${toThaiNumeral(info.lunar.day)} ค่ำ</span></span>
        </div>
        <dl class="day-facts">
          ${renderFact("moon-star", "เดือน", formatLunarMonthName(info.lunar))}
          ${renderFact("orbit", "ปีนักษัตร", `ปี${info.zodiac.name}`)}
          ${renderFact("coins", "จ.ศ.", info.chulaSakarat)}
          ${renderFact("compass", "ม.ศ.", info.mahasakarat)}
          ${renderFact("layers-2", "ร.ศ.", info.rattanakosinSok)}
          ${renderFact("calendar-days", "ประเภทปี", info.yearType)}
        </dl>
        <div class="day-events">${icon("book-open")}<div><span class="day-fact-label">หมายเหตุ</span>${renderEventList(info)}</div></div>
      </article>
      <article class="day-panel day-wheel-panel" aria-labelledby="day-wheel-title">
        ${panelHeading("compass", "จักรวันและดิถี", "แผนภาพวันและจันทรคติเชิงสัญลักษณ์", "day-wheel-title")}
        <div class="day-wheel-layout" id="day-wheel-layout">
          <figure class="day-wheel-figure">
            <button type="button" class="day-wheel-expand" data-day-wheel-expand aria-expanded="false" aria-controls="day-wheel-layout" aria-label="ขยายแผนภาพ" title="ขยายแผนภาพ">${icon("maximize-2")}</button>
            ${renderAstroWheel(info)}
            <figcaption class="day-wheel-key"><span>อา · จุดอ้างอิง</span><span>จ · ดิถี</span><span>ว · วันในสัปดาห์</span><span>${toThaiNumeral(info.zodiac.number)} · ปีนักษัตร</span></figcaption>
          </figure>
          <aside class="day-wheel-explanation">
            <h3>ความหมายโดยสังเขป</h3>
            <p>วงรอบวัน ดิถี และปีนักษัตร สำหรับอ่านปฏิทินเบื้องต้น ไม่ใช่ตำแหน่งดาวจริงหรือดวงชะตา</p>
            <blockquote>“เข้าใจจังหวะของเวลา<br />เพื่อใช้ชีวิตอย่างสมดุล”</blockquote>
          </aside>
        </div>
      </article>
    </section>
    <section class="day-guidance" aria-labelledby="day-guidance-title">
      <div class="day-guidance-mobile-heading">${panelHeading("lightbulb", "คำแนะนำสำหรับวันนี้", "แนวทางการใช้วันอย่างสมดุล", "day-guidance-title")}</div>
      <div class="day-omen-grid">
        ${renderOmenCard("ฤกษ์ที่เกื้อหนุน", "เหมาะสำหรับกิจกรรมต่อไปนี้", getGoodReadings(info), "good", "leaf")}
        ${renderOmenCard("ข้อควรหลีกเลี่ยง", "สิ่งที่ควรระมัดระวังเป็นพิเศษ", getAvoidReadings(info), "avoid", "ban")}
        ${renderOmenCard("คำแนะนำสำหรับวันที่เลือก", "แนวทางการใช้วันอย่างสมดุล", getAdvice(info), "neutral", "lightbulb")}
      </div>
    </section>
    <aside class="day-use-note" aria-label="ข้อควรทราบ">
      <p>ใช้ประกอบการวางแผนเบื้องต้น ไม่ใช่คำทำนายเฉพาะบุคคล ควรตรวจสอบวันพระและวันสำคัญกับปฏิทินหรือประกาศทางการก่อนใช้งานจริง</p>
      <p class="day-media-credit" data-day-media-credit hidden></p>
    </aside>
  `;
  const desktop = matchMedia("(min-width: 951px)");
  const syncDisclosures = () => {
    detailRoot.querySelectorAll("[data-day-disclosure]").forEach(panel => { panel.open = desktop.matches; });
  };
  syncDisclosures();
  desktop.addEventListener("change", syncDisclosures);
  const expand = detailRoot.querySelector("[data-day-wheel-expand]");
  expand.addEventListener("click", () => {
    const expanded = expand.getAttribute("aria-expanded") !== "true";
    expand.setAttribute("aria-expanded", String(expanded));
    expand.setAttribute("aria-label", expanded ? "ย่อแผนภาพ" : "ขยายแผนภาพ");
    expand.title = expanded ? "ย่อแผนภาพ" : "ขยายแผนภาพ";
    detailRoot.querySelector(".day-wheel-layout").classList.toggle("is-expanded", expanded);
  });
  const hero = detailRoot.querySelector("[data-cms-media]");
  const fallback = () => {
    if (hero && !hero.src.endsWith(hero.dataset.fallbackSrc)) {
      hero.removeAttribute("srcset");
      hero.src = hero.dataset.fallbackSrc;
    }
  };
  hero?.addEventListener("error", fallback);
  if (hero?.complete && !hero.naturalWidth) fallback();
  const syncCredit = () => {
    const credit = detailRoot.querySelector("[data-day-media-credit]");
    credit.replaceChildren();
    credit.hidden = !hero?.dataset.imageCredit || hero.src.endsWith(hero.dataset.fallbackSrc);
    if (credit.hidden) return;
    credit.append("ภาพ: ");
    for (const [label, href] of [[hero.dataset.imageCredit, hero.dataset.imageSource], [hero.dataset.imageLicense, hero.dataset.imageLicenseUrl]]) {
      if (!label) continue;
      const safeHref = imageCreditUrl(href);
      const element = document.createElement(safeHref ? "a" : "span");
      element.textContent = label;
      if (safeHref) element.setAttribute("href", safeHref);
      credit.append(element, " ");
    }
  };
  syncCredit();
  hero?.addEventListener("load", syncCredit);
  document.addEventListener("mw:cms-content-ready", syncCredit);
  document.addEventListener("mw:cms-content-checked", syncCredit);
  detailRoot.dataset.state = "ready";
  detailRoot.dataset.date = info.iso;
}

function dayLink(date, label, symbol, direction) {
  const content = direction === "previous" ? `${icon(symbol)}<span>${label}</span>` : `<span>${label}</span>${icon(symbol)}`;
  return date.getFullYear() < 1757 || date.getFullYear() > 2157
    ? `<span class="day-nav-disabled" aria-disabled="true">${content}</span>`
    : `<a href="/calendar/day/?date=${toIso(date)}" data-day-${direction}>${content}</a>`;
}

function renderFact(symbol, label, value) {
  return `<div><dt>${medallion(symbol)}<span>${label}</span></dt><dd>${value}</dd></div>`;
}

function renderEventList(info) {
  const events = info.events.length ? info.events : [{ title: "ไม่มีวันหยุดหรือเทศกาลหลักในวันนี้", tone: "quiet" }];
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
    <svg class="astro-wheel" viewBox="0 0 420 420" role="img" aria-labelledby="day-wheel-svg-title day-wheel-svg-desc">
      <title id="day-wheel-svg-title">แผนภาพวัน ${formatThaiDate(info)}</title>
      <desc id="day-wheel-svg-desc">วงรอบเชิงสัญลักษณ์: วัน${info.weekdayName} ${formatLunarLabel(info.lunar, info.zodiac.name)} ไม่ใช่ตำแหน่งดาวจริง</desc>
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
      ${Array.from({ length: 12 }, (_, index) => renderWheelSegment(index, labels[index])).join("")}
      <circle cx="210" cy="210" r="50" class="wheel-core"></circle>
      ${markers.map((marker) => renderMarker(marker)).join("")}
      <text x="210" y="206" text-anchor="middle" class="wheel-core-text">${toThaiNumeral(info.lunar.day)}</text>
      <text x="210" y="229" text-anchor="middle" class="wheel-core-small">${info.lunar.phase} ${toThaiNumeral(info.lunar.day)} ค่ำ</text>
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

function renderOmenCard(title, subtitle, items, tone, symbol) {
  return `
    <details class="day-omen is-${tone}" data-day-disclosure open>
      <summary>${medallion(symbol, tone)}<span><h3>${title}</h3><span>${subtitle}</span></span>${icon("chevron-down")}</summary>
      <ul>
        ${items.length ? items.map((item) => `<li>${item}</li>`).join("") : '<li>ไม่พบข้อควรหลีกเลี่ยงเฉพาะจากกฎดิถีวันนี้ ควรพิจารณาปัจจัยอื่นประกอบ</li>'}
      </ul>
    </details>
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
  return `<i class="day-moon moon-${type}" aria-hidden="true"></i>`;
}

function toIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
