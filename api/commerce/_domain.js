import { randomUUID, createHash } from "node:crypto";
import { isIP } from "node:net";
import { validDate, bangkokToday } from "../../src/lib/temple-activities.js";
import { RD_DONATION_DIRECTORY } from "../../src/lib/commerce-format.js";

export const TABLES = ["organizations", "members", "products", "campaigns", "channels", "orders", "bookings"];
export const emptyCommerce = () => ({ revision: 0, ...Object.fromEntries(TABLES.map(key => [key, []])) });
export const fail = (message, statusCode = 422) => { throw Object.assign(new Error(message), { statusCode }); };
export const digest = value => createHash("sha256").update(String(value)).digest("hex");
const uuid = value => /^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value || "");
const pick = (obj, keys) => Object.fromEntries(keys.map(key => [key, obj[key]]));
const commonFields = ["id", "orgId", "version", "updatedAt", "status"];
// Deliberately exclude customer/contact fields and guest secrets from audit copies.
const auditFields = [...commonFields, "templeId", "templeIds", "kind", "userId", "sku", "priceSatang", "stock", "shippingSatang", "totalSatang", "capacity", "amountSatang", "channelId", "url", "sourceUrl", "recipientId", "recipientName", "province", "destinationKind", "verifiedAt", "closeDate", "eventDate", "quantity", "campaignId", "paymentStatus", "donationReceived", "receivedSatang", "receivedAt", "expiresAt"];
export const auditRecord = row => row ? Object.fromEntries(auditFields.filter(key => key in row).map(key => [key, row[key]])) : null;
export function externalUrl(value, required = false) {
  if (!value && !required) return "";
  try {
    const u = new URL(value);
    if (u.protocol === "https:" && !u.username && !u.password && !u.port && !isIP(u.hostname) && !/^(localhost|127\.|0\.|\[|.*\.local$)/i.test(u.hostname) && u.hostname.includes(".")) return u.href;
  } catch { /* A malformed destination must never become an active link. */ }
  fail("ลิงก์ต้องเป็น https:// ของเว็บไซต์สาธารณะ");
}
const text = (obj, key, max = 2000, required = false) => {
  const value = String(obj[key] ?? "").trim();
  if (value.length > max || (required && !value)) fail(`กรุณาตรวจสอบ ${key}`);
  return value;
};
const integer = (value, max = 10000000, min = 0) => {
  if (!Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max || value === "" || value == null) fail("จำนวนหรือราคาไม่ถูกต้อง");
  return Number(value);
};
function productImage(value) {
  if (/^\/assets\/[a-zA-Z0-9/_-]+\.(png|webp|jpe?g)$/i.test(value || "") && !value.includes("..")) return value;
  return externalUrl(value);
}
const enumValue = (value, allowed) => allowed.includes(value) ? value : fail("สถานะหรือประเภทไม่ถูกต้อง");
function checkDate(value, required = false) { if ((required || value) && !validDate(value)) fail("วันที่ไม่ถูกต้อง"); return value || ""; }
function find(state, table, id) { return state[table].find(row => row.id === id) || fail("ไม่พบรายการ", 404); }
function org(state, id) { return find(state, "organizations", id); }
export function authorizeOrganization(state, actor, orgId) {
  if (actor?.admin) return true;
  if (!actor?.userId || !state.members.some(m => m.userId === actor.userId && m.orgId === orgId && m.status === "active") || org(state, orgId).status !== "active") fail("ไม่มีสิทธิ์จัดการร้านค้านี้", 403);
  return true;
}
function activeOrg(state, id) { return org(state, id).status === "active"; }
function activeListing(state, row, templeIds) {
  return activeOrg(state, row.orgId) && (!row.templeId || ((!templeIds || templeIds.has(row.templeId)) && org(state, row.orgId).templeIds.includes(row.templeId)));
}
function liveHold(row, now) { return ["accepted", "held"].includes(row.status) && Date.parse(row.expiresAt) > now; }
export function effectiveStatus(row, now = Date.now()) { return ["accepted", "held"].includes(row.status) && Date.parse(row.expiresAt) <= now ? "expired" : row.status; }
export function availableStock(state, productId, now = Date.now()) {
  const p = find(state, "products", productId);
  return Math.max(0, p.stock - state.orders.filter(o => liveHold(o, now)).flatMap(o => o.lines).filter(l => l.productId === productId).reduce((n, l) => n + l.quantity, 0));
}
export function availableUnits(state, campaignId, now = Date.now()) {
  const c = find(state, "campaigns", campaignId);
  return Math.max(0, c.capacity - state.bookings.filter(b => b.campaignId === campaignId && (b.status === "confirmed" || liveHold(b, now))).reduce((n, b) => n + b.quantity, 0));
}
export function publicCommerce(state, { templeId = "", now = Date.now(), templeIds } = {}) {
  const matches = row => (!templeId || row.templeId === templeId) && (!row.templeId || !templeIds || templeIds.has(row.templeId));
  const organizations = state.organizations.filter(o => o.status === "active").map(o => pick(o, ["id", "version", "name", "kind", "contact", "fulfillment", "shippingSatang", "returnPolicy"]));
  const visible = row => activeListing(state, row, templeIds) && matches(row);
  const products = state.products.filter(p => p.status === "published" && visible(p)).map(p => ({ ...pick(p, [...commonFields, "title", "templeId", "description", "sku", "material", "size", "imageUrl", "imageAlt", "priceSatang", "sourceUrl"]), available: availableStock(state, p.id, now) }));
  const channels = state.channels.filter(c => c.status === "published" && visible(c)).map(c => pick(c, [...commonFields, "templeId", "recipientName", "province", "recipientId", "destinationKind", "url", "sourceUrl", "verifiedAt"]));
  const campaigns = state.campaigns.filter(c => ["published", "paused", "closed", "cancelled"].includes(c.status) && visible(c)).map(c => ({ ...pick(c, [...commonFields, "templeId", "title", "description", "kind", "eventDate", "closeDate", "amountSatang", "capacity", "channelId", "sourceUrl", "cancellationPolicy"]), available: availableUnits(state, c.id, now), closed: c.closeDate < bangkokToday(new Date(now)) }));
  return { organizations, products, channels, campaigns, directoryUrl: RD_DONATION_DIRECTORY, payments: { enabled: false, reason: "ยังไม่เปิดรับชำระเงินออนไลน์" } };
}
export function privateCommerce(state, actor) {
  const orgIds = new Set(actor?.admin ? state.organizations.map(o => o.id) : state.members.filter(m => m.userId === actor?.userId && m.status === "active" && activeOrg(state, m.orgId)).map(m => m.orgId));
  if (!actor?.admin && !orgIds.size) fail("บัญชีนี้ยังไม่มีสิทธิ์ผู้ขายที่เปิดใช้งาน", 403);
  const result = Object.fromEntries(TABLES.map(table => [table, state[table].filter(row => table === "organizations" ? orgIds.has(row.id) : orgIds.has(row.orgId)).map(row => {
    const { accessHash, requestHash, ...safe } = row;
    return { ...safe, ...(["orders", "bookings"].includes(table) ? { status: effectiveStatus(row) } : {}) };
  })]));
  return { ...result, admin: Boolean(actor?.admin), payments: { enabled: false } };
}
export function guestRecord(state, table, id, accessSecret) {
  if (!["orders", "bookings"].includes(table) || !/^[a-f\d-]{64,100}$/i.test(accessSecret || "")) fail("ไม่พบรายการ", 404);
  const record = find(state, table, id);
  if (record.accessHash !== digest(accessSecret)) fail("ไม่พบรายการ", 404);
  const { accessHash, requestHash, ...safe } = record;
  return { ...safe, status: effectiveStatus(record) };
}

function validateRecord(table, input, state, actor, templeIds, now) {
  const d = input || {};
  const orgId = table === "organizations" ? "" : text(d, "orgId", 36, true);
  if (table !== "organizations") authorizeOrganization(state, actor, orgId);
  const templeId = text(d, "templeId", 250);
  if (templeId && !templeIds?.has(templeId)) fail("กรุณาเลือกวัดที่เปิดใช้งาน");
  if (templeId && table !== "organizations" && !org(state, orgId).templeIds.includes(templeId)) fail("วัดนี้ยังไม่ได้รับรองความเกี่ยวข้องกับร้านค้า", 403);
  if (table === "organizations") {
    if (!actor.admin) fail("เฉพาะผู้ดูแลส่วนกลาง", 403);
    const linked = Array.isArray(d.templeIds) ? [...new Set(d.templeIds)] : [];
    if (linked.some(id => !templeIds?.has(id))) fail("วัดที่เชื่อมโยงไม่ถูกต้อง");
    return { name: text(d, "name", 160, true), kind: enumValue(d.kind, ["platform", "temple", "shop"]), status: enumValue(d.status, ["draft", "active", "suspended"]), templeIds: linked, contact: text(d, "contact", 300, true), fulfillment: text(d, "fulfillment", 200, true), shippingSatang: integer(d.shippingSatang, 10000000), returnPolicy: text(d, "returnPolicy", 2000, true) };
  }
  if (table === "members") {
    if (!actor.admin || !uuid(d.userId)) fail("เฉพาะผู้ดูแลส่วนกลางและต้องระบุรหัสผู้ใช้ที่ถูกต้อง", 403);
    return { orgId, userId: d.userId, email: text(d, "email", 254), status: enumValue(d.status, ["active", "suspended"]) };
  }
  if (table === "products") {
    const p = { orgId, templeId, title: text(d, "title", 160, true), description: text(d, "description", 4000, true), sku: text(d, "sku", 80, true), material: text(d, "material", 120), size: text(d, "size", 120), imageUrl: productImage(d.imageUrl), imageAlt: text(d, "imageAlt", 160), sourceUrl: externalUrl(d.sourceUrl), priceSatang: integer(d.priceSatang, 100000000, 1), stock: integer(d.stock, 100000), status: enumValue(d.status, ["draft", "published", "archived"]) };
    if (p.status === "published" && (!p.imageUrl || !p.imageAlt || !p.sourceUrl)) fail("ก่อนเผยแพร่ กรุณาระบุรูป คำบรรยายภาพ และแหล่งที่มา");
    if (state.products.some(x => x.id !== d.id && x.orgId === orgId && x.sku === p.sku)) fail("SKU นี้มีอยู่แล้ว");
    if (d.id && p.stock < find(state, "products", d.id).stock - availableStock(state, d.id, now)) fail("สต็อกต้องไม่น้อยกว่าจำนวนที่ยืนยันไว้");
    return p;
  }
  if (table === "channels") {
    if (!templeId) fail("กรุณาระบุวัดผู้รับบริจาค");
    const c = { orgId, templeId, recipientName: text(d, "recipientName", 200, true), province: text(d, "province", 100, true), recipientId: text(d, "recipientId", 13), destinationKind: enumValue(d.destinationKind, ["temple", "provider", "registry"]), url: externalUrl(d.url, true), sourceUrl: externalUrl(d.sourceUrl, true), verifiedAt: checkDate(text(d, "verifiedAt", 10)), status: actor.admin ? enumValue(d.status, ["draft", "review", "published", "archived"]) : "review" };
    if (c.destinationKind === "registry") c.url = RD_DONATION_DIRECTORY;
    if (c.status === "published" && (!/^\d{13}$/.test(c.recipientId) || !c.verifiedAt || c.verifiedAt > bangkokToday(new Date(now)))) fail("ต้องตรวจสอบเลขหน่วยรับบริจาค 13 หลักและวันที่ก่อนเผยแพร่");
    return c;
  }
  if (table === "campaigns") {
    if (!templeId) fail("กรุณาระบุวัดที่จัดงาน");
    const c = { orgId, templeId, title: text(d, "title", 160, true), description: text(d, "description", 4000, true), kind: enumValue(d.kind, ["fund", "host"]), eventDate: checkDate(text(d, "eventDate", 10), true), closeDate: checkDate(text(d, "closeDate", 10), true), capacity: integer(d.capacity, 100000, 1), amountSatang: integer(d.amountSatang, 100000000), channelId: text(d, "channelId", 36), sourceUrl: externalUrl(d.sourceUrl, true), cancellationPolicy: text(d, "cancellationPolicy", 2000, true), status: enumValue(d.status, ["draft", "published", "paused", "closed", "cancelled", "archived"]) };
    if (c.kind === "host") c.capacity = 1;
    if (c.closeDate > c.eventDate) fail("วันปิดรับต้องไม่หลังวันจัดงาน");
    if (c.channelId) { const ch = find(state, "channels", c.channelId); if (ch.templeId !== templeId || ch.status !== "published") fail("ช่องทางบริจาคต้องผ่านการตรวจสอบและตรงกับวัด"); }
    if (d.id) {
      const old = find(state, "campaigns", d.id);
      if (state.bookings.some(b => b.campaignId === d.id) && (old.kind !== c.kind || old.templeId !== c.templeId)) fail("รายการที่มีผู้จองแล้วเปลี่ยนประเภทหรือวัดไม่ได้");
      if (c.capacity < old.capacity - availableUnits(state, d.id, now)) fail("จำนวนกองต้องไม่น้อยกว่ารายการที่จองไว้");
    }
    return c;
  }
  fail("ประเภทข้อมูลไม่ถูกต้อง");
}

export function mutateCommerce(original, command, actor, { templeIds = new Set(), now = Date.now() } = {}) {
  const state = structuredClone(original);
  const changes = [];
  const stamp = row => ({ ...row, version: randomUUID(), updatedAt: new Date(now).toISOString() });
  const put = (table, row) => { const value = stamp(row); state[table] = [...state[table].filter(x => x.id !== value.id), value]; changes.push({ table, value }); return value; };
  const { op, table, id } = command;
  let result;
  if (op === "save") {
    if (!["organizations", "members", "products", "campaigns", "channels"].includes(table)) fail("ประเภทข้อมูลไม่ถูกต้อง");
    const previous = id ? find(state, table, id) : null;
    if (previous) {
      if (previous.version !== command.expectedVersion) fail("ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดรายการล่าสุด", 409);
      if (table !== "organizations") authorizeOrganization(state, actor, previous.orgId);
      if (table !== "organizations" && previous.orgId !== command.data?.orgId) fail("ย้ายข้อมูลข้ามร้านค้าไม่ได้", 403);
    }
    const data = validateRecord(table, { ...command.data, id }, state, actor, templeIds, now);
    if (table === "members" && state.members.some(m => m.id !== id && m.orgId === data.orgId && m.userId === data.userId)) fail("ผู้ใช้นี้มีสิทธิ์ในร้านค้านี้อยู่แล้ว");
    result = put(table, { ...data, id: id || randomUUID(), createdAt: previous?.createdAt || new Date(now).toISOString() });
  } else if (["order.create", "booking.create"].includes(op)) {
    const target = op === "order.create" ? "orders" : "bookings";
    const input = command.data || {};
    if (!uuid(command.requestId) || !/^[a-f\d-]{64,100}$/i.test(command.accessSecret || "")) fail("รหัสคำขอไม่ถูกต้อง");
    const accessHash = digest(command.accessSecret);
    const requestHash = digest(JSON.stringify(input));
    const repeat = state[target].find(row => row.id === command.requestId);
    if (repeat) {
      if (repeat.accessHash !== accessHash || repeat.requestHash !== requestHash) fail("คำขอนี้ถูกใช้แล้ว", 409);
      return { state: original, changes: [], result: guestRecord(state, target, repeat.id, command.accessSecret) };
    }
    if (state[target].filter(row => row.accessHash === accessHash && ["requested", "held", "accepted"].includes(effectiveStatus(row, now))).length >= 5) fail("มีรายการที่ยังไม่เสร็จครบ 5 รายการแล้ว", 429);
    const customer = { name: text(input, "name", 160, true), contact: text(input, "contact", 200, true) };
    let record;
    if (target === "orders") {
      if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 20 || new Set(input.lines.map(l => l.productId)).size !== input.lines.length) fail("รายการสินค้าไม่ถูกต้อง");
      const lines = input.lines.map(line => {
        const p = find(state, "products", line.productId);
        if (p.status !== "published" || !activeListing(state, p, templeIds)) fail("สินค้านี้ไม่เปิดรับรายการแล้ว", 409);
        if (p.version !== line.version) fail("ข้อมูลสินค้าเปลี่ยนแล้ว กรุณาตรวจสอบตะกร้าอีกครั้ง", 409);
        const quantity = integer(line.quantity, 99, 1);
        if (quantity > availableStock(state, p.id, now)) fail("สินค้าเหลือไม่พอ", 409);
        return { productId: p.id, title: p.title, sku: p.sku, priceSatang: p.priceSatang, quantity, orgId: p.orgId };
      });
      if (new Set(lines.map(l => l.orgId)).size !== 1) fail("กรุณาแยกคำสั่งซื้อตามผู้ขาย");
      const seller = org(state, lines[0].orgId);
      if (seller.version !== input.sellerVersion) fail("เงื่อนไขหรือค่าจัดส่งของผู้ขายเปลี่ยนแล้ว กรุณาตรวจสอบตะกร้าอีกครั้ง", 409);
      record = { orgId: seller.id, sellerName: seller.name, fulfillment: seller.fulfillment, lines, address: text(input, "address", 1200, true), shippingSatang: seller.shippingSatang, totalSatang: lines.reduce((n, l) => n + l.priceSatang * l.quantity, seller.shippingSatang), paymentStatus: "unavailable", status: "requested" };
    } else {
      const c = find(state, "campaigns", input.campaignId);
      if (c.status !== "published" || !activeListing(state, c, templeIds) || c.closeDate < bangkokToday(new Date(now))) fail("รายการนี้ปิดรับจองแล้ว", 409);
      if (c.version !== input.version) fail("ข้อมูลรายการร่วมบุญเปลี่ยนแล้ว กรุณาตรวจสอบอีกครั้ง", 409);
      const quantity = c.kind === "host" ? 1 : integer(input.quantity, 99, 1);
      if (c.kind === "host" && availableUnits(state, c.id, now) < 1) fail("มีเจ้าภาพหลักที่ยืนยันแล้ว", 409);
      if (c.kind === "fund" && quantity > availableUnits(state, c.id, now)) fail("จำนวนกองที่ว่างไม่พอ", 409);
      record = { orgId: c.orgId, campaignId: c.id, campaignTitle: c.title, templeId: c.templeId, kind: c.kind, quantity, pledgedSatang: c.amountSatang * quantity, note: text(input, "note", 1000), status: c.kind === "host" ? "requested" : "held", donationReceived: false, expiresAt: new Date(now + 86400000).toISOString() };
    }
    result = put(target, { ...record, ...customer, id: command.requestId, accessHash, requestHash, createdAt: new Date(now).toISOString() });
    result = guestRecord(state, target, result.id, command.accessSecret);
  } else if (op === "transition") {
    if (!["orders", "bookings"].includes(table)) fail("ประเภทข้อมูลไม่ถูกต้อง");
    const row = find(state, table, id);
    authorizeOrganization(state, actor, row.orgId);
    if (row.version !== command.expectedVersion) fail("ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่", 409);
    const current = effectiveStatus(row, now);
    const action = command.action;
    const reason = text(command, "note", 500, true);
    const next = { ...row, statusNote: reason };
    if (action === "cancel") {
      if (["cancelled", "expired"].includes(current)) fail("รายการนี้สิ้นสุดแล้ว", 409);
      next.status = "cancelled";
    } else if (action === "accept" && table === "orders") {
      if (current !== "requested" || !activeOrg(state, row.orgId)) fail("ยืนยันรายการนี้ไม่ได้", 409);
      for (const line of row.lines) { const product = find(state, "products", line.productId); if (product.status !== "published" || !activeListing(state, product, templeIds) || availableStock(state, line.productId, now) < line.quantity) fail("สินค้าเหลือไม่พอหรือปิดขายแล้ว", 409); }
      next.status = "accepted";
      next.expiresAt = new Date(now + 86400000).toISOString();
    } else if (action === "confirm" && table === "bookings") {
      const c = find(state, "campaigns", row.campaignId);
      if (!["requested", "held"].includes(current) || c.status !== "published" || !activeListing(state, c, templeIds) || c.closeDate < bangkokToday(new Date(now))) fail("ยืนยันรายการนี้ไม่ได้", 409);
      if (row.kind === "host" && availableUnits(state, c.id, now) < 1) fail("มีเจ้าภาพหลักที่ยืนยันแล้ว", 409);
      next.status = "confirmed";
    } else if (action === "receipt" && table === "bookings") {
      if (current !== "confirmed" || row.donationReceived) fail("รายการนี้รับรองการรับเงินไม่ได้", 409);
      next.donationReceived = true;
      next.receivedSatang = integer(command.receivedSatang, 100000000, 1);
      next.receiptReference = text(command, "reference", 200, true);
      next.receivedAt = new Date(now).toISOString();
    } else if (["paid", "ship", "refund"].includes(action)) fail("ยังไม่เชื่อมผู้ให้บริการชำระเงิน จึงทำรายการนี้ไม่ได้", 503);
    else fail("เปลี่ยนสถานะนี้ไม่ได้", 409);
    result = put(table, next);
  } else if (op === "guest.cancel") {
    const row = guestRecord(state, table, id, command.accessSecret);
    if (!["requested", "held"].includes(effectiveStatus(row, now))) fail("กรุณาติดต่อผู้จัดหรือผู้ขายเพื่อยกเลิกรายการที่ยืนยันแล้ว", 409);
    result = put(table, { ...find(state, table, id), status: "cancelled", statusNote: "ผู้ส่งรายการยกเลิก" });
    result = guestRecord(state, table, id, command.accessSecret);
  } else fail("ไม่รองรับคำสั่งนี้");
  return { state, changes, result };
}
