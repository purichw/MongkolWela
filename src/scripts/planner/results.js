export function createPlannerResults({ formatDistance, formatMinutes, formatClock, escapeHtml, formatDistanceRange, formatMinutesRange, buildSingleMapUrl }) {
function renderSummary(details) {
  return [
    ["จำนวนสถานที่", `${details.stops.length.toLocaleString("th-TH")} แห่ง`],
    ["ระยะทางประมาณ", formatDistance(details.totalRoadKm)],
    ["เวลาเดินทาง", formatMinutes(details.totalTravel)],
    ["เวลารวมทั้งแผน", `${formatMinutes(details.totalMinutes)} · ถึงประมาณ ${formatClock(details.endMinutes)}`],
  ]
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderWarnings(details, elements) {
  if (!details.warnings.length) {
    elements.warnings.hidden = true;
    elements.warnings.innerHTML = "";
    return;
  }
  elements.warnings.hidden = false;
  elements.warnings.innerHTML = `
    <strong>ควรตรวจแผนนี้อีกครั้ง</strong>
    <ul>${details.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`;
}

function renderTimelineItem(item, index, details, totalStops) {
  const stop = details.stops[index];
  const leg = stop.nextLeg;
  const reason = item.blessings.slice(0, 2).join(" · ") || "ไหว้พระและเสริมสิริมงคล";
  const legText = leg
    ? `
      <div class="planner-timeline__leg">
        <span>ไปจุดถัดไป</span>
        <strong>${formatDistanceRange(leg)} · ${formatMinutesRange(leg)}</strong>
      </div>`
    : "";
  const startLeg = index === 0 && stop.before
    ? `<p class="planner-timeline__start-leg">จากจุดเริ่มต้นประมาณ ${formatDistanceRange(stop.before)} · ${formatMinutesRange(stop.before)}</p>`
    : "";

  return `
    <li class="planner-timeline__item" draggable="true" data-planner-stop="${escapeHtml(item.id)}">
      <div class="planner-timeline__rail">
        <span>${(index + 1).toLocaleString("th-TH")}</span>
      </div>
      <article>
        <div class="planner-timeline__time">
          <span>คาดว่าจะถึง</span>
          <strong>${formatClock(stop.arrival)}</strong>
        </div>
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy" decoding="async">
        <div class="planner-timeline__copy">
          <span>${escapeHtml(item.region)} · ${escapeHtml(item.province)}</span>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(reason)}</p>
          ${startLeg}
          <div class="planner-timeline__meta">
            <span>ใช้เวลาประมาณ ${formatMinutes(stop.visitMinutes)}</span>
            <span>ออกประมาณ ${formatClock(stop.departure)}</span>
          </div>
          <div class="planner-timeline__links">
            <a href="${escapeHtml(item.detailUrl)}">ดูรายละเอียด</a>
            <a href="${buildSingleMapUrl(item)}" target="_blank" rel="noopener">เปิดพิกัด</a>
          </div>
        </div>
        <div class="planner-timeline__controls" aria-label="จัดลำดับ ${escapeHtml(item.name)}">
          <button type="button" data-planner-move="up" aria-label="เลื่อนขึ้น" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-planner-move="down" aria-label="เลื่อนลง" ${index === totalStops - 1 ? "disabled" : ""}>↓</button>
          <button type="button" data-planner-replace aria-label="เปลี่ยนสถานที่">เปลี่ยน</button>
        </div>
        ${legText}
      </article>
    </li>`;
}

return { renderSummary, renderWarnings, renderTimelineItem };
}
