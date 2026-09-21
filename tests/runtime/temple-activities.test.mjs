import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { validateActivity, activityIsPast, publicActivities, bangkokToday } from "../../src/lib/temple-activities.js";
import adminHandler from "../../api/admin/activities.js";
import publicHandler from "../../api/temple-activities.js";
import { ADMIN_ACCESS_COOKIE } from "../../api/admin/_auth.js";
import { createAuthFixture, testAccessToken } from "../helpers/supabase-auth-fixture.mjs";

const input = (overrides = {}) => ({ templeId: "popular:test-activity", title: "กิจกรรมทดสอบ", type: "ceremony", status: "published", startDate: "2099-10-01", endDate: "", timeMode: "unknown", sourceUrl: "https://example.org/announcement", verifiedAt: "2026-09-01", ...overrides });

test("activities require verified sources, safe URLs, real dates and Bangkok time boundaries", () => {
  assert.equal(bangkokToday(new Date("2026-09-20T18:00:00Z")), "2026-09-21");
  for (const invalid of [{ sourceUrl: "" }, { verifiedAt: "2099-01-01" }, { startDate: "2026-02-30" }, { sourceUrl: "javascript:alert(1)" }, { registrationUrl: "data:text/html,test" }, { endDate: "2000-01-01" }, { status: "cancelled", statusNote: "" }, { timeMode: "timed", startTime: "" }, { timeMode: "timed", startTime: "10:00", endTime: "09:00" }]) assert.throws(() => validateActivity(input(invalid)), { statusCode: 422 });
  assert.doesNotThrow(() => validateActivity(input({ status: "draft", startDate: "", sourceUrl: "", verifiedAt: "" })));
  for (const imageUrl of ["javascript:alert(1)", "data:image/svg+xml,test", "http://example.org/image.jpg", "//example.org/image.jpg", "https://user:pass@example.org/image.jpg"]) assert.throws(() => validateActivity(input({ imageUrl })), { statusCode: 422 });
  assert.equal(validateActivity(input()).imageUrl, "");
  assert.equal(validateActivity(input({ imageUrl: "/assets/images/test.jpg", imageAlt: "ภาพกิจกรรม" })).imageAlt, "ภาพกิจกรรม");
  assert.throws(() => validateActivity(input(), { templeIds: new Set() }), { statusCode: 422 });
  const event = validateActivity(input({ startDate: "2026-09-21", timeMode: "allDay" }));
  assert.equal(activityIsPast(event, new Date("2026-09-21T16:59:59Z")), false);
  assert.equal(activityIsPast(event, new Date("2026-09-21T17:00:00Z")), true);
  assert.equal(activityIsPast({ ...event, timeMode: "timed", endTime: "09:00" }, new Date("2026-09-21T02:00:01Z")), true);
  assert.equal(activityIsPast({ ...event, status: "postponed" }, new Date("2027-01-01")), false);
  const visible = publicActivities([{ ...event, id: "1", updatedBy: "private", history: ["private"], version: "private" }, { ...event, id: "2", status: "draft" }, { ...event, id: "3", status: "archived" }, { ...event, id: "4", templeId: "other" }], event.templeId);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].updatedBy, undefined);
  assert.equal(visible[0].history, undefined);
  assert.equal(visible[0].version, undefined);
});

const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = (server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });

