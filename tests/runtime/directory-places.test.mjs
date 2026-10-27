import test from "node:test";
import assert from "node:assert/strict";
import { parsePlusCode, directoryLocationErrors, directoryMapLinks, directoryPublicPlaces, validateDirectoryRecords } from "../../src/lib/directory-places.js";
import { thailandBasePlaces, thailandPublicPlaces, thailandDirectoryPage, thailandCuratedBasePlaces } from "../../src/data/thailand-places.js";
import { placeMetadata, mergePlaceMetadata } from "../../src/lib/place-metadata.js";
import { templeRouteCatalog, prepareTempleSlugPublication } from "../../src/lib/temple-routing.js";
import { publicContentForPath, publicContentPayload } from "../../src/lib/public-content.js";
import { templeCatalogFromContent } from "../../api/admin/temples.js";

const key = "thailand:admin-test";
const baselineCount = thailandPublicPlaces({}).length;
const contentWith = fields => ({ temples: { records: { [key]: { key, collection: "thailand", source: "admin", fields: { name: "วัดทดสอบ", ...fields } } } } });

test("location validation accepts numeric pairs, full Plus Codes and short codes with locality, never guesses", () => {
  for (const fields of [{ latitude: 13.7, longitude: 100.5 }, { latitude: "0", longitude: "0" }, { plusCode: "7P52PFVG+J8" }, { plusCode: "QF2P+W6 Bangkok" }]) {
    assert.deepEqual(directoryLocationErrors(fields), {});
    const links = directoryMapLinks(fields);
    assert.equal(new URL(links.search).hostname, "www.google.com");
    assert.equal(new URL(links.directions).searchParams.get("api"), "1");
  }
  assert.equal(parsePlusCode("QF2P+W6"), null);
  assert.equal(parsePlusCode("7P520000+"), null);
  for (const fields of [{}, { latitude: 13.7 }, { longitude: 100 }, { latitude: true, longitude: 100 }, { latitude: " ", longitude: 100 }, { latitude: "NaN", longitude: 100 }, { latitude: 91, longitude: 100 }, { latitude: 13, longitude: -181 }, { plusCode: "javascript:alert(1)" }]) {
    assert.ok(Object.keys(directoryLocationErrors(fields)).length, JSON.stringify(fields));
    assert.equal(directoryMapLinks(fields), null);
  }
  assert.equal(new URL(directoryMapLinks({ plusCode: "QF2P+W6 Bangkok" }).directions).searchParams.get("destination"), "QF2P+W6 Bangkok");
});

test("national baseline covers all provinces and protects every curated collection place", () => {
  const base = thailandBasePlaces({});
  assert.ok(base.length >= 7000);
  assert.equal(new Set(base.map(item => item.key)).size, base.length);
  assert.equal(new Set(base.map(item => item.temple.province)).size, 77);
  assert.ok(base.every(item => item.temple.metadata.sources.length && directoryMapLinks(item.temple)));
  const curated = templeRouteCatalog({});
  assert.equal(curated.length, 625);
  assert.equal(thailandCuratedBasePlaces({}).length, 378);
  for (const place of curated) assert.ok(base.some(item => item.key === `thailand:${place.plannerId}`), place.cmsKey);
  for (const place of curated) {
    const stored = base.find(item => item.key === `thailand:${place.plannerId}`).temple.metadata;
    assert.ok(stored.sources.some(source => source.provider === "curated" && source.fields.collection === place.collection), place.cmsKey);
  }
  const first = curated[0];
  const records = Object.fromEntries(curated.filter(item => item.plannerId === first.plannerId).map(item => [item.cmsKey, { collection: item.collection, enabled: false }]));
  assert.ok(!thailandBasePlaces({ temples: { records } }).some(item => item.key === `thailand:${first.plannerId}`));
});

