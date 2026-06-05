import { formatThaiDate } from "./life-graph-engine.js?v=20260605-9";

const chart = {
  width: 920,
  height: 470,
  padLeft: 62,
  padRight: 32,
  padTop: 32,
  padBottom: 86,
};

export function renderLifeGraph(result) {
  const points = getPoints(result.houses);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x} ${chart.height - chart.padBottom} L ${points[0].x} ${chart.height - chart.padBottom} Z`;

  return `
    <section class="life-reading-head">
      <div>
        <p class="section-kicker">ผลกราฟชีวิต</p>
        <h2>${result.name}</h2>
        <p>
          เกิด ${formatThaiDate(result.birthDate)} เวลา ${result.birthTime}
          • อ่านจรตั้งแต่ ${formatThaiDate(result.transitDate)}
        </p>
        <p class="calendar-source">
          ${result.calendar.lunarLabel} • ปี${result.calendar.zodiacName}
          • แหล่งปฏิทิน: ${result.calendar.source}
        </p>
      </div>
      <div class="life-score">
        <span>${result.summary.tone}</span>
        <strong>${result.summary.average}</strong>
        <small>ค่าเฉลี่ย 12 เรือน</small>
      </div>
    </section>

    <section class="life-chart-card">
      <div class="life-chart-toolbar">
        <div>
          <strong>กราฟ 12 เรือน</strong>
          <span>จุดสูง: ${result.summary.strongest.label} • จุดต่ำ: ${result.summary.weakest.label}</span>
        </div>
      </div>
      ${renderSvg(points, path, areaPath)}
    </section>

    <section class="life-table-card">
      <h3>ตารางฐาน 12</h3>
      ${renderBasisTable(result)}
    </section>

    <section class="life-house-list">
      <h3>คำอ่านรายเรือน</h3>
      <div class="life-house-grid">
        ${result.houses.map(renderHouseCard).join("")}
      </div>
    </section>
  `;
}

function renderSvg(points, path, areaPath) {
  const horizontal = Array.from({ length: 12 }, (_, index) => {
    const level = index + 1;
    const y = yForValue(level);
    const isMajor = level === 4 || level === 8 || level === 12;
    return `
      <g>
        <line class="${isMajor ? "major" : ""}" x1="${chart.padLeft}" y1="${y}" x2="${chart.width - chart.padRight}" y2="${y}"></line>
        <text x="${chart.padLeft - 18}" y="${y + 4}">${level}</text>
      </g>
    `;
  }).join("");

  const vertical = points.map((point) => `
    <g>
      <line x1="${point.x}" y1="${chart.padTop}" x2="${point.x}" y2="${chart.height - chart.padBottom}"></line>
      <text class="x-label" x="${point.x}" y="${chart.height - 48}">${point.house.shortLabel}</text>
      <text class="x-period" x="${point.x}" y="${chart.height - 28}">${point.house.period.label}</text>
    </g>
  `).join("");

  const markers = points.map((point) => `
    <button class="life-point ${point.house.band.tone}" type="button" data-life-house="${point.house.id}" style="--x:${point.x}; --y:${point.y};">
      <span>${point.house.value}</span>
    </button>
  `).join("");

  return `
    <div class="life-chart-wrap">
      <svg class="life-chart" viewBox="0 0 ${chart.width} ${chart.height}" role="img" aria-label="กราฟชีวิต 12 เรือน">
        <g class="life-grid">${horizontal}${vertical}</g>
        <path class="life-area" d="${areaPath}"></path>
        <path class="life-line-shadow" d="${path}"></path>
        <path class="life-line" d="${path}"></path>
      </svg>
      <div class="life-point-layer" aria-label="เลือกจุดบนกราฟ">
        ${markers}
      </div>
    </div>
  `;
}

function renderBasisTable(result) {
  const columns = result.houses.map((house) => `<th scope="col">${house.shortLabel}</th>`).join("");

  return `
    <div class="life-basis-table-wrap">
      <table class="life-basis-table">
        <thead>
          <tr>
            <th scope="col">ฐาน</th>
            ${columns}
          </tr>
        </thead>
        <tbody>
          ${renderBasisRow("ฐานวัน", result.rows.day)}
          ${renderBasisRow("ฐานเดือน", result.rows.month)}
          ${renderBasisRow("ฐานปี", result.rows.year)}
          ${renderBasisRow("ผลรวม", result.rows.total)}
          ${renderBasisRow("เลขดวง", result.rows.graph, "is-graph-row")}
        </tbody>
      </table>
    </div>
  `;
}

function renderBasisRow(label, values, className = "") {
  return `
    <tr class="${className}">
      <th scope="row">${label}</th>
      ${values.map((value) => `<td>${value}</td>`).join("")}
    </tr>
  `;
}

function renderHouseCard(house) {
  return `
    <article class="life-house-card" data-life-house-card="${house.id}">
      <div>
        <span>${String(house.index + 1).padStart(2, "0")}</span>
        <strong>${house.label}</strong>
      </div>
      <p>${house.field}</p>
      <div class="house-score ${house.band.tone}">
        <b>${house.value}</b>
        <span>${house.band.label}</span>
      </div>
      <p>${house.reading}</p>
      <small>${house.period.label} • อายุประมาณ ${house.age} ปี</small>
    </article>
  `;
}

function getPoints(houses) {
  const usableWidth = chart.width - chart.padLeft - chart.padRight;
  const step = usableWidth / (houses.length - 1);

  return houses.map((house, index) => ({
    house,
    x: chart.padLeft + step * index,
    y: yForValue(house.value),
  }));
}

function yForValue(value) {
  const usableHeight = chart.height - chart.padTop - chart.padBottom;
  return chart.padTop + ((12 - value) / 11) * usableHeight;
}
