import { sitePlaceholderImage } from "../lib/image-placeholder.js";
import { escapeCommerce as e, money, thaiCommerceDate, COMMERCE_STATUS } from "../lib/commerce-format.js";
export { e, money, thaiCommerceDate, COMMERCE_STATUS };
export async function commerceApi(body, query = "") {
  const response = await fetch(`/api/commerce${query}`, { method: body ? "POST" : "GET", cache: "no-store", credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok || !data.ok) throw Object.assign(new Error(data.error || "โหลดข้อมูลไม่สำเร็จ"), { status: response.status, code: data.code });
  return data;
}
export function orgName(data, id) { return data.organizations.find(o => o.id === id)?.name || "ผู้จัดจำหน่าย"; }
export function channelMarkup(channel) {
  const registry = channel.destinationKind === "registry";
  return `<article class="commerce-channel"><div><h3>${e(channel.recipientName)}</h3><p>${e(channel.province)} · เลขหน่วยรับบริจาค ${e(channel.recipientId || "ยังไม่ระบุ")}</p><small>ตรวจสอบ ${e(thaiCommerceDate(channel.verifiedAt))}</small></div><div><a class="commerce-button secondary" href="${e(channel.url)}" target="_blank" rel="noopener noreferrer">${registry ? "ตรวจสอบข้อมูล e-Donation" : "ไปยังช่องทางบริจาคของวัด"} ↗</a><small>${e(new URL(channel.url).hostname)}</small><a href="${e(channel.sourceUrl)}" target="_blank" rel="noopener noreferrer">แหล่งยืนยัน</a></div></article>`;
}
export function productMarkup(product, data) {
  return `<article class="commerce-product"><a href="/shop/?product=${e(product.id)}"><img src="${e(product.imageUrl || sitePlaceholderImage)}" data-fallback-src="${sitePlaceholderImage}" alt="${e(product.imageAlt)}" loading="lazy" width="480" height="400" /></a><div><small>${e(orgName(data, product.orgId))}</small><h2><a href="/shop/?product=${e(product.id)}">${e(product.title)}</a></h2><p>${e([product.material, product.size].filter(Boolean).join(" · "))}</p><div class="commerce-product-price"><strong>${money(product.priceSatang)}</strong><span>${product.available ? `คงเหลือ ${product.available}` : "สินค้าหมด"}</span></div></div></article>`;
}
export function campaignMarkup(c, data) {
  return `<article class="commerce-campaign"><div class="commerce-date"><strong>${e(new Date(`${c.eventDate}T12:00:00+07:00`).getDate())}</strong><span>${e(thaiCommerceDate(c.eventDate))}</span></div><div><small>${e(orgName(data, c.orgId))} · ${c.kind === "host" ? "เจ้าภาพหลัก" : "ร่วมเป็นเจ้าภาพรายกอง"}</small><h2><a href="/merit/?campaign=${e(c.id)}">${e(c.title)}</a></h2><p>${e(c.description.slice(0, 180))}</p><div class="commerce-inline"><strong>${c.kind === "fund" ? `${money(c.amountSatang)} / กอง` : "พิจารณาโดยวัด"}</strong><span>${c.status !== "published" ? e(COMMERCE_STATUS[c.status]) : c.closed ? "ปิดรับจอง" : `ว่าง ${c.available} ${c.kind === "fund" ? "กอง" : "รายการ"}`}</span></div></div><a class="commerce-button secondary" href="/merit/?campaign=${e(c.id)}">ดูรายละเอียด</a></article>`;
}
export function inputField(label, name, type = "text", required = true, extra = "") { return `<label class="commerce-field">${e(label)}${type === "textarea" ? `<textarea name="${name}" rows="3" ${required ? "required" : ""} maxlength="1200" ${extra}></textarea>` : `<input name="${name}" type="${type}" ${required ? "required" : ""} maxlength="200" ${extra} />`}</label>`; }