test("manual CMS records publish without slugs and directory projection follows edits, clears, hides and order", () => {
  const draft = contentWith({ plusCode: "7P52PFVG+J8", province: "กรุงเทพมหานคร" });
  const published = prepareTempleSlugPublication(draft, {});
  assert.equal(published.temples.records[key].slug, undefined);
  const catalog = templeCatalogFromContent(published).find(item => item.key === key);
  assert.ok(catalog.detailUrl.includes(encodeURIComponent(key)));
  assert.ok(thailandPublicPlaces(published).some(item => item.key === key));
  const base = thailandBasePlaces({}).slice(0, 1);
  published.temples.records[base[0].key] = { key: base[0].key, collection: "thailand", source: "osm", fields: { ...base[0].temple, latitude: 13.75, summary: "", imageUrl: "" }, images: { card: { desktop: "", mobile: "" } } };
  published.temples.order = { thailand: [key, base[0].key] };
  const rows = directoryPublicPlaces(published, base);
  assert.equal(rows[0].key, key);
  assert.equal(rows[1].source, "admin");
  assert.equal(rows[1].summary, "");
  assert.equal(rows[1].image, "");
  assert.equal(rows[1].imageMobile, "");
  assert.equal(templeCatalogFromContent(published).filter(item => item.collection === "thailand")[0].key, key);
  assert.equal(directoryPublicPlaces(published, []).length, 1, "hidden curated source must not return as an orphan");
  published.temples.records[key].status = "deleted";
  assert.ok(!thailandPublicPlaces(published).some(item => item.key === key));
});

test("server publication rejects incomplete locations and forged identities, excludes invalid legacy data", () => {
  for (const fields of [{}, { latitude: 91, longitude: 100 }, { plusCode: "QF2P+W6" }, { name: "", plusCode: "7P52PFVG+J8" }]) {
    const draft = contentWith(fields);
    assert.throws(() => prepareTempleSlugPublication(draft, {}), { statusCode: 400 });
    assert.ok(!thailandPublicPlaces(draft).some(item => item.key === key));
  }
  const draft = contentWith({ latitude: 13, longitude: 100 });
  draft.temples.records[key].collection = "popular";
  assert.throws(() => validateDirectoryRecords(draft), { statusCode: 400 });
});

test("public directory and home counts use the published CMS without shipping the raw registry", () => {
  const draft = contentWith({ latitude: 13, longitude: 100 });
  const payload = publicContentForPath(draft, "/temples/thailand/");
  assert.equal(payload.directoryPage.places.length, 24);
  assert.equal(payload.directoryPage.total, baselineCount + 1);
  assert.equal(payload.directoryPage.facets.length, 77);
  assert.ok(Buffer.byteLength(JSON.stringify(payload.directoryPage)) < 100_000);
  assert.equal(payload.temples, undefined);
  assert.equal(publicContentForPath(draft, "/").directorySummary.templeCount, baselineCount + 1);
  const before = publicContentPayload(draft, "/temples/thailand/").revision;
  draft.temples.records[key].fields.longitude = 100.1;
  assert.notEqual(publicContentPayload(draft, "/temples/thailand/").revision, before);
});

test("server paging, selection and province filters keep results bounded and revisions coherent", () => {
  const first = thailandDirectoryPage({});
  const second = thailandDirectoryPage({}, new URLSearchParams({ offset: "24" }));
  assert.equal(first.revision, second.revision);
  assert.equal(new Set([...first.places, ...second.places].map(p => p.key)).size, 48);
  for (const { province } of first.facets) {
    const result = thailandDirectoryPage({}, new URLSearchParams({ province }));
    assert.ok(result.total > 0, province);
    assert.ok(result.places.every(place => place.province === province));
  }
  assert.equal(thailandDirectoryPage({}, new URLSearchParams({ place: first.places[0].key })).total, 1);
});

