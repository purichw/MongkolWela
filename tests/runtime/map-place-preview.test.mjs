import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMapPlacePreview } from "../../src/lib/map-place-preview.js";
import { sitePlaceholderImage } from "../../src/lib/image-placeholder.js";

test("map preview uses the published image and escapes place fields", () => {
  const html = renderMapPlacePreview({ name: '<img onerror="alert(1)">', imageUrl: '/photo.webp?caption="test"', province: 'A & B', imageAlt: 'Temple "photo"' }, { number: 3 });
  assert.match(html, /&lt;img onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /src="\/photo.webp\?caption=&quot;test&quot;"/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /map-place-preview__number">3</);
});

test("missing photos reuse the site placeholder without inventing a place image", () => {
  const html = renderMapPlacePreview({ name: "สถานที่" }, { compact: true });
  assert.ok(html.includes(`src="${sitePlaceholderImage}"`));
  assert.match(html, /map-place-preview--compact/);
  assert.doesNotMatch(html, /map-place-preview__number/);
});

test("responsive CMS media and legacy placeholders keep their existing contract", () => {
  const html = renderMapPlacePreview({ name: "สถานที่", imageUrl: "/wide.webp", imageMobileUrl: "/mobile.webp" });
  assert.match(html, /<source media="\(max-width: 767px\)" srcset="\/mobile.webp">/);
  assert.ok(renderMapPlacePreview({ name: "สถานที่", imageUrl: "/assets/images/temple-placeholder-auspicious.png" }).includes(`src="${sitePlaceholderImage}"`));
});