test("private persistence, publish, revision refresh, CAS, auth, cancellation and source outage", async () => {
  const documents = new Map();
  const live = { pages: [], navigation: { tabs: [], utility: [] }, temples: { records: { "popular:test-activity": { collection: "popular", slug: "test-activity", fields: { name: "วัดทดสอบ", province: "ทดสอบ" } } } } };
  let outage = false;
  const auth = createAuthFixture();
  const database = http.createServer(async (req, res) => {
    if (await auth.handle(req, res)) return;
    res.setHeader("Content-Type", "application/json");
    if (outage) { res.statusCode = 503; res.end('{"message":"test outage"}'); return; }
    const url = new URL(req.url, "http://localhost");
    if (url.searchParams.get("id") === "eq.live") { res.end(JSON.stringify({ content: live })); return; }
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    if (req.method === "GET") {
      if (id?.startsWith("activity:")) { res.end(JSON.stringify(documents.has(id) ? { content: documents.get(id).content } : null)); return; }
      let rows = [...documents.values()];
      const templeId = url.searchParams.get("content->>templeId")?.replace(/^eq\./, "");
      if (templeId) rows = rows.filter((row) => row.content.templeId === templeId);
      if (url.searchParams.has("content->>status")) rows = rows.filter((row) => ["published", "postponed", "cancelled"].includes(row.content.status));
      res.end(JSON.stringify(rows)); return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (req.method === "PATCH" && documents.get(id)?.content.version !== url.searchParams.get("content->>version")?.replace(/^eq\./, "")) { res.end("[]"); return; }
    documents.set(body.id, body);
    res.end(JSON.stringify([{ content: body.content }]));
  });
  const databaseUrl = await listen(database);
  const keys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_SESSION_SECRET", "VERCEL_ENV"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { SUPABASE_URL: databaseUrl, SUPABASE_ANON_KEY: "test", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", ADMIN_SESSION_SECRET: "activity-test", VERCEL_ENV: "production" });
  const app = http.createServer((req, res) => (req.url.startsWith("/api/admin/activities") ? adminHandler : publicHandler)(req, res));
  const base = await listen(app);
  const headers = { "Content-Type": "application/json", Cookie: `${ADMIN_ACCESS_COOKIE}=${testAccessToken()}` };
  const save = (body, extra = headers) => fetch(`${base}/api/admin/activities`, { method: "POST", headers: extra, body: JSON.stringify(body) });
  const read = (query = "") => fetch(`${base}/api/temple-activities?templeId=popular:test-activity${query}`);
  try {
    assert.equal((await fetch(`${base}/api/admin/activities`)).status, 401);
    assert.equal((await save({ event: input() }, {})).status, 401);
    assert.equal((await save({ event: input() }, { ...headers, Origin: "https://foreign.invalid" })).status, 403);
    assert.equal((await save({ event: input({ sourceUrl: "" }) })).status, 422);
    assert.equal((await save({ event: input({ templeId: "missing" }) })).status, 422);
    const draft = await (await save({ event: input({ status: "draft" }) })).json();
    assert.equal(draft.ok, true);
    assert.equal((await (await read()).json()).events.length, 0);
    assert.equal(documents.get(`activity:${draft.event.id}`).status, "draft", "document remains private even when its event is published");
    const body = { id: draft.event.id, expectedVersion: draft.event.version, event: input({ imageUrl: "https://example.org/event.jpg", imageAlt: "ภาพกิจกรรม" }) };
    const [first, conflict] = await Promise.all([save(body), save(body)]);
    assert.deepEqual([first.status, conflict.status].sort(), [200, 409]);
    const saved = await (first.status === 200 ? first : conflict).json();
    const response = await read();
    assert.equal(response.headers.get("cache-control"), "no-store");
    const publicData = await response.json();
    assert.equal(publicData.events.length, 1);
    assert.equal(publicData.events[0].imageUrl, "https://example.org/event.jpg");
    assert.equal(publicData.events[0].imageAlt, "ภาพกิจกรรม");
    assert.equal(publicData.events[0].history, undefined);
    assert.equal(publicData.events[0].updatedBy, undefined);
    assert.equal((await (await read(`&revision=${publicData.revision}`)).json()).unchanged, true);
    const cancelled = await (await save({ id: saved.event.id, expectedVersion: saved.event.version, event: input({ status: "cancelled", statusNote: "ยกเลิกตามประกาศใหม่" }) })).json();
    assert.equal(cancelled.event.status, "cancelled");
    const changed = await (await read(`&revision=${publicData.revision}`)).json();
    assert.equal(changed.events[0].status, "cancelled");
    assert.equal(changed.events[0].imageUrl, "");
    assert.notEqual(changed.revision, publicData.revision);
    documents.get(`activity:${saved.event.id}`).content.title = "Direct database update";
    assert.equal((await (await read()).json()).events[0].title, "Direct database update");
    const admin = await fetch(`${base}/api/admin/activities`, { headers }).then((response) => response.json());
    assert.equal(admin.events[0].history.length, 2);
    live.temples.records["popular:test-activity"].status = "deleted";
    assert.equal((await read()).status, 404);
    delete live.temples.records["popular:test-activity"].status;
    outage = true;
    assert.equal((await read()).status, 503);
    assert.equal((await fetch(`${base}/api/admin/activities`, { headers })).status, 503);
  } finally {
    await close(app); await close(database);
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
