import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import sessionHandler from "../../api/admin/session.js";
import contentHandler from "../../api/admin/content.js";
import templeHandler from "../../api/admin/temples.js";
import mediaHandler from "../../api/admin/media.js";
import analyticsHandler from "../../api/admin/analytics.js";
import activitiesHandler from "../../api/admin/activities.js";
import { commerceActor } from "../../api/commerce/_auth.js";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, signInAdmin, readAdminSession } from "../../api/admin/_auth.js";
import { createSessionCookie, COOKIE_NAME } from "../../api/admin/_shared.js";
import { createAuthFixture, testAccessToken, TEST_ADMIN_ID, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "../helpers/supabase-auth-fixture.mjs";

const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const cookiesFrom = response => response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");

test("local preview cannot authorize hosted, configured or non-loopback requests", async () => {
  const keys = ["MONGKOLWELA_ADMIN_PREVIEW", "VERCEL", "VERCEL_ENV", "NODE_ENV", "SUPABASE_URL", "PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_KEY", "ADMIN_SESSION_SECRET"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const req = { headers: {}, socket: { remoteAddress: "127.0.0.1" } };
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; } };
  const reset = () => {
    for (const key of keys) delete process.env[key];
    process.env.MONGKOLWELA_ADMIN_PREVIEW = "1";
    process.env.ADMIN_SESSION_SECRET = "preview-only-test-secret";
  };
  try {
    reset();
    assert.equal((await signInAdmin(req, res, { password: "admin" })).actor, "local-preview:admin");
    req.headers.cookie = headers["Set-Cookie"].split(";")[0];
    assert.equal((await readAdminSession(req, res)).actor, "local-preview:admin");
    for (const [key, value] of [
      ["MONGKOLWELA_ADMIN_PREVIEW", ""], ["VERCEL", "1"], ["VERCEL_ENV", "preview"], ["NODE_ENV", "production"],
      ["SUPABASE_URL", "https://example.invalid"], ["PUBLIC_SUPABASE_URL", "https://example.invalid"],
      ["SUPABASE_ANON_KEY", "test"], ["PUBLIC_SUPABASE_ANON_KEY", "test"], ["SUPABASE_PUBLISHABLE_KEY", "test"],
      ["SUPABASE_SERVICE_ROLE_KEY", "test"], ["SUPABASE_SECRET_KEY", "test"], ["SUPABASE_SERVICE_KEY", "test"],
    ]) {
      reset();
      process.env[key] = value;
      await assert.rejects(signInAdmin(req, res, { password: "admin" }), { statusCode: 400 }, key);
      assert.equal(await readAdminSession(req, res), null, key);
    }
    reset();
    req.socket.remoteAddress = "203.0.113.5";
    await assert.rejects(signInAdmin(req, res, { password: "admin" }), { statusCode: 400 });
    assert.equal(await readAdminSession(req, res), null);
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("real handlers enforce Supabase identity, live membership, refresh, logout, origin and legacy rejection", async () => {
  const auth = createAuthFixture();
  const db = http.createServer(async (req, res) => { if (!await auth.handle(req, res)) { res.statusCode = 404; res.end("{}"); } });
  const dbUrl = await listen(db);
  const env = { SUPABASE_URL: dbUrl, SUPABASE_ANON_KEY: "test-public-key", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", ADMIN_PASSWORD: "old-password", ADMIN_SESSION_SECRET: "old-test-secret", VERCEL_ENV: "production", MONGKOLWELA_ADMIN_PREVIEW: "1" };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const app = http.createServer(sessionHandler);
  const base = await listen(app);
  const login = (body, extra = {}) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) });
  const valid = { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD, actor: "forged actor", role: "admin" };
  try {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await login({ actor: "Admin", password: "old-password" })).status, 400);
    assert.equal((await login(valid, { Origin: "https://evil.invalid" })).status, 403);
    assert.equal((await login(valid, { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await login({ ...valid, password: "wrong" })).status, 401);
    assert.equal((await login({ ...valid, email: "member@example.test" })).status, 403);
    const response = await login(valid);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { ok: true, actor: TEST_ADMIN_ID, userId: TEST_ADMIN_ID, email: TEST_ADMIN_EMAIL });
    const headers = { Cookie: cookiesFrom(response) };
    for (const cookie of response.headers.getSetCookie()) {
      assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/);
    }
    assert.equal((await fetch(base, { headers })).status, 200);
    assert.equal((await commerceActor({ headers: { cookie: headers.Cookie } })).admin, true);
    const before = auth.state.memberReads;
    assert.equal((await fetch(base, { headers })).status, 200);
    assert.equal(auth.state.memberReads, before + 1, "membership must not be cached");
    auth.state.active = false;
    assert.equal((await fetch(base, { headers })).status, 403);
    await assert.rejects(commerceActor({ headers: { cookie: headers.Cookie } }), { statusCode: 403 });
    auth.state.active = true;
    auth.state.outage = true;
    const outage = await fetch(base, { headers });
    assert.equal(outage.status, 503);
    assert.equal(outage.headers.get("set-cookie"), null, "outage must not destroy a recoverable session");
    auth.state.outage = false;
    auth.state.authOutage = true;
    assert.equal((await fetch(base, { headers })).status, 503);
    auth.state.authOutage = false;
    auth.state.confirmed = false;
    assert.equal((await login(valid)).status, 401);
    auth.state.confirmed = true;
    const reauthenticated = await login(valid);
    const expiredHeaders = { Cookie: cookiesFrom(reauthenticated).replace(/mw_admin_access=[^;]+/, `${ADMIN_ACCESS_COOKIE}=${testAccessToken(TEST_ADMIN_ID, 1)}`) };
    const renewed = await fetch(base, { headers: expiredHeaders });
    assert.equal(renewed.status, 200);
    assert.equal(auth.state.refreshes, 1);
    assert.match(renewed.headers.get("set-cookie"), new RegExp(ADMIN_REFRESH_COOKIE));
    const logout = await fetch(base, { method: "DELETE", headers: { Cookie: cookiesFrom(renewed) } });
    assert.equal(logout.status, 200);
    assert.ok(logout.headers.getSetCookie().every(cookie => cookie.includes("Max-Age=0")));
    assert.equal((await fetch(base, { headers: expiredHeaders })).status, 401, "logout revokes refresh credentials");
    assert.equal((await fetch(base, { headers: { Cookie: `${ADMIN_ACCESS_COOKIE}=%zz` } })).status, 401);
    const legacy = { cookie: `${COOKIE_NAME}=${createSessionCookie("forged admin")}` };
    for (const [handler, method] of [[contentHandler, "POST"], [templeHandler, "GET"], [mediaHandler, "GET"], [analyticsHandler, "GET"], [activitiesHandler, "GET"]]) {
      const protectedServer = http.createServer(handler);
      const url = await listen(protectedServer);
      try { assert.equal((await fetch(url, { method, headers: legacy })).status, 401); }
      finally { await close(protectedServer); }
    }
    assert.deepEqual(await commerceActor({ headers: legacy }), {});
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal((await login(valid)).status, 503, "configuration must fail closed");
  } finally {
    await close(app); await close(db);
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("membership migration blocks client reads, self-promotion and service writes", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);");
    const sql = await fs.readFile(new URL("../../supabase/migrations/20260921000000_admin_portal_members.sql", import.meta.url), "utf8");
    await db.exec(sql);
    await db.exec(sql);
    await db.query("insert into auth.users values ($1)", [TEST_ADMIN_ID]);
    await db.query("insert into admin_portal_members(user_id) values ($1)", [TEST_ADMIN_ID]);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from admin_portal_members"), /permission denied/);
      await assert.rejects(db.query("update admin_portal_members set is_active=true"), /permission denied/);
      await assert.rejects(db.query("insert into admin_portal_members(user_id) values ($1)", [TEST_ADMIN_ID]), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal((await db.query("select * from admin_portal_members")).rows.length, 1);
    await assert.rejects(db.query("update admin_portal_members set is_active=false"), /permission denied/);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [TEST_ADMIN_ID]);
    assert.equal((await db.query("select * from admin_portal_members")).rows.length, 0);
  } finally { await db.close(); }
});
