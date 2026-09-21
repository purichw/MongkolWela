import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import contentHandler from "../../api/admin/content.js";
import dataHandler from "../../api/temple-planner/data.js";
import planHandler from "../../api/temple-planner/plan.js";
import { ADMIN_ACCESS_COOKIE } from "../../api/admin/_auth.js";
import { createAuthFixture, testAccessToken } from "../helpers/supabase-auth-fixture.mjs";

const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = (server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });
const fixture = () => ({ schemaVersion: 1, cmsContractVersion: 2, pages: [{ route: "/" }, { route: "/calendar/" }], navigation: { tabs: [], utility: [] }, temples: { records: Object.fromEntries([1, 2, 3].map((id) => [`popular:test-${id}`, { key: `popular:test-${id}`, collection: "popular", fields: { name: `Live place ${id}`, province: "Test", latitude: 13 + id / 100, longitude: 100 + id / 100 } }])) } });

test("authenticated publish -> persisted HTTP read -> planner, with outage and conflict protection", async () => {
  let published = fixture();
  let unavailable = false;
  let reads = 0;
  const auth = createAuthFixture();
  const database = http.createServer(async (req, res) => {
    if (await auth.handle(req, res)) return;
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
  Object.assign(process.env, { SUPABASE_URL: databaseUrl, SUPABASE_ANON_KEY: "test", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", ADMIN_SESSION_SECRET: "isolated-test-secret", VERCEL_ENV: "production" });
  const handlers = { "/api/admin/content": contentHandler, "/api/temple-planner/data": dataHandler, "/api/temple-planner/plan": planHandler };
  const app = http.createServer((req, res) => handlers[new URL(req.url, "http://localhost").pathname](req, res));
  const base = await listen(app);
  const headers = { "Content-Type": "application/json", Cookie: `${ADMIN_ACCESS_COOKIE}=${testAccessToken()}` };
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
    assert.match(projected.revision, /^[a-f0-9]{24}$/);
    const readCount = reads;
    const sameResponse = await fetch(`${base}/api/admin/content?path=/calendar/&revision=${projected.revision}`);
    assert.equal(sameResponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(await sameResponse.json(), { ok: true, revision: projected.revision, unchanged: true });
    assert.equal(reads, readCount + 1, "revision checks must read the source, not a cached document");
    published.pages[0].label = "Changed elsewhere";
    published.publishedAt = "2099-01-01T00:00:00.000Z";
    const unrelated = await fetch(`${base}/api/admin/content?path=/calendar/&revision=${projected.revision}`).then((response) => response.json());
    assert.equal(unrelated.unchanged, true, "unrelated edits and timestamps must not resend the current page");
    published.pages[1].label = "Direct database edit";
    const direct = await fetch(`${base}/api/admin/content?path=/calendar/&revision=${projected.revision}`).then((response) => response.json());
    assert.notEqual(direct.revision, projected.revision);
    assert.equal(direct.content.pages[0].label, "Direct database edit");
    const plannerShell = await fetch(`${base}/api/admin/content?path=/temples/planner/`).then((response) => response.json());
    assert.match(plannerShell.content.plannerDataRevision, /^[a-f0-9]{24}$/);
    assert.equal(plannerShell.content.temples, undefined);
    const sameCatalog = await fetch(`${base}/api/temple-planner/data?revision=${latest.revision}`).then((response) => response.json());
    assert.deepEqual(sameCatalog, { revision: latest.revision, unchanged: true });
    changed.temples.records["popular:test-1"].status = "deleted";
    await send("/api/admin/content", { content: changed });
    const deleted = await fetch(`${base}/api/temple-planner/data`).then((response) => response.json());
    assert.ok(!deleted.items.some((item) => item.id === "popular:test-1"));
    unavailable = true;
    assert.equal((await fetch(`${base}/api/temple-planner/data`)).status, 503);
    assert.equal((await fetch(`${base}/api/admin/content`)).status, 503);
    assert.equal((await fetch(`${base}/api/admin/content?path=/calendar/&revision=${direct.revision}`)).status, 503);
    unavailable = false;
    assert.equal((await fetch(`${base}/api/temple-planner/data`)).status, 200);
    assert.ok(reads >= 7, "each operation must read the current published source");
  } finally {
    await close(app);
    await close(database);
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
