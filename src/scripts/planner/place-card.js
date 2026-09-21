import { renderIcon } from "../../lib/ui-markup.js";
import { escapeHtml } from "./format.js";

const placeholder = "/assets/images/temple-placeholder-auspicious.png";
const blessingLabels = {
  "ความสำเร็จ/ก้าวหน้า": "ก้าวหน้า", "แคล้วคลาด/คุ้มครอง": "คุ้มครอง",
  "ความรัก/คู่ครอง": "ความรัก", "สติปัญญา/การเรียน": "ปัญญา",
  "การเงิน/ค้าขาย": "การเงิน", "สุขภาพ/อายุยืน": "สุขภาพ",
  "สะเดาะเคราะห์/แก้ชง": "แก้ชง",
};

// One presentational owner for desktop tiles and mobile rows; the picker owns selection.
export function renderPlannerPlaceCard(item, { selected = false, disabled = false } = {}) {
  const noImage = !item.imageUrl || item.imageUrl.includes("placeholder");
  const id = escapeHtml(item.id), name = escapeHtml(item.name);
  const image = noImage ? placeholder : item.imageUrl;
  const detail = item.detailUrl && /^\/(?!\/)/.test(item.detailUrl) ? item.detailUrl : "";
  const province = escapeHtml(item.province);
  const badges = (item.blessings || []).slice(0,2).map(value => '<span title="' + escapeHtml(value) + '" aria-label="' + escapeHtml(value) + '">' + escapeHtml(blessingLabels[value] || value) + '</span>').join("");
  return `<article class="planner-place-card ${selected ? "is-selected" : ""}" data-planner-place-card="${id}">
    <figure class="${noImage ? "is-placeholder" : ""}">
      <picture>${item.imageMobileUrl && !noImage ? '<source media="(max-width: 599px)" srcset="' + escapeHtml(item.imageMobileUrl) + '">' : ""}
      <img width="320" height="200" src="${escapeHtml(image)}" alt="${noImage ? "ยังไม่มีภาพสถานที่" : escapeHtml(item.imageAlt || item.name)}" loading="lazy" decoding="async"></picture>
      <span class="planner-place-card__area">${province}</span>
      <span class="planner-place-card__missing">ยังไม่มีภาพสถานที่</span>
    </figure>
    <div class="planner-place-card__body"><h3 title="${name}">${detail ? '<a href="' + escapeHtml(detail) + '">' + name + '</a>' : name}</h3>
      <p title="${escapeHtml([item.province,item.district].filter(Boolean).join(" · "))}"><span class="planner-place-card__province">${province}</span>${escapeHtml(item.district || item.province)}</p>
      <div class="planner-place-card__blessings">${badges}</div>
    </div>
    <button type="button" class="planner-card-toggle" data-planner-toggle-place="${id}" aria-pressed="${selected}" aria-disabled="${disabled}" title="${selected ? "นำออกจากรายการที่เลือก" : "เพิ่มในรายการที่เลือก"}" aria-label="${selected ? "นำ " + name + " ออกจากรายการที่เลือก" : "เพิ่ม " + name + " ในรายการที่เลือก"}"><span aria-hidden="true">${renderIcon(selected ? "minus" : "plus")}</span></button>
    ${selected ? '<span class="planner-card-status" aria-hidden="true">' + renderIcon("check") + '</span>' : ""}
  </article>`;
}
