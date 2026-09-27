import test from "node:test";
import assert from "node:assert/strict";
import { collectionIntent, renderTempleCollectionCard } from "../../src/lib/temple-collection-card.js";

const item = { key: "popular:1", rank: 1, name: "วัดตัวอย่าง", province: "กรุงเทพมหานคร", district: "พระนคร", blessings: "สุขภาพ;การงาน", imageUrl: "/photo.webp", detailUrl: "/temples/popular/example/", plannerUrl: "/temples/planner/?start=example&province=bangkok" };
test("shared card keeps image, CMS, plan and detail contracts without speculative favorites", () => {
  const html = renderTempleCollectionCard(item, "/placeholder.webp");
  for (const hook of ["data-popular-temple-card", "data-collection-province", "data-collection-intent", "data-temple-desktop-image", "data-popular-temple-detail"]) assert.ok(html.includes(hook));
  assert.ok(html.includes('data-card-key="popular:1"'));
  assert.ok(html.includes('aria-label="ลำดับ 1"'));
  assert.ok(html.includes('href="/temples/popular/example/"'));
  assert.ok(!html.includes("heart"));
  assert.equal(collectionIntent(item), "สุขภาพ");
});
test("missing images use the real fallback and empty intent does not fabricate a blessing", () => {
  const html = renderTempleCollectionCard({ ...item, imageUrl: "", blessings: "" }, "/placeholder.webp");
  assert.ok(html.includes('src="/placeholder.webp"'));
  assert.ok(html.includes('data-image-placeholder="true"'));
  assert.ok(html.includes("data-collection-intent hidden"));
});
test("CMS text and URLs remain escaped in server and hydrated cards", () => {
  const html = renderTempleCollectionCard({ ...item, name: '<img src=x onerror="alert(1)">', province: '"<unsafe>', imageMobileUrl: '/mobile.webp?q="<unsafe>' }, "/placeholder.webp");
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("data-temple-mobile-source"));
});
