import { sendJson, readJsonBody, requireSameOrigin } from "../admin/_shared.js";
import { supabaseClient } from "../admin/_database.js";
import { loadTempleCatalog } from "../admin/temples.js";
import { readCommerce, transactCommerce, isLocalCommercePreview, requireCommerceEnabled } from "./_store.js";
import { commerceActor } from "./_auth.js";
import { authorizeOrganization, publicCommerce, privateCommerce, guestRecord, fail } from "./_domain.js";

export default async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (!["GET", "POST"].includes(req.method)) return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  if (!requireSameOrigin(req, res)) return;
  try {
    requireCommerceEnabled();
    const url = new URL(req.url, "https://local.invalid");
    if (req.method === "GET" && url.searchParams.get("view") !== "manage") {
      const temples = await loadTempleCatalog();
      const templeIds = new Set(temples.map(t => t.key));
      const templeId = url.searchParams.get("templeId") || "";
      if (templeId && !templeIds.has(templeId)) fail("ไม่พบวัดที่เปิดใช้งาน", 404);
      return sendJson(res, 200, { ok: true, ...publicCommerce(await readCommerce({ publicOnly: true }), { templeId, templeIds }) });
    }
    const actor = await commerceActor(req);
    if (req.method === "GET") {
      const data = privateCommerce(await readCommerce(), actor);
      const temples = (await loadTempleCatalog()).map(t => ({ id: t.key, name: t.temple.name, province: t.temple.province }));
      return sendJson(res, 200, { ok: true, ...data, temples, localPreview: isLocalCommercePreview() });
    }
    const body = await readJsonBody(req, { maxBytes: 32000 });
    if (body.op === "guest.read") return sendJson(res, 200, { ok: true, record: guestRecord(await readCommerce(), body.table, body.id, body.accessSecret) });
    if (body.op === "checkout") fail("ยังไม่เปิดรับชำระเงินจริง กรุณารอประกาศจากผู้ขาย", 503);
    if (body.op === "invite") {
      if (!actor.admin) fail("เฉพาะผู้ดูแลส่วนกลาง", 403);
      const state = await readCommerce();
      if (!state.organizations.some(o => o.id === body.orgId)) fail("ไม่พบร้านค้า", 404);
      authorizeOrganization(state, actor, body.orgId);
      if (isLocalCommercePreview()) fail("การส่งอีเมลเชิญไม่เปิดใน local preview", 503);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "")) fail("อีเมลไม่ถูกต้อง");
      const db = supabaseClient({ service: true });
      const site = process.env.MONGKOLWELA_SITE_URL;
      if (!site || !site.startsWith("https://")) fail("ยังไม่ตั้งค่า URL สำหรับอีเมลเชิญ", 503);
      const { data, error } = await db.auth.admin.inviteUserByEmail(body.email, { redirectTo: `${site.replace(/\/$/, "")}/seller/` });
      if (error || !data.user) fail("ส่งอีเมลเชิญไม่สำเร็จ บัญชีเดิมให้เพิ่มผ่านรหัสผู้ใช้", 422);
      const record = await transactCommerce({ op: "save", table: "members", data: { orgId: body.orgId, userId: data.user.id, email: body.email, status: "active" } }, actor);
      return sendJson(res, 200, { ok: true, record });
    }
    const temples = await loadTempleCatalog();
    const record = await transactCommerce(body, actor, { templeIds: new Set(temples.map(t => t.key)) });
    sendJson(res, 200, { ok: true, record });
  } catch (error) {
    sendJson(res, error.statusCode || 503, { ok: false, error: error.statusCode ? error.message : "ระบบไม่พร้อม กรุณาลองใหม่", ...(error.code === "COMMERCE_DISABLED" ? { code: error.code } : {}) });
  }
}
