import test from "node:test";
import assert from "node:assert/strict";
import { renderDirectoryPlaceCard } from "../../src/lib/directory-place-card.js";
import { sitePlaceholderImage } from "../../src/lib/image-placeholder.js";

const place = { key: "thailand:example", name: "วัดตัวอย่าง", province: "กรุงเทพมหานคร", district: "พระนคร", source: "osm", image: "/photo.webp", imageMobile: "/mobile.webp", imageSourceLabel: "Wikimedia", imageSourceUrl: "https://commons.wikimedia.org/example", address: "ที่อยู่สถานที่", links: { directions: "https://www.google.com/maps/dir/?api=1&destination=13.7,100.5", search: "https://www.google.com/maps/search/?api=1&query=13.7,100.5" } };
test("directory shares the card anatomy, not curated collection actions or invented data", () => {
  const html = renderDirectoryPlaceCard(place);
  for (const hook of ["data-place-card", "place-card__body", "place-card__locality", "place-card__actions", "data-directory-key"]) assert.ok(html.includes(hook));
  assert.ok(!html.includes("นำทาง"));
  assert.ok(html.includes("ดูแผนที่"));
  assert.ok(!html.includes("เพิ่มลงแผน"));
  assert.ok(!html.includes("/temples/planner/"));
  assert.ok(!html.includes("data-collection-intent"));
  assert.ok(!html.includes("directory-summary"));
  assert.ok(html.includes('srcset="/mobile.webp"'));
  assert.match(html, /<details[^>]+>[\s\S]*ที่อยู่สถานที่[\s\S]*<\/details>/);
  assert.ok(html.includes('href="https://commons.wikimedia.org/example"'));
  assert.ok(html.includes('query=13.7,100.5'));
  assert.ok(!html.includes('/maps/dir/'));
});
test("coordinate provenance is not rendered and missing addresses do not leave empty disclosures", () => {
  for (const source of ["osm", "curated", "admin"]) {
    const record = { ...place, source, address: "" };
    const before = structuredClone(record);
    const html = renderDirectoryPlaceCard(record);
    assert.ok(!html.includes("แหล่งพิกัด:"));
    assert.ok(!html.includes("directory-source"));
    assert.ok(!html.includes("<details"));
    assert.deepEqual(record, before);
  }
});
test("missing media has Thai fallback labels without discarding responsive image choices", () => {
  const html = renderDirectoryPlaceCard({ ...place, image: "", imageMobile: "/mobile.webp", imageSourceLabel: "Placeholder", imageSourceUrl: "" });
  assert.ok(html.includes(`src="${sitePlaceholderImage}"`));
  assert.ok(html.includes('data-placeholder-desktop="true" data-placeholder-mobile="false"'));
  assert.ok(html.includes("ยังไม่มีภาพสถานที่"));
  assert.ok(!html.includes(">Placeholder<"));
  assert.ok(html.includes('srcset="/mobile.webp"'));
});
test("untrusted text is escaped and unsafe media, attribution and map URLs cannot execute", () => {
  const html = renderDirectoryPlaceCard({ ...place, name: '<img src=x onerror="alert(1)">', address: '<script>unsafe</script>', image: "javascript:alert(1)", imageSourceUrl: "javascript:alert(1)", links: { search: "javascript:alert(1)", directions: "data:text/html,unsafe" } });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('href="data:'));
  assert.ok(html.includes(`src="${sitePlaceholderImage}"`));
});
