import { houses, zodiacSigns, readingTemplates } from "./thai-astrology-data.js";
import { renderIcon } from "../lib/ui-markup.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const pad2 = (value) => String(value).padStart(2, "0");
const dateLabel = (date) => new Intl.DateTimeFormat("th-TH", { year: "numeric", month: "long", day: "numeric" }).format(date);

export function renderChart(chart, origin, reading) {
  const icon = (name) => renderIcon(name, "thai-reading-icon");
  return {
    heading: `
      <div class="thai-result-heading">
        ${icon("book-open")}
        <div><p class="section-kicker">${origin === "sample" ? "ข้อมูลตัวอย่าง · คำนวณโดยประมาณ" : "ผลคำนวณโดยประมาณ"}</p>
          <h2 id="thai-result-title" tabindex="-1">แผนผัง${reading.mode}</h2>
          <p>${escapeHtml(chart.name)} · เกิด ${dateLabel(chart.birthDate)} เวลา ${pad2(chart.birthHour)}:${pad2(chart.birthMinute)} น.</p>
          <p>วันจร ${dateLabel(chart.transitDate)}</p>
        </div>
      </div>
      <a class="thai-edit-link" data-edit-birth href="#thai-birth-form">${icon("pencil-line")} แก้ไขข้อมูลเกิด</a>
      <p class="thai-stale-notice" data-astro-stale hidden>ยังแสดงผลจากข้อมูลชุดก่อนหน้า รออัปเดตดวง</p>`,
    wheel: renderWheel(chart),
    overview: `
      <h3>${icon("sparkles")} ภาพรวมดวงนี้</h3>
      <p>${reading.overview}</p>
      <dl>
        <div><dt>${icon("calendar-days")} วันเกิด</dt><dd>${new Intl.DateTimeFormat("th-TH", { weekday: "long" }).format(chart.birthDate)}</dd></div>
        <div><dt>${icon("orbit")} ระบบคำนวณ</dt><dd>${reading.system}</dd></div>
        <div><dt>${icon("sunrise")} ดวงที่อ่าน</dt><dd>${reading.mode}</dd></div>
        <div><dt>${icon("moon-star")} จันทร์กำเนิด</dt><dd>${chart.moonSign.th}</dd></div>
        <div><dt>${icon("sparkles")} ดวงจรเด่น</dt><dd>${chart.activeHouse.th} · ${chart.activeHouse.topic}</dd></div>
      </dl>
      <p class="thai-provenance">สูตรประมาณเบื้องต้น ยังไม่ใช่สมผุสดาวที่ยืนยันด้วยปฏิทินโหร</p>
      <details class="thai-model-note"><summary>ขอบเขตการคำนวณ</summary><p>ชนิดดวงยังใช้สูตรพื้นฐานชุดเดียวกัน ไม่ใช่การคำนวณดวงจร อมาวสี หรือปูรณมีแบบเต็มระบบ วันจรมีผลต่อคำอ่านทุกชนิดดวง สถานที่เกิดใช้ค่าชดเชยโดยประมาณและวันที่อิงเขตเวลาของอุปกรณ์</p></details>`,
    planets: `
      <h3>สมผุสดาวโดยประมาณ</h3>
      <div class="thai-planet-table-wrap">
        <table class="thai-planet-table">
          <caption class="sr-only">ตำแหน่งดาวและความหมายจากข้อมูลที่ส่งคำนวณ</caption>
          <thead><tr><th scope="col">ดาว</th><th scope="col">ราศี</th><th scope="col">องศา</th><th scope="col">ภพ</th><th scope="col">ความหมาย</th></tr></thead>
          <tbody>${chart.planets.map(renderPlanetRow).join("")}</tbody>
        </table>
      </div>`,
    readings: `
      <div class="thai-reading-highlight"><h3>${icon("sprout")} ${reading.headline.title}</h3><p>${reading.headline.copy}</p></div>
      <h3>คำอ่านรายเรื่อง</h3>
      <div class="thai-reading-grid">
        ${renderReadingCard(readingTemplates.overview.title, reading.overview, "sunrise")}
        ${renderReadingCard(readingTemplates.career.title, reading.career, "briefcase-business")}
        ${renderReadingCard(readingTemplates.wealth.title, reading.wealth, "coins")}
        ${renderReadingCard(readingTemplates.relationship.title, reading.relationship, "heart")}
        ${renderReadingCard(readingTemplates.advice.title, reading.advice, "lightbulb")}
        ${renderReadingCard(readingTemplates.caution.title, reading.caution, "info")}
      </div>`,
  };
}

