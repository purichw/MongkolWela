import { test } from "node:test";
import assert from "node:assert/strict";
import { collectAdminMedia, catalogTaxonomy, mediaProviderStatus } from "../../src/scripts/admin/data.js";
import { summarizeAnalyticsEvents } from "../../src/lib/admin-analytics.js";
import { readLiveAnalytics } from "../../api/admin/_shared.js";
import { createTempleEditor } from "../../src/scripts/admin/editor.js";

test("image fallback respects desktop, legacy variants and explicit CMS clears", () => {
  const { templeImageValue } = createTempleEditor({ state: {} });
  const record = { temple: { imageUrl: "/original.webp" } };
  assert.equal(templeImageValue(record, null, "card", "desktop"), "/original.webp");
  assert.equal(templeImageValue(record, { images: { card: { desktop: { url: "" } } } }, "card", "desktop"), "");
  assert.equal(templeImageValue(record, { images: { card: { desktop: "/legacy.webp" } } }, "card", "mobile"), "/legacy.webp");
});

test("media inventory counts references, clears, real filenames, and all records", () => {
  const pages = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, patches: [{ kind: "image", src: `/media/p${i}.webp` }] }));
  pages[0].patches.push({ kind: "image", src: "/media/p0.webp" }, { kind: "image", src: "" }, { kind: "image", src: "https://[invalid" });
  pages[0].blocks = [{ type: "hero", props: { image: "/media/p0.webp" }, enabled: false }];
  const catalog = [{ key: "t1", temple: { name: "สถานที่" } }];
  const rows = collectAdminMedia({ pages }, catalog, (_place, _edit, role, viewport) => role === "card" && viewport === "desktop" ? "/media/p0.webp" : "");
  assert.equal(rows.length, 12);
  assert.equal(rows[0].name, "p0.webp");
  assert.equal(rows[0].references.length, 4);
  assert.equal(rows[0].references.filter(ref => !ref.enabled).length, 1);
  assert.equal(rows[0].references.at(-1).templeKey, "t1");
});

test("taxonomy and provider labels come from data, not a fixed option list", () => {
  const result = catalogTaxonomy([{ temple: { region: "ภาคตะวันตก", travelModes: "เรือ; รถไฟ; เรือ" } }, { temple: { region: "ภาคตะวันตก", travelModes: ["รถไฟ"] } }, { temple: {} }]);
  assert.deepEqual(result.regions, [{ label: "ภาคตะวันตก", count: 2 }]);
  assert.equal(result.modes.find(row => row.label === "เรือ").count, 1);
  assert.equal(result.modes.find(row => row.label === "รถไฟ").count, 2);
  assert.deepEqual(catalogTaxonomy([]), { regions: [], modes: [] });
  assert.match(mediaProviderStatus({ provider: "imagekit", imagekit: { enabled: false } }), /ยังไม่ได้ตั้งค่า/);
  assert.match(mediaProviderStatus({ provider: "imagekit", imagekit: { enabled: true } }), /พร้อมใช้งาน/);
  assert.match(mediaProviderStatus({}, true), /ไม่สามารถโหลด/);
});

test("analytics aggregates real events in Thai time without inventing users or attribution", () => {
  const row = (created_at, extra = {}) => ({ event_type: "pageview", page_path: "/temples/", page_title: "วัด", created_at, ...extra });
  const summary = summarizeAnalyticsEvents([
    row("2026-09-21T00:00:00Z", { referrer: "https://example.org/search?q=private" }),
    row("2026-09-20T18:00:00Z"),
    row("2026-09-20T01:00:00Z", { referrer: "not-a-url" }),
    row("2026-09-20T01:00:00Z", { event_type: "search" }),
  ], { since: "2026-06-23", now: "2026-09-21T03:00:00Z", limited: true });
  assert.deepEqual(summary.totals, { pageviews: 3, events: 1 });
  assert.deepEqual(summary.daily, [{ date: "2026-09-20", count: 1 }, { date: "2026-09-21", count: 2 }]);
  assert.equal(summary.paths["/temples/"].lastSeenAt, "2026-09-21T00:00:00Z");
  assert.deepEqual(summary.referrers, [{ label: "ไม่มีข้อมูลแหล่งอ้างอิง", count: 2 }, { label: "example.org", count: 1 }]);
  assert.equal(summary.coverage.limited, true);
  assert.equal(summary.returningUsers, undefined);
  assert.deepEqual(summarizeAnalyticsEvents([], {}).daily, []);
});

test("live analytics pages database rows and fails explicitly instead of falling back", async t => {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { SUPABASE_URL: "https://analytics.example.test", SUPABASE_SERVICE_ROLE_KEY: "test-key", SUPABASE_SECRET_KEY: "" });
  const urls = [];
  let failure = false;
  t.mock.method(globalThis, "fetch", async input => {
    const url = new URL(input);
    assert.equal(url.hostname, "analytics.example.test");
    urls.push(url);
    if (failure) return new Response(JSON.stringify({ message: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } });
    const offset = Number(url.searchParams.get("offset") || 0);
    const rows = Array.from({ length: offset === 0 ? 500 : 1 }, () => ({ event_type: "pageview", page_path: "/", created_at: new Date().toISOString() }));
    return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
  });
  try {
    const summary = await readLiveAnalytics();
    assert.equal(summary.totals.pageviews, 501);
    assert.equal(urls.length, 2);
    assert.equal(urls[1].searchParams.get("offset"), "500");
    assert.equal(summary.coverage.limited, false);
    failure = true;
    await assert.rejects(readLiveAnalytics(), error => error.statusCode === 503);
  } finally {
    for (const [name, value] of Object.entries(previous)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
