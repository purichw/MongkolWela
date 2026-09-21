import { createClient } from "@supabase/supabase-js";
import { databaseConfig } from "../admin/_database.js";
import { parseCookies, verifySessionCookie, createSessionCookie, isProductionRuntime } from "../admin/_shared.js";
import { isLocalCommercePreview } from "./_store.js";
import { fail } from "./_domain.js";
import { readAdminSession } from "../admin/_auth.js";

export const SELLER_COOKIE = "mw_seller_session";
export function sellerAuthClient() {
  const config = databaseConfig();
  if (!config.url || !config.anonKey) fail("ยังไม่ตั้งค่าระบบบัญชีผู้ขาย", 503);
  return createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function sellerCookie(value, maxAge = 3600) {
  return `${SELLER_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.VERCEL || isProductionRuntime() ? "; Secure" : ""}`;
}
export async function commerceActor(req, res) {
  let cookies;
  try { cookies = parseCookies(req); } catch { fail("เซสชันไม่ถูกต้อง", 401); }
  const admin = await readAdminSession(req, res);
  if (admin) return { admin: true, actor: admin.actor };
  const token = cookies[SELLER_COOKIE];
  if (!token) return {};
  if (isLocalCommercePreview()) {
    const local = verifySessionCookie(token);
    if (local?.actor?.startsWith("commerce-preview:")) return { userId: local.actor.slice("commerce-preview:".length) };
  }
  const { data, error } = await sellerAuthClient().auth.getUser(token);
  if (error || !data?.user) fail("กรุณาเข้าสู่ระบบใหม่", 401);
  return { userId: data.user.id };
}
export function localSellerToken(userId) { return createSessionCookie(`commerce-preview:${userId}`); }
