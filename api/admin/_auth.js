import { createClient } from "@supabase/supabase-js";
import { databaseConfig, supabaseClient } from "./_database.js";
import { parseCookies, requireSameOrigin, sendJson, isProductionRuntime, COOKIE_NAME, createSessionCookie, verifySessionCookie, cookieHeader } from "./_shared.js";

export const ADMIN_ACCESS_COOKIE = "mw_admin_access";
export const ADMIN_REFRESH_COOKIE = "mw_admin_refresh";
const COOKIE_MAX_AGE = 12 * 60 * 60;

// Existing activities/commerce test harnesses opt in on loopback only, without
// any hosted environment or Supabase credentials. Never used to test Auth.
function isLocalPreview(req) {
  const config = databaseConfig();
  return process.env.MONGKOLWELA_ADMIN_PREVIEW === "1"
    && !process.env.VERCEL && !process.env.VERCEL_ENV && !isProductionRuntime()
    && !config.url && !config.anonKey && !config.serviceRoleKey
    && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket?.remoteAddress);
}

function authError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

export function adminAuthClient() {
  const { url, anonKey, serviceRoleKey } = databaseConfig();
  if (!url || !anonKey || !serviceRoleKey) {
    throw authError(503, "ยังตั้งค่าระบบเข้าสู่ระบบไม่ครบ กรุณาติดต่อผู้ดูแล");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store", signal: options.signal || AbortSignal.timeout(10000) }),
    },
  });
}

function cookie(name, value, maxAge) {
  const secure = process.env.VERCEL || isProductionRuntime() ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

export function clearAdminCookies(res) {
  res.setHeader("Set-Cookie", [ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, COOKIE_NAME].map(name => cookie(name, "", 0)));
}

function setAdminCookies(res, session) {
  if (!session?.access_token || !session?.refresh_token) throw authError(503, "ไม่สามารถสร้างเซสชันได้ กรุณาลองใหม่");
  res.setHeader("Set-Cookie", [
    cookie(ADMIN_ACCESS_COOKIE, session.access_token, COOKIE_MAX_AGE),
    cookie(ADMIN_REFRESH_COOKIE, session.refresh_token, COOKIE_MAX_AGE),
    cookie(COOKIE_NAME, "", 0),
  ]);
}

function sessionCookies(req) {
  try { return parseCookies(req); }
  catch { throw authError(401, "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่"); }
}

function checkAuthResult(error, login = false) {
  if (!error) return;
  if (error.status === 429) throw authError(429, "มีคำขอเข้าสู่ระบบมากเกินไป กรุณารอสักครู่");
  if (!error.status || error.status >= 500) throw authError(503, "ระบบยืนยันตัวตนไม่พร้อมใช้งาน กรุณาลองใหม่");
  throw authError(401, login ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่พร้อมใช้งาน" : "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
}

async function authorizeUser(user) {
  if (!user?.id || !user.email_confirmed_at) throw authError(401, "กรุณายืนยันอีเมลและเข้าสู่ระบบใหม่");
  const client = supabaseClient({ service: true });
  if (!client) throw authError(503, "ยังตั้งค่าระบบตรวจสิทธิ์ไม่ครบ");
  const { data, error } = await client.from("admin_portal_members")
    .select("user_id,is_active").eq("user_id", user.id).maybeSingle();
  if (error) throw authError(503, "ไม่สามารถตรวจสิทธิ์ผู้ดูแลได้ กรุณาลองใหม่");
  if (data?.user_id !== user.id || data.is_active !== true) throw authError(403, "บัญชีนี้ไม่มีสิทธิ์เข้าระบบจัดการเว็บ");
  return { actor: user.id, userId: user.id, email: user.email || "" };
}

export async function signInAdmin(req, res, body) {
  if (isLocalPreview(req)) {
    if (body.password !== "admin") throw authError(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    res.setHeader("Set-Cookie", cookieHeader(createSessionCookie("local-preview:admin")));
    return { actor: "local-preview:admin", userId: "", email: "admin@example.test" };
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || email.length > 254 || !email.includes("@") || !password || password.length > 4096) {
    throw authError(400, "กรุณากรอกอีเมลและรหัสผ่าน");
  }
  const auth = adminAuthClient();
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  checkAuthResult(error, true);
  try {
    const actor = await authorizeUser(data.user);
    setAdminCookies(res, data.session);
    return actor;
  } catch (error) {
    // Do not retain a newly issued session for an account without portal access.
    if (data.session?.access_token) await auth.auth.admin.signOut(data.session.access_token, "local").catch(() => {});
    throw error;
  }
}

export async function readAdminSession(req, res) {
  const cookies = sessionCookies(req);
  if (isLocalPreview(req)) {
    const preview = verifySessionCookie(cookies[COOKIE_NAME]);
    if (preview?.actor === "local-preview:admin") return { actor: preview.actor, userId: "", email: "admin@example.test" };
  }
  const access = cookies[ADMIN_ACCESS_COOKIE];
  const refresh = cookies[ADMIN_REFRESH_COOKIE];
  if (!access && !refresh) return null;
  const auth = adminAuthClient();
  let result = access ? await auth.auth.getUser(access) : { data: { user: null }, error: { status: 401 } };
  let renewed;
  if (result.error && (result.error.status === 401 || result.error.code === "bad_jwt") && refresh && res) {
    const fresh = await auth.auth.refreshSession({ refresh_token: refresh });
    checkAuthResult(fresh.error);
    renewed = fresh.data.session;
    result = { data: { user: fresh.data.user }, error: null };
  }
  checkAuthResult(result.error);
  const actor = await authorizeUser(result.data.user);
  if (renewed) setAdminCookies(res, renewed);
  return actor;
}

export async function requireAdmin(req, res) {
  if (!requireSameOrigin(req, res)) return null;
  try {
    const actor = await readAdminSession(req, res);
    if (!actor) throw authError(401, "กรุณาเข้าสู่ระบบผู้ดูแล");
    return actor;
  } catch (error) {
    if ([401, 403].includes(error.statusCode)) clearAdminCookies(res);
    sendJson(res, error.statusCode || 503, { ok: false, error: error.statusCode ? error.message : "ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาลองใหม่" });
    return null;
  }
}

export async function signOutAdmin(req, res) {
  try {
    const cookies = sessionCookies(req);
    let access = cookies[ADMIN_ACCESS_COOKIE];
    if (!access && !cookies[ADMIN_REFRESH_COOKIE]) return;
    const auth = adminAuthClient();
    let result = access ? await auth.auth.admin.signOut(access, "local") : { error: { status: 401 } };
    if ([401, 403].includes(result.error?.status) && cookies[ADMIN_REFRESH_COOKIE]) {
      const refreshed = await auth.auth.refreshSession({ refresh_token: cookies[ADMIN_REFRESH_COOKIE] });
      if (refreshed.error?.status === 400 || refreshed.error?.status === 401) return;
      checkAuthResult(refreshed.error);
      access = refreshed.data.session.access_token;
      result = await auth.auth.admin.signOut(access, "local");
    }
    if (result.error && ![401, 403, 404].includes(result.error.status)) checkAuthResult(result.error);
  } finally {
    clearAdminCookies(res);
  }
}
