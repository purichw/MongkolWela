import { formatThaiDate } from "./life-graph-engine.js";
import { renderIcon, renderIconMedallion } from "../lib/ui-markup.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

export function renderLifeGraph(result, { compact = false, sample = false } = {}) {
  return `
    <section class="life-reading-head" aria-labelledby="life-result-title">
      <div class="life-person">
        ${renderIconMedallion(renderIcon("users"), "life-avatar")}
        <div><p class="life-result-eyebrow">${sample ? "ตัวอย่างผลจากข้อมูลเริ่มต้น" : "ผลการอ่านกราฟชีวิต"}</p>
        <h2 id="life-result-title" tabindex="-1">${escapeHtml(result.name)}</h2></div>
        <p class="life-person-meta">เกิด ${formatThaiDate(result.birthDate)} เวลา ${escapeHtml(result.birthTime)} น. <span>· อ่านจร ${formatThaiDate(result.transitDate)}</span></p>
        <p class="calendar-source">${escapeHtml(result.calendar.lunarLabel)} · ปี${escapeHtml(result.calendar.zodiacName)} · แหล่งปฏิทิน: ${escapeHtml(result.calendar.source)}</p>
      </div>
      <div class="life-score"><span>คะแนนภาพรวม</span><strong>${result.summary.average}</strong><small>ค่าเฉลี่ย 12 เรื่อง</small></div>
      <button type="button" class="life-share" data-life-share>${renderIcon("share-2")} แชร์ผลลัพธ์</button>
    </section>
    <p class="life-result-status" data-life-status role="status"></p>
    <section class="life-chart-card" aria-labelledby="life-table-title">
      <div class="life-table-section">
      <header class="life-chart-toolbar"><h3 id="life-table-title">ตารางและกราฟชีวิต</h3><p>จุดสูง: ${escapeHtml(result.summary.strongest.label)} · จุดต่ำ: ${escapeHtml(result.summary.weakest.label)}</p></header>
      <div class="life-table-desktop">${scoreTable(result.houses)}</div>
      <div class="life-table-mobile">${scoreTable(result.houses.slice(0, 6), true)}${scoreTable(result.houses.slice(6), true)}</div>
      </div>
      <div class="life-plot-section">
        <div class="life-plot-heading"><h3>กราฟชีวิต 12 เรื่อง</h3><div class="life-legend"><span>คะแนน</span><span>ค่าเฉลี่ย</span></div></div>
        <div data-life-plot>${renderLifeChart(result, compact)}</div>
      </div>
    </section>
    <section class="life-house-list" aria-labelledby="life-houses-title">
      <h3 id="life-houses-title">คำอธิบายรายเรื่อง 12 เรื่อง</h3>
      <div class="life-house-grid">${result.houses.map(renderHouseCard).join("")}</div>
    </section>
    <details class="life-basis-details"><summary>${renderIcon("layers-2")} ดูฐานคำนวณ <span>วัน · เดือน · ปี</span>${renderIcon("chevron-down")}</summary>
      <div class="life-basis-table-wrap" tabindex="0" role="region" aria-label="ตารางฐานคำนวณ 12 เรื่อง">${renderBasisTable(result)}</div>
      <p>เวลาเกิดยังไม่ส่งผลต่อเลขฐานนี้ วันจรใช้กำหนดช่วงเดือนของคำอ่าน</p>
    </details>
    <dialog class="life-share-dialog" aria-labelledby="life-share-title">
      <form method="dialog"><h2 id="life-share-title">แชร์ผลกราฟชีวิต</h2><button aria-label="ปิด" class="life-dialog-close">${renderIcon("x")}</button></form>
      <p>แชร์เฉพาะคะแนนและวันจร โดยไม่แนบชื่อ วันเกิด หรือเวลาเกิด</p>
      <textarea readonly aria-label="ข้อความผลลัพธ์ที่จะแชร์">${escapeHtml(createShareText(result))}</textarea>
      <button type="button" class="primary-action" data-life-share-confirm>${renderIcon("share-2")} แชร์หรือคัดลอกผลลัพธ์</button>
      <p data-life-share-status role="status"></p>
    </dialog>
  `;
}

