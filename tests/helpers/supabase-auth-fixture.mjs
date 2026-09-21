import crypto from "node:crypto";

export const TEST_ADMIN_ID = "11111111-1111-4111-8111-111111111111";
export const TEST_MEMBER_ID = "22222222-2222-4222-8222-222222222222";
export const TEST_ADMIN_EMAIL = "admin@example.test";
export const TEST_ADMIN_PASSWORD = "test-only-password";
export const testAccessToken = (id = TEST_ADMIN_ID, exp = Math.floor(Date.now() / 1000) + 3600) =>
  [JSON.stringify({ alg: "HS256", typ: "JWT" }), JSON.stringify({ sub: id, exp, role: "authenticated", session_id: id })]
    .map(value => Buffer.from(value).toString("base64url")).concat("test-signature").join(".");

export function createAuthFixture() {
  const state = { active: true, outage: false, authOutage: false, confirmed: true, banned: false, refreshes: 0, signouts: 0, memberReads: 0 };
  const refreshTokens = new Map();
  const user = (id) => ({ id, email: id === TEST_ADMIN_ID ? TEST_ADMIN_EMAIL : "member@example.test", email_confirmed_at: state.confirmed ? "2026-01-01T00:00:00Z" : null, app_metadata: {}, user_metadata: { role: "admin" } });
  const session = (id) => {
    const refresh = crypto.randomUUID();
    refreshTokens.set(refresh, id);
    return { access_token: testAccessToken(id), refresh_token: refresh, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(id) };
  };
  async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/auth/v1/") && url.pathname !== "/rest/v1/admin_portal_members") return false;
    res.setHeader("Content-Type", "application/json");
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); return true; };
    if (url.pathname === "/rest/v1/admin_portal_members") {
      state.memberReads++;
      if (state.outage) return send(503, { message: "fixture outage" });
      if (req.headers.apikey !== "test-service-key") return send(403, { message: "private table" });
      const id = url.searchParams.get("user_id")?.replace("eq.", "");
      return send(200, id === TEST_ADMIN_ID ? { user_id: id, is_active: state.active } : null);
    }
    if (state.authOutage) return send(503, { msg: "Auth unavailable" });
    if (url.pathname === "/auth/v1/token") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      if (url.searchParams.get("grant_type") === "refresh_token") {
        state.refreshes++;
        const id = refreshTokens.get(body.refresh_token);
        if (!id || state.banned) return send(400, { code: "refresh_token_not_found", msg: "Invalid refresh token" });
        return send(200, session(id));
      }
      const id = body.email === TEST_ADMIN_EMAIL ? TEST_ADMIN_ID : body.email === "member@example.test" ? TEST_MEMBER_ID : "";
      if (!id || body.password !== TEST_ADMIN_PASSWORD || state.banned) return send(400, { code: "invalid_credentials", msg: "Invalid login credentials" });
      return send(200, session(id));
    }
    let claims;
    try { claims = JSON.parse(Buffer.from(String(req.headers.authorization).split(" ")[1].split(".")[1], "base64url")); } catch {}
    if (!claims?.sub || ![TEST_ADMIN_ID, TEST_MEMBER_ID].includes(claims.sub) || claims.exp <= Date.now() / 1000 || state.banned) {
      return send(401, { code: "bad_jwt", msg: "Invalid JWT" });
    }
    if (url.pathname === "/auth/v1/logout") {
      state.signouts++;
      for (const [token, id] of refreshTokens) if (id === claims.sub) refreshTokens.delete(token);
      return send(200, {});
    }
    if (url.pathname === "/auth/v1/user") return send(200, user(claims.sub));
    return send(404, {});
  }
  return { state, handle };
}
