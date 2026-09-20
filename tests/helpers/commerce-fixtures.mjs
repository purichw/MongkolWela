import { randomUUID } from "node:crypto";
import { emptyCommerce, mutateCommerce } from "../../api/commerce/_domain.js";

export const PREVIEW_USER = "10000000-0000-4000-8000-000000000001";
export const OTHER_USER = "10000000-0000-4000-8000-000000000002";
export function commerceFixture(templeId = "popular:test", now = Date.now()) {
  let state = emptyCommerce();
  const actor = { admin: true, actor: "local-fixture" };
  const templeIds = new Set([templeId]);
  const save = (table, data) => { const m = mutateCommerce(state, { op: "save", table, data }, actor, { templeIds, now }); state = m.state; return m.result; };
  const organization = save("organizations", { name: "ตัวอย่างทดสอบ: ร้านมงคลเวลา", kind: "platform", status: "active", templeIds: [templeId], contact: "preview@example.test", fulfillment: "ทีมมงคลเวลา (ตัวอย่างทดสอบ)", shippingSatang: 5000, returnPolicy: "ข้อมูลสำหรับทดสอบเท่านั้น ไม่มีการขายหรือจัดส่งจริง" });
  const otherOrg = save("organizations", { ...organization, name: "ตัวอย่างทดสอบ: ร้านค้าของวัด", kind: "temple", fulfillment: "ร้านค้าของวัด (ตัวอย่างทดสอบ)" });
  save("members", { orgId: organization.id, userId: PREVIEW_USER, email: "seller@example.test", status: "active" });
  save("members", { orgId: otherOrg.id, userId: OTHER_USER, email: "temple@example.test", status: "active" });
  const product = save("products", { orgId: organization.id, templeId, title: "ตัวอย่างทดสอบ: ชุดบูชาประจำบ้าน", description: "รายการจำลองสำหรับทดสอบระบบสินค้าและสต็อก ไม่ใช่สินค้าจำหน่ายจริง", sku: "TEST-001", material: "ข้อมูลตัวอย่าง", size: "ชุดมาตรฐาน", imageUrl: "/assets/images/temple-placeholder-auspicious.png", imageAlt: "ภาพประกอบสำหรับทดสอบ ไม่ใช่ภาพสินค้าจริง", sourceUrl: "https://example.test/source", priceSatang: 35000, stock: 2, status: "published" });
  const otherProduct = save("products", { ...product, orgId: otherOrg.id, title: "ตัวอย่างทดสอบ: วัตถุมงคลจากวัด", sku: "TEST-002", priceSatang: 59000, stock: 10 });
  const channel = save("channels", { orgId: organization.id, templeId, recipientName: "วัดตัวอย่างสำหรับทดสอบ", province: "กรุงเทพมหานคร", recipientId: "0000000000000", destinationKind: "registry", url: "https://data.rd.go.th/th/dataset/ds_edonation", sourceUrl: "https://data.rd.go.th/th/dataset/ds_edonation", verifiedAt: new Date(now).toISOString().slice(0, 10), status: "published" });
  const eventDate = new Date(now + 30 * 86400000).toISOString().slice(0, 10);
  const campaign = save("campaigns", { orgId: organization.id, templeId, title: "ตัวอย่างทดสอบ: ร่วมเป็นเจ้าภาพกฐิน", description: "เปิดทดสอบการจองร่วมเป็นเจ้าภาพรายกอง ไม่มีการรับเงินจริง", kind: "fund", eventDate, closeDate: eventDate, capacity: 3, amountSatang: 100000, channelId: channel.id, sourceUrl: "https://example.test/announcement", cancellationPolicy: "ติดต่อผู้จัดเมื่อต้องการเปลี่ยนแปลง รายการนี้ใช้ทดสอบเท่านั้น", status: "published" });
  const host = save("campaigns", { ...campaign, title: "ตัวอย่างทดสอบ: เจ้าภาพหลักงานกฐิน", kind: "host", capacity: 1, amountSatang: 0 });
  return { state, actor, templeIds, organization, otherOrg, product, otherProduct, channel, campaign, host, now };
}
export const guestCommand = (op, data) => ({ op, data, requestId: randomUUID(), accessSecret: `${randomUUID()}${randomUUID()}` });
