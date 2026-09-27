import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { analyticsRange, analyticsPreset, analyticsSeries, analyticsReportCsv } from "../../src/lib/admin-analytics-report.js";
import { summarizeAnalyticsEvents } from "../../src/lib/admin-analytics.js";
import analyticsHandler from "../../api/admin/analytics.js";
import { createAuthFixture, testAccessToken } from "../helpers/supabase-auth-fixture.mjs";
import { ADMIN_ACCESS_COOKIE } from "../../api/admin/_auth.js";

test("report ranges follow complete Thai days, reject rollover, future and oversized input", () => {
  const now = new Date("2026-09-27T13:00:00Z");
  assert.deepEqual(analyticsPreset(7, now), { from: "2026-09-21", to: "2026-09-27" });
  assert.deepEqual(analyticsRange("2026-09-21", "2026-09-27", now), { from: "2026-09-21", to: "2026-09-27", since: "2026-09-20T17:00:00.000Z", until: now.toISOString() });
  assert.equal(analyticsRange("2026-09-21", "2026-09-21", now).until, "2026-09-21T16:59:59.999Z");
  for (const [from, to] of [["2026-02-30", "2026-03-01"], ["2026-09-28", "2026-09-28"], ["2026-01-01", "2026-09-27"], ["2026-09-27", "2026-09-21"], ["", "2026-09-21"]]) assert.throws(() => analyticsRange(from, to, now), { statusCode: 422 });
});

test("daily totals retain zero days, exclude admin, and never invent visitor identity or missing source", () => {
  const rows = [
    { event_type: "pageview", page_path: "/", created_at: "2026-09-21T00:00:00Z" },
    { event_type: "search", page_path: "/", created_at: "2026-09-21T00:00:00Z" },
    { event_type: "pageview", page_path: "/admin/", created_at: "2026-09-21T00:00:00Z" },
  ];
  const result = summarizeAnalyticsEvents(rows, { since: "2026-09-20T17:00:00Z", now: "2026-09-22T16:59:59Z" });
  assert.deepEqual(result.totals, { pageviews: 1, events: 1 });
  assert.deepEqual(analyticsSeries(result), [{ date: "2026-09-21", pageviews: 1, events: 1 }, { date: "2026-09-22", pageviews: 0, events: 0 }]);
  assert.equal(result.lastRecordedAt, "2026-09-21T00:00:00Z");
  assert.equal(result.referrers[0].label, "ไม่มีข้อมูลแหล่งอ้างอิง");
  assert.equal(result.visitors, undefined);
  result.coverage.limited = true;
  assert.equal(analyticsSeries(result).length, 1);
});

test("export quotes Thai and untrusted cells, preserves totals and partial report warning", () => {
  const summary = { totals: { pageviews: 1, events: 0 }, paths: { a: { path: "/", title: '=HYPERLINK("bad")', count: 1 } }, coverage: { limited: true } };
  const csv = analyticsReportCsv(summary);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /ข้อมูลบางส่วน/);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"การเปิดหน้าเว็บ","1"/);
});

test("analytics HTTP range is authorized, bounded, no-store and does not fall back on database errors", async () => {
  const auth = createAuthFixture(), queries = [];
  let failure = false;
  const db = http.createServer(async (req, res) => {
    if (await auth.handle(req, res)) return;
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/rest/v1/analytics_events") {
      queries.push(url); res.setHeader("Content-Type", "application/json");
      res.statusCode = failure ? 503 : 200;
      res.end(JSON.stringify(failure ? { message: "offline" } : [{ event_type: "pageview", page_path: "/", created_at: "2026-09-21T00:00:00Z" }])); return;
    }
    res.statusCode = 404; res.end("{}");
  });
  const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
  const dbUrl = await listen(db);
  const env = { SUPABASE_URL: dbUrl, SUPABASE_ANON_KEY: "test-public-key", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", VERCEL_ENV: "production" };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const app = http.createServer(analyticsHandler), base = await listen(app);
  const headers = { Cookie: `${ADMIN_ACCESS_COOKIE}=${testAccessToken()}` };
  try {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(`${base}?from=invalid&to=invalid`, { headers })).status, 422);
    const response = await fetch(`${base}?from=2026-09-21&to=2026-09-22`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).analytics.totals.pageviews, 1);
    assert.deepEqual(queries[0].searchParams.getAll("created_at"), ["gte.2026-09-20T17:00:00.000Z", "lte.2026-09-22T16:59:59.999Z"]);
    failure = true;
    assert.equal((await fetch(`${base}?from=2026-09-21&to=2026-09-22`, { headers })).status, 503);
  } finally {
    await new Promise(resolve => { app.closeAllConnections(); app.close(resolve); });
    await new Promise(resolve => { db.closeAllConnections(); db.close(resolve); });
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
