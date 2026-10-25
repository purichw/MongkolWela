import { escapeHtml, renderIcon } from "./ui-markup.js";

export function collectionIntent(item) {
  return String(item.blessings || item.objectHero || item.placeType || "")
    .split(";").map(value => value.trim()).find(value => value && !["0", "nan", "null"].includes(value.toLowerCase())) || "";
}

// SSR and incremental catalog loading use the same card anatomy and CMS hooks.
export function renderTempleCollectionCard(item, placeholderSrc) {
  const hasImage = Boolean(item.imageUrl) && item.imageUrl !== placeholderSrc;
  const image = hasImage ? item.imageUrl : placeholderSrc;
  const mobile = item.imageMobileUrl === "" ? placeholderSrc : item.imageMobileUrl ?? image;
  const intent = collectionIntent(item);
  const attributes = {
    rank: item.rank, name: item.name, region: item.region, province: item.province,
    district: item.district, blessings: item.blessings, "place-type": item.placeType,
    "object-hero": item.objectHero, latitude: item.latitude, longitude: item.longitude,
    "card-key": item.key,
    "temple-key": item.cmsKey || "",
    "search-text": [item.name, item.region, item.province, item.district, item.blessings, item.objectHero].filter(Boolean).join(" "),
  };
  return `<article class="popular-temple-card temple-collection-v2-card place-card${hasImage ? "" : " is-placeholder"}" data-place-card
    data-popular-temple-card ${hasImage ? "" : 'data-image-placeholder="true"'}
    ${Object.entries(attributes).map(([key, value]) => `data-${key}="${escapeHtml(value)}"`).join(" ")}>
    <figure>
      <picture class="temple-responsive-picture">
        ${mobile !== image ? `<source media="(max-width: 767px)" srcset="${escapeHtml(mobile)}" data-temple-mobile-source>` : ""}
        <img src="${escapeHtml(image)}" alt="${escapeHtml(hasImage ? item.imageAlt ?? `${item.name} ${item.province}` : "ภาพประกอบแทนรูปที่ยังไม่มี")}"
          loading="lazy" decoding="async" data-fallback-src="${escapeHtml(placeholderSrc)}" data-temple-desktop-image>
      </picture>
      <figcaption aria-label="ลำดับ ${escapeHtml(item.rank)}">${escapeHtml(item.rank)}</figcaption>
    </figure>
    <div class="popular-temple-card-body place-card__body">
      <span class="temple-collection-v2-province place-card__locality">${renderIcon("map-pin")}<span data-collection-province>${escapeHtml(item.province)}</span></span>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(`${item.province || ""}${item.district ? ` / ${item.district}` : ""}`)}</p>
      <strong data-collection-intent ${intent ? "" : "hidden"}>${escapeHtml(intent)}</strong>
      <div class="temple-collection-v2-card-actions place-card__actions">
        <a class="temple-collection-v2-card-plan place-card__action--outline" href="${escapeHtml(item.plannerUrl)}">เพิ่มลงแผน</a>
        <a class="temple-collection-v2-card-detail place-card__action--text" href="${escapeHtml(item.detailUrl)}" data-popular-temple-detail>รายละเอียด ${renderIcon("arrow-right")}</a>
      </div>
    </div>
  </article>`;
}
