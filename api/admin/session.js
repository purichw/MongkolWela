import {
  cookieHeader,
  createSessionCookie,
  isProductionRuntime,
  readJsonBody,
  requireSameOrigin,
  sendJson,
  verifySessionCookie,
  parseCookies,
  COOKIE_NAME,
} from "./_shared.js";

function adminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const session = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
    sendJson(res, session ? 200 : 401, {
      ok: Boolean(session),
      actor: session?.actor || "",
      passwordConfigured: adminPasswordConfigured(),
    });
    return;
  }

  if (req.method === "DELETE") {
    if (!requireSameOrigin(req, res)) return;
    res.setHeader("Set-Cookie", cookieHeader("", { clear: true }));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  if (!requireSameOrigin(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req, { maxBytes: 8192 });
  } catch (error) {
    sendJson(res, error.statusCode || 400, { ok: false, error: error.message || "Invalid request body" });
    return;
  }
  const password = String(body.password || "");
  const actor = String(body.actor || "admin").trim() || "admin";
  const expected = process.env.ADMIN_PASSWORD || (isProductionRuntime() ? "" : "admin");

  if (!expected) {
    sendJson(res, 503, {
      ok: false,
      error: "ADMIN_PASSWORD is not configured for production Admin Portal",
    });
    return;
  }

  if (password !== expected) {
    sendJson(res, 401, { ok: false, error: "Invalid password" });
    return;
  }

  res.setHeader("Set-Cookie", cookieHeader(createSessionCookie(actor)));
  sendJson(res, 200, { ok: true, actor });
}
