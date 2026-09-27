import { e, money, thaiCommerceDate, orgName } from "./commerce-ui.js";
import { renderIcon } from "../lib/ui-markup.js";
import { choiceChipClass } from "../lib/choice-chip.js";
import { PRODUCT_CATEGORIES, productCategoryLabel, catalogTemple } from "../lib/commerce-catalog.js";
import { sitePlaceholderImage } from "../lib/image-placeholder.js";

const option = (value, label, selected) => `<option value="${e(value)}" ${value === selected ? "selected" : ""}>${e(label)}</option>`;
const favorite = (row, mode, favorites) => `<button class="commerce-favorite" type="button" data-favorite="${e(`${mode}:${row.id}`)}" aria-pressed="${favorites.includes(`${mode}:${row.id}`)}" aria-label="บันทึก ${e(row.title)}" title="บันทึกรายการไว้ในอุปกรณ์นี้">${renderIcon("heart")}</button>`;
export function catalogControls(catalog, mode, filters) {
  const search = `<label class="catalog-search">${renderIcon("search")}<span class="sr-only">ค้นหา${mode === "shop" ? "สินค้า" : "งานบุญ"}</span><input type="search" data-search value="${e(filters.search)}" placeholder="${mode === "shop" ? "ค้นหาสินค้า ชื่อวัด หรือผู้จำหน่าย..." : "ค้นหาวัด จังหวัด หรือชื่อโครงการ"}" /></label>`;
  const seller = `<label class="catalog-seller"><span class="sr-only">ผู้จำหน่าย / ผู้จัด</span><select data-seller><option value="">ผู้จำหน่ายทั้งหมด</option>${catalog.organizations.map(org => option(org.id, org.name, filters.seller)).join("")}</select></label>`;
  const sort = `<label class="catalog-sort"><span class="sr-only">เรียงลำดับ</span><select data-sort>${option("latest", "รายการล่าสุด", filters.sort)}${mode === "shop" ? option("price-asc", "ราคา: ต่ำไปสูง", filters.sort) + option("price-desc", "ราคา: สูงไปต่ำ", filters.sort) : option("event", "วันที่จัดงาน", filters.sort)}</select></label>`;
  if (mode === "shop") {
    const categories = [{ id: "", label: "ทั้งหมด" }, ...PRODUCT_CATEGORIES.filter(c => catalog.products.some(p => p.category === c.id))];
    return `<div class="shop-catalog-controls"><div class="shop-categories" role="group" aria-label="หมวดสินค้า">${categories.map(c => `<button type="button" class="${choiceChipClass()}" data-category="${e(c.id)}" aria-pressed="${filters.category === c.id}"><span class="ui-choice-chip__label">${c.label}</span></button>`).join("")}</div>${search}${sort}${seller}</div>`;
  }
  const provinces = [...new Set(catalog.campaigns.map(c => catalogTemple(catalog, c)?.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  return `<form class="merit-catalog-controls" data-catalog-search>${search}<label>จังหวัด<select data-province>${option("", "ทั้งหมด", filters.province)}${provinces.map(p => option(p, p, filters.province)).join("")}</select></label><label>ประเภท<select data-kind>${option("", "ทั้งหมด", filters.kind)}${option("fund", "ร่วมเป็นเจ้าภาพรายกอง", filters.kind)}${option("host", "เจ้าภาพหลัก", filters.kind)}</select></label><button class="commerce-button" type="submit">ค้นหา</button></form><div class="merit-sort">${seller}${sort}</div>`;
}
export function shopCollections(catalog) {
  const categories = PRODUCT_CATEGORIES.filter(category => catalog.products.some(p => p.category === category.id)).slice(0, 3);
  if (!categories.length) return "";
  return `<section class="shop-collections" aria-label="เลือกตามหมวดสินค้า"><div><p>คอลเลกชันของเรา</p><h2>ศรัทธาในทุกเส้นทาง</h2><span>เลือกสิ่งที่มีความหมาย<br />ในแบบของคุณ</span></div>${categories.map(category => {
    const product = catalog.products.find(p => p.category === category.id && p.imageUrl);
    return `<button type="button" data-category="${category.id}" class="shop-collection"><img src="${e(product?.imageUrl || sitePlaceholderImage)}" data-fallback-src="${sitePlaceholderImage}" alt="" width="400" height="260" /><span><strong>${category.label}</strong><span>เลือกชม ${renderIcon("arrow-right")}</span></span></button>`;
  }).join("")}</section>`;
}
export function shopProductCard(product, catalog, favorites) {
  const temple = catalogTemple(catalog, product);
  const href = `/shop/?product=${encodeURIComponent(product.id)}`;
  return `<article class="commerce-product shop-product"><div class="shop-product-media"><a href="${href}" tabindex="-1" aria-hidden="true"><img src="${e(product.imageUrl || sitePlaceholderImage)}" data-fallback-src="${sitePlaceholderImage}" alt="${e(product.imageAlt)}" loading="lazy" width="480" height="360" /></a>${favorite(product, "shop", favorites)}</div><div class="shop-product-copy"><span class="shop-product-category">${e(productCategoryLabel(product.category))}</span><h2><a href="${href}">${e(product.title)}</a></h2><p class="shop-product-origin">${renderIcon("map-pin")}${e(temple ? `${temple.name} · ${temple.province}` : orgName(catalog, product.orgId))}</p><div class="shop-product-purchase"><strong>${money(product.priceSatang)}</strong><a class="commerce-button secondary" href="${href}">ดูรายละเอียด ${renderIcon("arrow-right")}</a></div>${!product.available ? '<span class="shop-stock-label">สินค้าหมด</span>' : ""}</div></article>`;
}
export function meritCampaignCard(campaign, catalog, favorites) {
  const temple = catalogTemple(catalog, campaign);
  const open = campaign.status === "published" && !campaign.closed && campaign.available > 0;
  const status = open ? "เปิดรับจองร่วมบุญ" : campaign.status === "cancelled" ? "ยกเลิกงาน" : campaign.status === "paused" ? "พักรับจอง" : !campaign.available ? "ครบจำนวนแล้ว" : "ปิดรับจอง";
  const href = `/merit/?campaign=${encodeURIComponent(campaign.id)}`;
  // Reservation capacity is not a donation total; never imply money received.
  const reserved = Math.max(0, campaign.capacity - campaign.available);
  return `<article class="merit-campaign"><div class="merit-campaign-media"><a href="${href}" tabindex="-1" aria-hidden="true"><img src="${e(temple?.imageUrl || sitePlaceholderImage)}" data-fallback-src="${sitePlaceholderImage}" alt="${e(temple?.name || "ภาพประกอบสถานที่")}" width="480" height="300" loading="lazy" /></a><span class="merit-status ${open ? "is-open" : ""}">${status}</span>${favorite(campaign, "merit", favorites)}</div><div class="merit-campaign-copy"><h2><a href="${href}">${e(campaign.title)}</a></h2><p>${renderIcon("map-pin")}${e(temple?.province || orgName(catalog, campaign.orgId))}</p><p>${renderIcon("calendar-days")}${e(thaiCommerceDate(campaign.eventDate))}</p><div class="merit-capacity"><span>${campaign.kind === "fund" ? `${money(campaign.amountSatang)} / กอง` : "ขอเป็นเจ้าภาพหลัก"}</span><strong>${campaign.kind === "fund" ? `จองแล้ว ${reserved.toLocaleString("th-TH")} / ${campaign.capacity.toLocaleString("th-TH")} กอง` : `ว่าง ${campaign.available} รายการ`}</strong>${campaign.kind === "fund" ? `<progress value="${reserved}" max="${campaign.capacity}" aria-label="จำนวนกองที่จองแล้ว"></progress>` : ""}</div><div class="merit-card-actions"><a class="commerce-button secondary" href="${href}">ดูรายละเอียด</a>${open ? `<a class="commerce-button" href="${href}#booking">ร่วมบุญ ${renderIcon("arrow-right")}</a>` : `<span>${status}</span>`}</div></div></article>`;
}
