import { renderIcon, escapeHtml as esc } from "./ui-markup.js";
import { sitePlaceholderImage, normalizePlaceholderImage } from "./image-placeholder.js";

function safeUrl(value, fallback = "") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try { const url = new URL(value, "https://mongkolwela.vercel.app"); return ["https:", "http:"].includes(url.protocol) ? value : fallback; } catch { return fallback; }
}

export function renderDirectoryPlaceCard(place) {
  const credit = safeUrl(place.imageSourceUrl);
  const image = normalizePlaceholderImage(safeUrl(place.image, sitePlaceholderImage));
  const mobile = normalizePlaceholderImage(safeUrl(place.imageMobile, sitePlaceholderImage));
  const caption = place.imageSourceLabel && place.imageSourceLabel !== "Placeholder"
    ? credit ? `<a href="${esc(credit)}" target="_blank" rel="noopener">${esc(place.imageSourceLabel)}</a>` : esc(place.imageSourceLabel)
    : "";
  return `<article class="directory-card place-card" data-place-card data-directory-key="${esc(place.key)}">
    <figure data-placeholder-desktop="${image === sitePlaceholderImage}" data-placeholder-mobile="${mobile === sitePlaceholderImage}">
      <picture>${mobile !== image ? `<source media="(max-width: 767px)" srcset="${esc(mobile)}">` : ""}<img src="${esc(image)}" alt="${esc(image === sitePlaceholderImage ? "ภาพประกอบแทนรูปที่ยังไม่มี" : place.imageAlt || place.name)}" width="480" height="250" loading="lazy" decoding="async" data-fallback-src="${sitePlaceholderImage}"></picture>
      <figcaption><span class="directory-image-credit">${caption}</span><span class="directory-image-missing">ยังไม่มีภาพสถานที่</span></figcaption>
    </figure>
    <div class="directory-card-body place-card__body">
      <p class="directory-locality place-card__locality">${renderIcon("map-pin")}${esc([place.province, place.district].filter(Boolean).join(" / ") || "ยังไม่ระบุพื้นที่")}</p>
      <h3>${esc(place.name)}</h3>
      ${place.summary ? `<p class="directory-summary">${esc(place.summary)}</p>` : ""}
      ${place.address ? `<details class="directory-address"><summary>ข้อมูลสถานที่ ${renderIcon("chevron-down")}</summary><p>${esc(place.address)}</p></details>` : ""}
      <div class="directory-card-actions place-card__actions">
        <a class="place-card__action--outline" href="${esc(safeUrl(place.links.search))}" target="_blank" rel="noopener">${renderIcon("map")}ดูแผนที่</a>
      </div>
    </div>
  </article>`;
}
