import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { iconAttributes, iconMedallionClass, renderIcon, renderIconMedallion } from "../../src/lib/ui-markup.js";
import { icon as placeIcon } from "../../src/lib/place-detail-view.js";

test("Astro and runtime icon renderers share decorative semantics and asset paths", () => {
  const attributes = iconAttributes("calendar-days", "site-icon-mask");
  assert.equal(attributes.class, "ui-icon-mask site-icon-mask");
  assert.equal(attributes["aria-hidden"], "true");
  assert.equal(attributes.style, "mask-image:url('/assets/icons/lucide/calendar-days.svg')");
  assert.ok(fs.existsSync("public/assets/icons/lucide/calendar-days.svg"));
  const markup = renderIcon("calendar-days", "site-icon-mask");
  assert.match(markup, /class="ui-icon-mask site-icon-mask"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /calendar-days\.svg/);
  assert.doesNotMatch(markup, /width=|height=|tabindex=/);
});

test("place detail delegates its existing class contract to the shared renderer", () => {
  assert.equal(placeIcon("route"), renderIcon("route", "pd-icon"));
  assert.equal(placeIcon("route", "extra"), renderIcon("route", "pd-icon extra"));
});

test("icon names cannot inject a path, URL, attribute or CSS declaration", () => {
  for (const invalid of [null, undefined, "", "../route", "https://example.com/icon", "a');color:red", 'a\" onclick=\"bad', "arrow right"]) {
    assert.throws(() => renderIcon(invalid), TypeError);
  }
  assert.match(renderIcon("route", 'custom\" data-bad=\"yes'), /custom&quot; data-bad=&quot;yes/);
  assert.doesNotMatch(renderIcon("route", 'custom\" data-bad=\"yes'), / data-bad="/);
});

test("medallions preserve their route class and trusted child markup without extra wrappers", () => {
  assert.equal(iconMedallionClass(), "ui-medallion");
  assert.equal(iconMedallionClass("day-medallion is-good"), "ui-medallion day-medallion is-good");
  const child = renderIcon("leaf", "site-icon-mask");
  assert.equal(renderIconMedallion(child, "day-medallion is-good"), `<span class="ui-medallion day-medallion is-good">${child}</span>`);
});
