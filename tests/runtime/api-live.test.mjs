import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import contentHandler from "../../api/admin/content.js";
import dataHandler from "../../api/temple-planner/data.js";
import planHandler from "../../api/temple-planner/plan.js";
import { createSessionCookie, COOKIE_NAME } from "../../api/admin/_shared.js";

const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = (server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });
const fixture = () => ({ schemaVersion: 1, cmsContractVersion: 2, pages: [{ route: "/" }, { route: "/calendar/" }], navigation: { tabs: [], utility: [] }, temples: { records: Object.fromEntries([1, 2, 3].map((id) => [`popular:test-${id}`, { key: `popular:test-${id}`, collection: "popular", fields: { name: `Live place ${id}`, province: "Test", latitude: 13 + id / 100, longitude: 100 + id / 100 } }])) } });

test("authenticated publish -> persisted HTTP read -> planner, with outage and conflict protection", async () => {
  let published = fixture();
  let unavailable = false;
  let reads = 0;
  const database = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (unavailable) { res.statusCode = 503; res.end('{"message":"test outage"}'); return; }
    if (req.method === "GET") { reads++; res.end(JSON.stringify({ content: published })); return; }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    if (req.url.startsWith("/rest/v1/cms_documents")) published = body.content;
    res.end("[]");
  });
  const databaseUrl = await listen(database);
  const keys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_SESSION_SECRET", "VERCEL_ENV"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { SUPABASE_URL: databaseUrl, SUPABASE_ANON_KEY: "test", SUPABASE_SERVICE_ROLE_KEY: "test", ADMIN_SESSION_SECRET: "isolated-test-secret", VERCEL_ENV: "production" });
  const handlers = { "/api/admin/content": contentHandler, "/api/temple-planner/data": dataHandler, "/api/temple-planner/plan": planHandler };
  const app = http.createServer((req, res) => handlers[new URL(req.url, "http://localhost").pathname](req, res));
  const base = await listen(app);
  const headers = { "Content-Type": "application/json", Cookie: `${COOKIE_NAME}=${createSessionCookie("Test editor")}` };
  const send = (path, body, extra = headers) => fetch(`${base}${path}`, { method: "POST", headers: extra, body: JSON.stringify(body) });
  try {
    assert.equal((await send("/api/admin/content", { content: published }, {})).status, 401);
    assert.equal((await send("/api/admin/content", { content: published }, { ...headers, Origin: "https://cross-site.invalid" })).status, 403);
    const initial = await fetch(`${base}/api/temple-planner/data`).then((response) => response.json());
    const changed = structuredClone(published);
    changed.temples.records["popular:test-1"].fields.name = "Published replacement";
    assert.equal((await send("/api/admin/content", { content: changed })).status, 200);
    const response = await fetch(`${base}/api/temple-planner/data`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const latest = await response.json();
    assert.ok(latest.items.some((item) => item.id === "popular:test-1" && item.name === "Published replacement"));
    assert.notEqual(latest.revision, initial.revision);
    const request = { mode: "manual", criteria: { count: 3, province: "Test" }, selectedIds: [1, 2, 3].map((id) => `popular:test-${id}`), revision: initial.revision };
    assert.equal((await send("/api/temple-planner/plan", request)).status, 409);
    request.revision = latest.revision;
    assert.equal((await send("/api/temple-planner/plan", { ...request, criteria: { ...request.criteria, start: "removed-id" } })).status, 422);
    const plan = await send("/api/temple-planner/plan", request).then((response) => response.json());
    assert.equal(plan.ok, true);
    assert.equal(plan.items.length, 3);
    assert.ok(plan.items.some((item) => item.name === "Published replacement"));
    const projected = await fetch(`${base}/api/admin/content?path=/calendar/`).then((response) => response.json());
    assert.equal(projected.content.pages.length, 1);
    assert.equal(projected.content.temples, undefined);
    changed.temples.records["popular:test-1"].status = "deleted";
    await send("/api/admin/content", { content: changed });
    const deleted = await fetch(`${base}/api/temple-planner/data`).then((response) => response.json());
    assert.ok(!deleted.items.some((item) => item.id === "popular:test-1"));
    unavailable = true;
    assert.equal((await fetch(`${base}/api/temple-planner/data`)).status, 503);
    assert.equal((await fetch(`${base}/api/admin/content`)).status, 503);
    unavailable = false;
    assert.equal((await fetch(`${base}/api/temple-planner/data`)).status, 200);
    assert.ok(reads >= 7, "each operation must read the current published source");
  } finally {
    await close(app);
    await close(database);
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
