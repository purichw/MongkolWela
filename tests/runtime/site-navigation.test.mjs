import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { navigationHref, navigationModel, navigationGroups, navigationState, navigationUtilities, drawerUtilities, renderDesktopNavigation, renderMobileNavigation, renderMobileHub } from "../../src/lib/site-navigation.js";

const seed = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url))).navigation;

test("navigation sanitizes href protocols without losing query/hash or external links", () => {
  for (const input of ["javascript:alert(1)", "data:text/html,bad", "//evil.example", "java\nscript:bad", "\\evil", ""]) assert.equal(navigationHref(input), null);
  for (const input of ["/shop/?category=all#results", "https://example.com/?a=1#b", "mailto:a@b.com", "tel:123"]) assert.equal(navigationHref(input), input);
  assert.equal(navigationHref("#consult"), "/#consult");
  assert.equal(navigationHref("calendar/day/?date=2026-09-20"), "/calendar/day/?date=2026-09-20");
});

test("model preserves published order, IDs, gates, and hides empty groups", () => {
  const model = navigationModel(seed);
  assert.deepEqual(model.tabs.map(item => item.id), seed.tabs.filter(item => item.enabled !== false).map(item => item.id));
  const fixture = navigationModel({ tabs: [{ id: "hidden", label: "Hidden", href: "/shop/", enabled: false }, { id: "a", label: "A", href: "/", items: [{ id: "empty", label: "Empty", section: true }, { id: "hidden", label: "Hidden", href: "/", enabled: false }] }] });
  assert.equal(fixture.tabs.length, 1);
  assert.deepEqual(navigationGroups(fixture.tabs[0].items), []);
});

test("exact/current route matching respects segment boundaries and fragments", () => {
  const item = { href: "/temples/popular/", items: [] };
  assert.deepEqual(navigationState(item, "/"), { exact: false, active: false });
  assert.deepEqual(navigationState(item, "/temples/popular/?province=1"), { exact: true, active: true });
  assert.deepEqual(navigationState(item, "/temples/popular/place/"), { exact: false, active: true });
  assert.deepEqual(navigationState(item, "/temples/popularity/"), { exact: false, active: false });
  assert.equal(navigationState({ href: "/#supporting-tools", items: [] }, "/").exact, false);
});

test("both renderers retain every published destination and escape CMS text", () => {
  const model = navigationModel(seed);
  model.tabs.push({ id: "articles-fixture", label: '<img src=x onerror="alert(1)">', href: "/articles/?q=test#results", items: [] });
  const desktop = renderDesktopNavigation(model, { location: "/" });
  const mobile = renderMobileHub(model, { location: "/" }) + renderMobileNavigation(model, { location: "/" });
  const visit = items => items.forEach(item => {
    if (item.href && !item.section) for (const output of [desktop, mobile]) assert.ok(output.includes(`href="${item.href}"`), item.href);
    visit(item.items);
  });
  visit(model.tabs);
  for (const output of [desktop, mobile]) {
    assert.ok(output.includes("&lt;img"));
    assert.ok(!output.includes("<img src=x"));
    assert.ok(!output.includes('aria-current="page"'));
    assert.ok(!output.includes('role="menu"'));
  }
});

test("direct calendar remains direct; disabled commerce is not reconstructed", () => {
  const fixture = structuredClone(seed);
  fixture.tabs.find(item => item.id === "commerce").enabled = false;
  const html = renderDesktopNavigation(navigationModel(fixture));
  assert.ok(!html.includes('data-nav-item-id="commerce"'));
  assert.ok(!html.includes('id="mw-panel-calendar"'));
});

test("utilities retain configured contact and add only distinct published routes", () => {
  const items = navigationUtilities(navigationModel({ utility: [{ id: "contact", label: "Contact", href: "#consult" }, { id: "new", label: "New", href: "/new/" }] }), [{ label: "ติดต่อ", href: "#consult" }]);
  assert.deepEqual(items.map(item => item.href), ["/#consult", "/new/"]);
});

test("compact drawer removes only duplicate destinations, preserving all unique utility paths", () => {
  const model = navigationModel(seed);
  const utility = navigationUtilities(model, [{ label: "Hub", href: "temples/" }, { label: "Calendar", href: "calendar/" }, { label: "Day", href: "calendar/day/" }, { label: "Contact", href: "#consult" }]);
  assert.deepEqual(drawerUtilities(model, utility).map(item => item.href), ["/calendar/day/", "/#consult"]);
});
