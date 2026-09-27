import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import handler from "../../api/admin/content.js";
import { ADMIN_ACCESS_COOKIE } from "../../api/admin/_auth.js";
import { createAuthFixture, testAccessToken } from "../helpers/supabase-auth-fixture.mjs";

const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };

test("CMS publish validates content, checks current membership and prevents stale or concurrent writes", async () => {
  const auth = createAuthFixture();
  let live = JSON.parse(await fs.readFile(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
  let writes = 0, revisions = 0, race = false;
  const db = http.createServer(async (req, res) => {
    if (await auth.handle(req, res)) return;
    const url = new URL(req.url, "http://localhost");
    const send = (value, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
    if (url.pathname === "/rest/v1/cms_documents") {
      if (req.method === "GET") return send({ content: live });
      if (req.method === "PATCH") {
        const next = await body(req);
        if (race) { race = false; live = { ...live, publishedAt: "2099-01-01T00:00:00Z" }; }
        if (url.searchParams.get("content->>publishedAt") !== `eq.${live.publishedAt}`) return send(null);
        writes++; live = next.content; return send({ id: next.id });
      }
    }
    if (url.pathname === "/rest/v1/cms_revisions") { revisions++; return send({}); }
    if (url.pathname === "/rest/v1/admin_audit_events") return send({});
    send({}, 404);
  });
  const dbUrl = await listen(db);
  const env = { SUPABASE_URL: dbUrl, SUPABASE_ANON_KEY: "test-public-key", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", VERCEL_ENV: "production" };
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const app = http.createServer(handler);
  const base = await listen(app);
  const headers = { "Content-Type": "application/json", Cookie: `${ADMIN_ACCESS_COOKIE}=${testAccessToken()}` };
  const post = payload => fetch(base, { method: "POST", headers, body: JSON.stringify(payload) });
  try {
    assert.equal((await fetch(`${base}?view=catalog`)).status, 401);
    assert.equal((await fetch(`${base}?view=catalog`, { headers })).status, 200);
    const original = await (await fetch(base)).json();
    const edited = structuredClone(original.content);
    edited.contentLibrary = { "seamsi.seamsiFortunes": { "1": { title: "Published reading" } } };
    edited.pages.find(page => page.id === "contact").patches = [
      { selector: "#contact-channel-data", kind: "attr", attr: "data-email", value: "support@example.com" },
      { selector: "#contact-channel-data", kind: "attr", attr: "data-line-id", value: "@support" },
      { selector: "#usage a", kind: "attr", attr: "data-email-subject", value: "สอบถามการใช้งาน" },
    ];
    edited.temples = { records: { "popular:test-sync": { collection: "popular", fields: { name: "Test", summary: "Published summary", description: "Published description", coordinateAddress: "Published address", imageAlt: "" }, images: { hero: { desktop: { url: "/test.webp" }, mobile: { url: "" } } }, visitInfo: { hours: { status: "verified", summary: "Updated hours", timetable: [{ day: "Monday", time: "10:00-16:00" }] } } } } };
    edited.pages.find(page => page.id === "travelGuide").patches = [{ selector: "#guide-hero", kind: "image", src: "/test.webp", alt: "Test", position: "30% 50%", credit: "Test credit", sourceUrl: "https://example.com/source", license: "CC", licenseUrl: "https://example.com/license" }];
    assert.equal((await post({ content: edited, expectedRevision: "stale" })).status, 409);
    assert.equal(writes, 0);
    const unsafe = structuredClone(edited);
    unsafe.contentLibrary["seamsi.seamsiFortunes"]["1"].title = "<script>bad</script>";
    assert.equal((await post({ content: unsafe, expectedRevision: original.revision })).status, 400);
    const unsafeLink = structuredClone(edited);
    unsafeLink.site.patches = [{ id: "bad-link", selector: "a", kind: "attr", attr: "href", value: "javascript:alert(1)" }];
    assert.equal((await post({ content: unsafeLink, expectedRevision: original.revision })).status, 400);
    assert.equal((await post({ content: edited, expectedRevision: original.revision })).status, 200);
    assert.equal(writes, 1); assert.equal(revisions, 1);
    assert.equal(live.contentLibrary["seamsi.seamsiFortunes"]["1"].title, "Published reading");
    assert.equal(live.pages.find(page => page.id === "contact").patches[0].value, "support@example.com");
    const published = await (await fetch(`${base}?path=${encodeURIComponent("/temples/popular/test-sync/")}`)).json();
    assert.deepEqual(published.content.temples, edited.temples);
    const guide = await (await fetch(`${base}?path=${encodeURIComponent("/guide/")}`)).json();
    assert.deepEqual(guide.content.pages[0].patches, edited.pages.find(page => page.id === "travelGuide").patches);
    assert.equal((await post({ content: edited, expectedRevision: original.revision })).status, 409);
    const latest = await (await fetch(base)).json();
    race = true;
    assert.equal((await post({ content: edited, expectedRevision: latest.revision })).status, 409);
    assert.equal(writes, 1);
    auth.state.active = false;
    assert.equal((await post({ content: edited, expectedRevision: latest.revision })).status, 403);
  } finally {
    await close(app); await close(db);
    for (const [key, value] of Object.entries(before)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