function scoreTable(houses, compact = false) {
  return `<table class="life-score-table"><caption class="sr-only">คะแนนกราฟชีวิต เรื่อง ${houses[0].index + 1} ถึง ${houses.at(-1).index + 1}</caption>
    <thead><tr><th scope="col">เรื่อง</th>${houses.map(h => `<th scope="col" title="${h.label}">${compact ? h.index + 1 : h.label}</th>`).join("")}</tr></thead>
    <tbody><tr><th scope="row">คะแนน</th>${houses.map(h => `<td data-life-score="${h.id}">${h.value}</td>`).join("")}</tr></tbody></table>`;
}

export function renderLifeChart(result, compact = false) {
  const width = compact ? 352 : 960;
  const height = compact ? 316 : 164;
  const left = compact ? 30 : 32, right = compact ? 18 : 24, top = 23, bottom = 30;
  const y = value => top + (12 - value) / 12 * (height - top - bottom);
  const points = result.houses.map((house, i) => ({ house, x: left + i * (width - left - right) / 11, y: y(house.value) }));
  const horizontal = Array.from({ length: 7 }, (_, i) => i * 2).map(value => `
    <line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/>
    <text class="life-y-label" x="${left - 10}" y="${y(value) + 4}">${value}</text>`).join("");
  const vertical = points.map(({ house, x }) => `<line x1="${x}" x2="${x}" y1="${top}" y2="${height - bottom}"/>
    <text class="life-x-label" x="${x}" y="${height - 10}">${compact ? house.index + 1 : house.label}</text>`).join("");
  const markers = points.map(({ house, x, y: py }) => `
    <g class="life-point ${house.band.tone}" role="button" tabindex="0" data-life-house="${house.id}" aria-label="${house.index + 1} ${house.label} ${house.value} คะแนน ${house.band.label}" aria-controls="life-house-${house.id}">
      <rect class="life-point-hit" x="${x - 12}" y="${py - 22}" width="24" height="44" rx="8"/>
      <circle cx="${x}" cy="${py}" r="4.5"/>
      <text x="${x}" y="${py - 10}">${house.value}</text>
    </g>`).join("");
  return `<svg class="life-chart" viewBox="0 0 ${width} ${height}" role="group" aria-label="กราฟชีวิต 12 เรื่อง คะแนน 1 ถึง 12">
    <g class="life-grid">${horizontal}${vertical}</g>
    <line class="life-average" x1="${left}" x2="${width - right}" y1="${y(result.summary.average)}" y2="${y(result.summary.average)}"><title>ค่าเฉลี่ย ${result.summary.average}</title></line>
    <path class="life-line" d="${points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ")}"/>
    ${markers}
  </svg>`;
}

function renderHouseCard(house) {
  return `<details class="life-house-card" id="life-house-${house.id}" data-life-house-card="${house.id}">
    <summary><span class="life-house-number">${String(house.index + 1).padStart(2, "0")}</span>
      <strong>${house.label}</strong><span class="house-score ${house.band.tone}">${house.band.label}</span>
      ${renderIcon("chevron-right", "life-house-chevron")}<span class="life-house-field">${house.field}</span><small>${house.period.label}</small>
    </summary>
    <div class="life-house-reading"><b>${house.value} / 12 คะแนน</b><p>${house.reading}</p><small>${house.period.label} · อายุประมาณ ${house.age} ปี</small></div>
  </details>`;
}

function renderBasisTable(result) {
  const row = (label, values) => `<tr><th scope="row">${label}</th>${values.map(v => `<td>${v}</td>`).join("")}</tr>`;
  return `<table class="life-basis-table"><thead><tr><th scope="col">ฐาน</th>${result.houses.map(h => `<th scope="col">${h.label}</th>`).join("")}</tr></thead>
    <tbody>${row("ฐานวัน", result.rows.day)}${row("ฐานเดือน", result.rows.month)}${row("ฐานปี", result.rows.year)}${row("ผลรวม", result.rows.total)}${row("เลขดวง", result.rows.graph)}</tbody></table>`;
}

export function createShareText(result) {
  return [
    "กราฟชีวิต · มงคลเวลา",
    `วันจร ${formatThaiDate(result.transitDate)} · ค่าเฉลี่ย ${result.summary.average} / 12`,
    ...result.houses.map(house => `${house.label}: ${house.value}/12 · ${house.band.label}`),
    "คำอ่านตามความเชื่อ ใช้ประกอบการทบทวน ไม่ใช่คำยืนยันอนาคต",
  ].join("\n");
}
