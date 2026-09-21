import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderPlannerPlaceCard } from "../../src/scripts/planner/place-card.js";

const item = { id: "one", name: "วัดทดสอบ", province: "กรุงเทพมหานคร", district: "พระนคร", blessings: ["ความสำเร็จ/ก้าวหน้า", "การงาน"], detailUrl: "/temples/example/" };

test("card keeps responsive media and clear placeholder identity", () => {
  const missing = renderPlannerPlaceCard(item);
  assert.match(missing, /class="is-placeholder"/);
  assert.match(missing, /alt="ยังไม่มีภาพสถานที่"/);
  assert.doesNotMatch(missing, /<source/);
  const real = renderPlannerPlaceCard({ ...item, imageUrl: "/photo.webp", imageMobileUrl: "/portrait.webp", imageAlt: "ภาพวัดจริง" });
  assert.match(real, /srcset="\/portrait.webp"/);
  assert.match(real, /alt="ภาพวัดจริง"/);
  assert.match(real, /title="ความสำเร็จ\/ก้าวหน้า"/);
  assert.match(real, />ก้าวหน้า<\/span>/);
});

test("selection indicator and add/remove action are separate accessible roles", async () => {
  const selected = renderPlannerPlaceCard(item, { selected: true });
  assert.match(selected, /aria-pressed="true"/);
  assert.match(selected, /planner-card-status" aria-hidden="true"/);
  assert.match(selected, /lucide\/minus.svg/);
  const disabled = renderPlannerPlaceCard(item, { disabled: true });
  assert.match(disabled, /aria-disabled="true"/);
  assert.match(disabled, /lucide\/plus.svg/);
  assert.doesNotMatch(disabled, /planner-card-status/);
  for (const icon of ["plus", "minus", "check"]) assert.match(await readFile(new URL(`../../public/assets/icons/lucide/${icon}.svg`, import.meta.url), "utf8"), /<svg/);
});

test("card escapes content and refuses external detail URLs", () => {
  const html = renderPlannerPlaceCard({ ...item, name: '<script>"bad"</script>', detailUrl: "//untrusted.example", imageAlt: '" onerror="bad', imageUrl: '/image"bad.webp' });
  assert.doesNotMatch(html, /<script>|<a href|src="\/image"bad/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /image&quot;bad.webp/);
});