// Clockwise from the top, preserving the previous renderer's house orientation.
const housePositions = [
  [200, 70], [280, 78], [328, 122], [334, 200],
  [328, 278], [280, 322], [200, 330], [120, 322],
  [72, 278], [66, 200], [72, 122], [120, 78],
];

export function renderWheel(chart) {
  if (!chart.ascSign) return '<p class="thai-chart-unavailable">ยังไม่มีข้อมูลลัคนาสำหรับแสดงแผนผัง</p>';
  const signIndex = zodiacSigns.findIndex((item) => item.id === chart.ascSign.id);
  const houseCells = houses.map((house, index) => {
    const sign = zodiacSigns[(signIndex + index) % 12];
    const planets = chart.planets.filter((planet) => planet.houseIndex === index);
    const [x, y] = housePositions[index];
    return `<div class="thai-wheel-house" data-house-id="${house.id}" data-house-number="${index + 1}"
      style="--house-x:${x / 4}%;--house-y:${y / 4}%"
      aria-label="${escapeHtml(`ภพ ${index + 1} ${house.th} ราศี${sign.th}${planets.length ? ` ดาว${planets.map((p) => p.th).join(" ")}` : " ไม่มีดาว"}`)}">
      <span class="thai-house-number">${String(index + 1).replace(/\d/g, (n) => "๐๑๒๓๔๕๖๗๘๙"[n])}</span>
      <strong>${house.th}</strong>
      <span class="thai-house-planets" aria-hidden="true">${planets.slice(0, 2).map((planet) => `<b data-planet-id="${planet.id}" title="${escapeHtml(planet.th)}">${planet.glyph}</b>`).join("")}${planets.length > 2 ? `<small>+${planets.length - 2}</small>` : ""}</span>
    </div>`;
  }).join("");

  return `<figure class="thai-chart-figure">
    <div class="thai-chart-wheel" role="group" aria-label="ผังดวงโหราศาสตร์ไทย 12 ภพ">
      <svg class="thai-chart-lines" viewBox="0 0 400 400" aria-hidden="true">
        <defs><clipPath id="thai-wheel-clip"><circle cx="200" cy="200" r="176"/></clipPath></defs>
        <g class="thai-chart-ornaments" fill="none">
          ${[0, 90, 180, 270].map((angle) => `<g transform="rotate(${angle} 200 200)">
            <path d="M165 29 Q165 15 183 13 L200 1 L217 13 Q235 15 235 29 M175 26 Q178 18 187 18 L200 7 L213 18 Q222 18 225 26"/>
            <path d="M195 15 L200 9 L205 15 L200 21 Z"/>
          </g>`).join("")}
          <rect x="75.55" y="75.55" width="248.9" height="248.9" transform="rotate(45 200 200)"/>
          <rect x="75.55" y="75.55" width="248.9" height="248.9"/>
        </g>
        <circle cx="200" cy="200" r="176" fill="var(--tool-surface)"/>
        <g clip-path="url(#thai-wheel-clip)" fill="none">
          <path d="M152 0V400 M248 0V400 M0 152H400 M0 248H400"/>
          <path d="M0 0L400 400 M400 0L0 400"/>
        </g>
        <circle cx="200" cy="200" r="176" fill="none"/>
        <circle class="thai-chart-center-fill" cx="200" cy="200" r="63"/>
      </svg>
      <div class="thai-wheel-center"><span>ลัคนา</span><strong>${chart.ascSign.th}</strong></div>
      ${houseCells}
    </div>
    <figcaption>แผนผังภพแบบสรุป ไม่แสดงมุมดาวตามสัดส่วนจริง</figcaption>
    <a class="thai-chart-table-link" href="#thai-planet-positions">ดูตำแหน่งดาวทั้งหมด ${renderIcon("arrow-right")}</a>
  </figure>`;
}

function renderPlanetRow(planet) {
  return `<tr data-planet-row="${planet.id}">
    <th scope="row"><span class="thai-planet-glyph">${planet.glyph}</span>${planet.th}</th>
    <td data-label="ราศี">${planet.sign.th}</td>
    <td data-label="องศา">${planet.degree}°</td>
    <td data-label="ภพ">${planet.house.th}</td>
    <td class="thai-planet-role" data-label="ความหมาย">${planet.role}</td>
  </tr>`;
}

function renderReadingCard(title, text, icon) {
  return `<details class="thai-reading-card"><summary>${renderIcon(icon)}<span>${escapeHtml(title)}</span>${renderIcon("chevron-down")}</summary><p>${escapeHtml(text)}</p></details>`;
}
