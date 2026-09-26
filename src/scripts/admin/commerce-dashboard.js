import { renderIcon, escapeHtml as e } from "../../lib/ui-markup.js";
const stupa = "/assets/images/admin-commerce-stupa.webp";
const lotus = "/assets/images/error-lotus-layered.webp";

const primary = [
  ["products", "สินค้า", "shopping-bag"], ["campaigns", "งานบุญ", "heart"],
  ["orders", "คำสั่งซื้อ", "file-text"], ["organizations", "ผู้ขาย", "users"],
];
export const commerceSetupSteps = [
  { title: "ตั้งค่าข้อมูลพื้นฐาน", description: "ชื่อร้าน ผู้รับผิดชอบ และข้อมูลการติดต่อ", section: "organizations", detail: "เพิ่มร้านค้าหรือวัด ระบุผู้รับผิดชอบ ช่องทางติดต่อ ค่าจัดส่ง และนโยบายคืนสินค้า ตรวจสอบความเกี่ยวข้องกับวัดก่อนเปิดใช้งาน" },
  { title: "เพิ่มสินค้าและสต็อก", description: "รายละเอียด รูปภาพ ราคา และจำนวนสินค้า", section: "products", detail: "เพิ่มสินค้าแยกตาม SKU พร้อมรูปภาพและแหล่งที่มา ระบุราคาและสต็อกตามจริง แล้วตรวจฉบับร่างก่อนเผยแพร่" },
  { title: "สร้างงานบุญ", description: "โครงการร่วมบุญ จำนวนกอง และวันปิดรับ", section: "campaigns", detail: "เลือกวัดและผู้จัด ระบุวัตถุประสงค์ จำนวนกอง วันจัดงาน วันปิดรับ และเงื่อนไขยกเลิก การยืนยันจองไม่ใช่การยืนยันรับเงิน" },
  { title: "ตรวจสอบช่องทางรับเงินและจัดส่ง", description: "ผู้รับบริจาค นโยบาย และข้อมูลผู้จัดส่ง", section: "channels", detail: "ระบบยังไม่รับชำระเงินออนไลน์ ช่องทางบริจาคเป็นลิงก์ออกไปยังผู้รับที่ผ่านการตรวจสอบเท่านั้น ตรวจชื่อวัด ชื่อผู้รับ และหลักฐานก่อนเผยแพร่" },
  { title: "ตรวจสอบก่อนเปิดบริการ", description: "สิทธิ์ผู้ขาย ฐานข้อมูล และการเปิดใช้ระบบ", section: "members", detail: "ทีมระบบต้องตรวจฐานข้อมูลและสิทธิ์การเข้าถึงใน UAT ก่อนเปิดบริการผ่านการตั้งค่าฝั่งเซิร์ฟเวอร์ การเปิดร้านไม่เปิดระบบชำระเงินโดยอัตโนมัติ" },
];

export function commerceDashboardHeader(data, section, disabled = false) {
  const status = disabled ? "ยังไม่เปิดให้บริการ" : data?.localPreview ? "ข้อมูลทดสอบในเครื่อง" : "ระบบพร้อมใช้งาน";
  const metrics = [
    { icon: "store", title: "สถานะระบบ", value: status, note: disabled ? "เตรียมข้อมูลก่อนเปิดใช้งาน" : "ยังไม่มีการรับชำระเงินออนไลน์", tone: "green", action: 'data-commerce-guide="4"' },
    { icon: "package", title: "จำนวนสินค้า", value: data ? `${data.products.length.toLocaleString("th-TH")} รายการ` : "ยังตรวจสอบไม่ได้", note: data ? "สินค้าทุกสถานะ" : "บริการยังไม่เปิดให้เรียกข้อมูล", tone: "gold", action: 'data-commerce-section="products"' },
    { icon: "heart", title: "งานบุญที่เผยแพร่", value: data ? `${data.campaigns.filter(row => row.status === "published").length.toLocaleString("th-TH")} รายการ` : "ยังตรวจสอบไม่ได้", note: data ? "เฉพาะรายการเผยแพร่แล้ว" : "บริการยังไม่เปิดให้เรียกข้อมูล", tone: "red", action: 'data-commerce-section="campaigns"' },
    { icon: "file-text", title: "คำขอสั่งซื้อ", value: data ? `${data.orders.length.toLocaleString("th-TH")} รายการ` : "ยังตรวจสอบไม่ได้", note: data ? "ยังไม่ใช่ยอดชำระเงิน" : "บริการยังไม่เปิดให้เรียกข้อมูล", tone: "blue", action: 'data-commerce-section="orders"' },
  ];
  return `<div class="mw-commerce-status-row"><span class="mw-commerce-service-badge ${disabled ? "is-disabled" : ""}"><i></i>${status}</span></div><nav class="mw-commerce-tabs" aria-label="ร้านค้าและร่วมบุญ">${primary.map(([key, title, icon]) => `<button type="button" data-commerce-section="${key}" aria-current="${key === section ? "page" : "false"}">${renderIcon(icon)}<span>${title}</span></button>`).join("")}</nav><div class="mw-commerce-metrics">${metrics.map(item => `<button type="button" class="mw-commerce-metric" ${item.action}><span class="mw-commerce-metric-icon is-${item.tone}">${renderIcon(item.icon)}</span><span><span>${item.title}</span><strong>${item.value}</strong><small>${item.note}</small></span>${renderIcon("chevron-right")}</button>`).join("")}</div>`;
}

