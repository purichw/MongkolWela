import { readJsonBody, requireSameOrigin, sendJson } from "./_shared.js";
import { clearAdminCookies, requireAdmin, signInAdmin, signOutAdmin } from "./_auth.js";

export default async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "GET, POST, DELETE" });
  }

  if (!requireSameOrigin(req, res)) return;

  try {
    if (req.method === "GET") {
      const actor = await requireAdmin(req, res);
      if (actor) sendJson(res, 200, { ok: true, ...actor });
      return;
    }
    if (req.method === "DELETE") {
      await signOutAdmin(req, res);
      return sendJson(res, 200, { ok: true });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
      return sendJson(res, 415, { ok: false, error: "Content-Type must be application/json" });
    }
    const body = await readJsonBody(req, { maxBytes: 8192 });
    const actor = await signInAdmin(req, res, body);
    sendJson(res, 200, { ok: true, ...actor });
  } catch (error) {
    if ([401, 403].includes(error.statusCode)) clearAdminCookies(res);
    sendJson(res, error.statusCode || 503, { ok: false, error: error.statusCode ? error.message : "ระบบเข้าสู่ระบบไม่พร้อมใช้งาน กรุณาลองใหม่" });
  }
}