test("private history research cannot change public directory pagination revisions", () => {
  const draft = contentWith({ latitude: 13, longitude: 100 });
  draft.temples.records[key].historyResearch = { key: "private-history", sources: [{ title: "Internal evidence" }] };
  const before = structuredClone(draft);
  const projected = publicContentForPath(draft, "/temples/thailand/").directoryPage;
  assert.deepEqual(thailandDirectoryPage(draft), projected);
  assert.deepEqual(thailandDirectoryPage(publicContentPayload(draft).content), projected);
  draft.temples.records[key].historyResearch.sources[0].title = "Revised evidence";
  const next = thailandDirectoryPage(draft, new URLSearchParams({ offset: "24", revision: projected.revision }));
  assert.equal(next.revision, projected.revision);
  assert.equal(next.offset, 24);
  assert.equal(JSON.stringify(next).includes("Revised evidence"), false);
  assert.equal(before.temples.records[key].historyResearch.sources[0].title, "Internal evidence");
  assert.equal(draft.temples.records[key].historyResearch.sources[0].title, "Revised evidence");
  draft.temples.records[key].fields.longitude = 100.1;
  assert.notEqual(thailandDirectoryPage(draft).revision, projected.revision);
});

test("metadata preserves unknown source fields, multiple facets, provenance and missing values", () => {
  const source = { provider: "watportal", id: "34383", url: "https://www.watportal.com/th/wat/region/detail/iid/34383",
    fields: { "นิกาย": "มหานิกาย", "ประเภทวัด": "วัดราษฎร์, วิปัสนากรรมฐาน", "futureField": "retain me", "ชนิด": "" } };
  const metadata = placeMetadata([source]);
  assert.deepEqual(metadata.assertions.filter(item => item.facet === "templeType").map(item => item.value), ["วัดราษฎร์", "วิปัสนากรรมฐาน"]);
  assert.ok(metadata.assertions.some(item => item.facet === "legalStatus" && item.value === "วัดราษฎร์"));
  assert.ok(metadata.assertions.some(item => item.facet === "practice" && item.value === "วิปัสนากรรมฐาน"));
  assert.equal(metadata.sources[0].fields.futureField, "retain me");
  assert.ok(metadata.assertions.every(item => item.sourceUrl === source.url && item.evidence === "structured"));
  const unknown = placeMetadata([{ provider: "osm", url: "https://www.openstreetmap.org/node/1", fields: { denomination: "วัดดงครั่งน้อย" } }]);
  assert.equal(unknown.assertions.length, 0);
  assert.equal(unknown.reviewFlags.length, 1);
  assert.equal(mergePlaceMetadata(metadata, metadata).sources.length, 1);
  const earlier = placeMetadata([{ provider: "temple-official", url: "https://example.com/temple", fields: { name: "Temple" }, assertions: [{ facet: "practice", value: "forest" }] }]);
  const later = placeMetadata([{ ...earlier.sources[0], assertions: [...earlier.sources[0].assertions, { facet: "teachingLanguage", value: "English" }] }]);
  assert.ok(mergePlaceMetadata(later, earlier).assertions.some(item => item.facet === "teachingLanguage"), "stale editor metadata cannot erase newer source facts");
  const base = thailandBasePlaces({}).slice(0, 1);
  const draft = { temples: { records: { [base[0].key]: { collection: "thailand", fields: { summary: "edited" } } } } };
  const record = templeCatalogFromContent(draft).find(item => item.key === base[0].key);
  assert.deepEqual(record.temple.metadata, base[0].temple.metadata);
});

test("admin catalog transport fits a serverless response without losing rich curated metadata", () => {
  const temples = templeCatalogFromContent({}, { includeDirectory: false });
  const curated = thailandCuratedBasePlaces({});
  for (let offset = 0; offset < temples.length; offset += 125) {
    const page = { temples: temples.slice(offset, offset + 125), ...(offset === 0 ? { directory: { curated } } : {}) };
    assert.ok(Buffer.byteLength(JSON.stringify(page)) < 4_000_000, `Admin page ${offset} exceeds payload budget`);
  }
  assert.equal(temples.length, 625);
});