export function commerceSetupGuide(data, active = -1) {
  return `<section class="mw-commerce-setup"><header><h2>${renderIcon("list-ordered")}ขั้นตอนการตั้งค่า</h2><button type="button" class="mw-commerce-text-button" data-commerce-guide="all">ดูคู่มือ ${renderIcon("book-open")}</button></header><p>เตรียมร้านค้าและงานบุญก่อนเปิดบริการ</p><ol>${commerceSetupSteps.map((step, index) => `<li><details data-commerce-step="${index}" ${active === index || active === "all" ? "open" : ""}><summary><span class="mw-commerce-step-number">${index + 1}</span><span><strong>${step.title}</strong><small>${step.description}</small></span>${renderIcon("chevron-right")}</summary><div class="mw-commerce-step-detail"><p>${step.detail}</p>${data ? `<button type="button" class="commerce-button secondary" data-commerce-section="${step.section}">จัดการ${index === 4 ? "สิทธิ์ทีมงาน" : step.title.replace(/^(ตั้งค่า|เพิ่ม|สร้าง|ตรวจสอบ)/, "")} ${renderIcon("arrow-right")}</button>` : '<p class="mw-commerce-prerequisite">การเพิ่มหรือแก้ไขข้อมูลจะพร้อมใช้งานเมื่อทีมระบบเชื่อมต่อและเปิดบริการแล้ว</p>'}</div></details></li>`).join("")}</ol></section>`;
}

export function commercePreparation(section, active = -1) {
  const selected = primary.find(([key]) => key === section)?.[1] || "ร้านค้าและร่วมบุญ";
  return `${commerceDashboardHeader(null, section, true)}<div class="mw-commerce-onboarding"><section class="mw-commerce-empty" data-commerce-state="disabled"><img class="mw-commerce-stupa" src="${stupa}" alt="" width="280" height="180"><h2>ร้านค้าและร่วมบุญยังไม่เปิดให้บริการ</h2><p>ยังไม่มีการเปิดรับคำสั่งซื้อหรือการจองร่วมบุญผ่านระบบ<br>เตรียมข้อมูลให้ครบถ้วน แล้วตรวจสอบความพร้อมก่อนเปิดใช้งาน</p><button type="button" class="commerce-button" data-commerce-guide="0">${renderIcon("settings")}เริ่มตั้งค่าร้านค้าและร่วมบุญ</button><div class="mw-commerce-quote"><img src="${lotus}" width="28" height="28" alt=""><p>การให้ คือ การสร้างบุญที่ยั่งยืน</p></div><button type="button" class="mw-commerce-text-button" data-reload>${renderIcon("rotate-ccw")}ลองใหม่</button><span class="mw-admin-sr-only" role="status">${e(selected)}: บริการยังไม่เปิดใช้งาน</span></section>${commerceSetupGuide(null, active)}</div><div class="mw-commerce-resources"><section><h3>${renderIcon("star")}เคล็ดลับการเริ่มต้น</h3><ul>${["เตรียมรูปภาพและรายละเอียดให้ชัดเจน", "ระบุผู้รับผิดชอบและเงื่อนไขให้ครบถ้วน", "ตรวจสอบผู้รับบริจาคและแหล่งที่มา", "ทดสอบด้วยข้อมูลตัวอย่างก่อนเปิดบริการ"].map(text => `<li>${renderIcon("circle-check")}${text}</li>`).join("")}</ul></section><section><h3>${renderIcon("book-open")}คู่มือและการใช้งาน</h3>${commerceSetupSteps.slice(0, 4).map((step, index) => `<button type="button" class="mw-commerce-resource-link" data-commerce-guide="${index}">${renderIcon("file-text")}${step.title}${renderIcon("chevron-right")}</button>`).join("")}</section><section><h3>${renderIcon("headphones")}ข้อมูลก่อนเปิดบริการ</h3><p>ระบบรองรับคำขอสั่งซื้อและการจองแยกจากการรับเงิน ยังไม่มี payment gateway</p><button type="button" class="commerce-button secondary" data-commerce-guide="4">${renderIcon("shield-check")}ตรวจสอบความพร้อม</button></section></div>`;
}
