import test from "node:test";
import assert from "node:assert/strict";
import { synchronizePlaceHistories, withoutHistoryResearch } from "../../src/lib/place-history.js";
import { publicContentPayload, publicContentForPath } from "../../src/lib/public-content.js";
import { importPlaceHistories } from "../../scripts/lib/place-history-import.mjs";
import { templeDatasets } from "../../src/lib/temple-routing.js";
import { placeHistoryImportSql } from "../../scripts/lib/place-history-sql.mjs";
import { PGlite } from "@electric-sql/pglite";
import histories from "../../docs/research/curated-place-histories.json" with { type: "json" };

const research = { key: "same-place", sources: [{ url: "https://example.com/research", title: "Internal evidence" }] };
const fixture = () => ({ temples: { records: {
  "popular:one": { collection: "popular", fields: { description: "Previous", name: "Keep" }, historyResearch: research, images: { card: "keep.webp" } },
  "sacred:two": { collection: "sacred", fields: { description: "Previous" }, historyResearch: research, enabled: false },
  "mu:other": { collection: "mu", fields: { description: "Unrelated" } },
} } });

test("public content excludes research in full, projected and revision payloads", () => {
  const content = fixture();
  for (const projected of [withoutHistoryResearch(content), publicContentPayload(content).content, publicContentForPath(content, "/temples/popular/")]) {
    assert.equal(JSON.stringify(projected).includes("Internal evidence"), false);
    assert.equal(projected.temples.records["popular:one"].fields.description, "Previous");
  }
  const revision = publicContentPayload(content).revision;
  const changed = structuredClone(content);
  changed.temples.records["popular:one"].historyResearch.sources[0].title = "Updated evidence";
  assert.equal(publicContentPayload(changed).revision, revision);
  assert.ok(content.temples.records["popular:one"].historyResearch);
});

test("CMS description edits and intentional clears sync linked memberships only", () => {
  const previous = fixture();
  for (const value of ["Edited history", ""]) {
    const next = fixture();
    next.temples.records["popular:one"].fields.description = value;
    const result = synchronizePlaceHistories(next, previous);
    assert.equal(result.temples.records["sacred:two"].fields.description, value);
    assert.equal(result.temples.records["sacred:two"].enabled, false);
    assert.equal(result.temples.records["mu:other"].fields.description, "Unrelated");
    assert.deepEqual(result.temples.records["popular:one"].images, previous.temples.records["popular:one"].images);
  }
  const conflict = fixture();
  conflict.temples.records["popular:one"].fields.description = "First";
  conflict.temples.records["sacred:two"].fields.description = "Second";
  assert.throws(() => synchronizePlaceHistories(conflict, previous), { statusCode: 400 });
});

test("old drafts cannot erase imported evidence or omit a newly imported description", () => {
  const previous = fixture(), next = fixture();
  delete next.temples.records["popular:one"].historyResearch;
  delete next.temples.records["popular:one"].fields.description;
  delete next.temples.records["sacred:two"];
  const result = synchronizePlaceHistories(next, previous);
  assert.deepEqual(result.temples.records["popular:one"].historyResearch, research);
  assert.equal(result.temples.records["popular:one"].fields.description, "Previous");
  assert.deepEqual(result.temples.records["sacred:two"], previous.temples.records["sacred:two"]);
});

const authored = () => [...new Map(Object.values(templeDatasets).flat().map(row => [`${row.name}|${row.province}`, row])).values()]
  .map(row => ({ key: `${row.name}|${row.province}`, name: row.name, province: row.province, status: "ready", description: "Test-only independently authored history", sources: research.sources }));

test("reviewed release dataset covers every curated identity and shares confirmed aliases", () => {
  const result = importPlaceHistories({}, histories, { reviewedAt: "2026-10-26" });
  assert.equal(result.report.places, 378);
  assert.equal(result.report.memberships, 625);
  const byIdentity = new Map();
  for (const record of Object.values(result.content.temples.records)) {
    const key = record.historyResearch.key;
    if (byIdentity.has(key)) assert.equal(record.fields.description, byIdentity.get(key));
    byIdentity.set(key, record.fields.description);
  }
  assert.equal(byIdentity.size, 371);
});

test("full import covers 378 identities and 625 memberships without changing other CMS fields", () => {
  const current = { navigation: { sentinel: true }, temples: { order: { popular: ["keep"] }, records: {} } };
  const first = importPlaceHistories(current, authored(), { reviewedAt: "2026-10-26" });
  assert.equal(first.report.places, 378);
  assert.equal(first.report.memberships, 625);
  assert.equal(first.report.changed, 625);
  assert.deepEqual(first.content.navigation, current.navigation);
  assert.deepEqual(first.content.temples.order, current.temples.order);
  assert.deepEqual(current.temples.records, {});
  const again = importPlaceHistories(first.content, authored(), { reviewedAt: "2026-10-26" });
  assert.equal(again.report.changed, 0);
  const key = first.report.keys[0];
  first.content.temples.records[key].fields.description = "Admin edit";
  assert.throws(() => importPlaceHistories(first.content, authored()), /Preserved Admin descriptions/);
  assert.throws(() => importPlaceHistories(current, authored().slice(1)), /Missing 1 histories/);
});

test("SQL transport atomically checks the revision, preserves data and records before/after revisions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table cms_documents(id text primary key, content jsonb, status text, published_at timestamptz, updated_at timestamptz, published_by text);
      create table cms_revisions(document_id text,content jsonb,schema_version integer,actor text,source text,published_at timestamptz);
      create table admin_audit_events(actor text,event_type text,metadata jsonb);`);
    const original = { schemaVersion: 1, navigation: { keep: true }, temples: { records: { "thailand:keep": { fields: { description: "Untouched directory" } } }, order: { popular: ["keep"] } } };
    await db.query("insert into cms_documents(id,content,status) values('live',$1::jsonb,'published')", [JSON.stringify(original)]);
    const [{ checksum }] = (await db.query("select md5(content::text) as checksum from cms_documents")).rows;
    await assert.rejects(db.exec(placeHistoryImportSql(authored(), "0".repeat(32))), /CMS changed/);
    assert.equal((await db.query("select count(*) as count from cms_revisions")).rows[0].count, 0);
    await db.exec(placeHistoryImportSql(authored(), checksum));
    const actual = (await db.query("select content from cms_documents")).rows[0].content;
    const expected = importPlaceHistories(original, authored(), { reviewedAt: "2026-10-26" }).content;
    const { publishedAt, updatedAt, publishedBy, ...rest } = actual;
    assert.deepEqual(rest, expected);
    assert.equal(publishedAt, updatedAt);
    assert.equal(publishedBy, "curated-place-history-import");
    assert.equal((await db.query("select count(*) as count from cms_revisions")).rows[0].count, 2);
    assert.deepEqual((await db.query("select content from cms_revisions where source='history-import-before'")).rows[0].content, original);
    assert.equal((await db.query("select count(*) as count from admin_audit_events")).rows[0].count, 1);
  } finally { await db.close(); }
});
