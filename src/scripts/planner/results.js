import { sitePlaceholderImage } from "../../lib/image-placeholder.js";
import { renderIcon } from "../../lib/ui-markup.js";

export function createPlannerResults({ formatDistance, formatMinutes, formatClock, escapeHtml, formatDistanceRange, formatMinutesRange, buildSingleMapUrl }) {
  function renderSummary(details) {
    return [
      ["จำนวนสถานที่", details.stops.length + " แห่ง"],
      ["ระยะทางประมาณ", formatDistance(details.totalRoadKm)],
      ["เวลาเดินทางประมาณ", formatMinutes(details.totalTravel)],
      ["เวลาแวะประมาณ", formatMinutes(details.totalVisit)],
      ["รวม " + formatMinutes(details.totalMinutes) + " · ไม่รวมขากลับ", "จบประมาณ " + formatClock(details.endMinutes)],
    ].map(([label,value]) => "<div><span>" + label + "</span><strong>" + value + "</strong></div>").join("");
  }
  function renderWarnings(details, elements) {
    elements.warnings.hidden = !details.warnings.length;
    elements.warnings.innerHTML = details.warnings.length ? '<strong>' + renderIcon("info") + ' ควรตรวจแผนนี้อีกครั้ง</strong><ul>' + details.warnings.map(warning => "<li>" + escapeHtml(warning) + "</li>").join("") + "</ul>" : "";
  }
  function renderTimelineItem(item, index, details, totalStops) {
    const stop = details.stops[index], name = escapeHtml(item.name);
    const controls = [
      ["up", "เลื่อนขึ้น", index === 0, renderIcon("arrow-left", "planner-order-icon")],
      ["down", "เลื่อนลง", index === totalStops - 1, renderIcon("arrow-right", "planner-order-icon")],
    ].map(([direction,label,disabled,icon]) => '<button type="button" data-planner-move="' + direction + '" aria-label="' + label + " " + name + '" title="' + label + '" ' + (disabled ? "disabled" : "") + ">" + icon + "</button>").join("");
    const link = item.detailUrl && /^\/(?!\/)/.test(item.detailUrl) ? '<a href="' + escapeHtml(item.detailUrl) + '">ดูรายละเอียด</a>' : "";
    return `<li class="planner-timeline__item" data-planner-stop="${escapeHtml(item.id)}">
      <span class="planner-stop-number">${index + 1}</span>
      <article>
        <div class="planner-stop-main">
          <img width="64" height="64" data-fallback-src="${sitePlaceholderImage}" src="${escapeHtml(item.imageUrl || sitePlaceholderImage)}" alt="${escapeHtml(item.imageAlt || item.name)}" loading="lazy">
          <div><h3>${name}</h3><p>${escapeHtml([item.province,item.district].filter(Boolean).join(" · "))}</p></div>
        </div>
        <div class="planner-stop-times"><strong>ถึง ${formatClock(stop.arrival)} · ออก ${formatClock(stop.departure)}</strong><span>แวะ ${formatMinutes(stop.visitMinutes)}</span></div>
        ${stop.before && index === 0 ? '<p class="planner-timeline__start-leg">จากจุดเริ่มต้นประมาณ ' + formatDistanceRange(stop.before) + ' · ' + formatMinutesRange(stop.before) + '</p>' : ""}
        <details class="planner-stop-actions"><summary aria-label="รายละเอียดและปรับ ${name}" title="รายละเอียดและปรับสถานที่">${renderIcon("chevron-down")}</summary>
          <div class="planner-timeline__links">${link}<a href="${buildSingleMapUrl(item)}" target="_blank" rel="noopener">เปิดพิกัด</a></div>
          <div class="planner-timeline__controls">${controls}<button type="button" data-planner-replace>เปลี่ยนสถานที่</button><button type="button" data-planner-remove-stop aria-label="นำ ${name} ออกจากรายการที่เลือก">${renderIcon("x")} นำออก</button></div>
        </details>
        ${stop.nextLeg ? '<p class="planner-timeline__leg">' + renderIcon("route") + ' ประมาณ ' + formatDistanceRange(stop.nextLeg) + ' · ' + formatMinutesRange(stop.nextLeg) + '</p>' : ""}
      </article>
    </li>`;
  }
  return { renderSummary, renderWarnings, renderTimelineItem };
}
