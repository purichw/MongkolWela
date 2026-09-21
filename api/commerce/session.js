import { sendJson, readJsonBody, requireSameOrigin } from "../admin/_shared.js";
import { commerceActor, sellerAuthClient, sellerCookie, localSellerToken } from "./_auth.js";
import { isLocalCommercePreview, readCommerce, requireCommerceEnabled } from "./_store.js";
import { privateCommerce, fail } from "./_domain.js";

export default async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  try {
    if (req.method === "DELETE") { res.setHeader("Set-Cookie", sellerCookie("", 0)); return sendJson(res, 200, { ok: true }); }
    requireCommerceEnabled();
    if (req.method === "GET") { const actor = await commerceActor(req, res); privateCommerce(await readCommerce(), actor); return sendJson(res, 200, { ok: true, admin: Boolean(actor.admin) }); }
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    const body = await readJsonBody(req, { maxBytes: 12000 });
    if (isLocalCommercePreview()) {
      const match = (await readCommerce()).members.find(m => m.email === body.email && m.status === "active");
      if (!match || body.password !== process.env.MONGKOLWELA_PREVIEW_PASSWORD) fail("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401);
      res.setHeader("Set-Cookie", sellerCookie(localSellerToken(match.userId)));
    } else {
      const auth = sellerAuthClient();
      const result = body.accessToken
        ? await auth.auth.getUser(String(body.accessToken))
        : await auth.auth.signInWithPassword({ email: String(body.email || ""), password: String(body.password || "") });
      if (result.error || !result.data.user) fail("เข้าสู่ระบบไม่สำเร็จ", 401);
      privateCommerce(await readCommerce(), { userId: result.data.user.id });
      if (body.newPassword) {
        if (String(body.newPassword).length < 12 || !body.refreshToken) fail("รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร");
        const session = await auth.auth.setSession({ access_token: body.accessToken, refresh_token: body.refreshToken });
        if (session.error) fail("ลิงก์เชิญหมดอายุ", 401);
        const updated = await auth.auth.updateUser({ password: body.newPassword });
        if (updated.error) fail("ตั้งรหัสผ่านไม่สำเร็จ");
      }
      res.setHeader("Set-Cookie", sellerCookie(body.accessToken || result.data.session.access_token));
    }
    sendJson(res, 200, { ok: true });
  } catch (error) { sendJson(res, error.statusCode || 503, { ok: false, error: error.statusCode ? error.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่" }); }
}
