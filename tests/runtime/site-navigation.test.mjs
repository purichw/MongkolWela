import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editableNavigationGroups, validateNavigation, navigationHref, navigationModel, navigationGroups, navigationState, navigationUtilities, drawerUtilities, renderDesktopNavigation, renderMobileNavigation, renderMobileHub, renderUtilityNavigation } from "../../src/lib/site-navigation.js";

const seed = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url))).navigation;

test("editor grouping is reversible, preserves empty groups and keeps children with their parent", () => {
  const flat = [{ id: "feature", label: "Feature", href: "/" }, { id: "group", label: "Group", section: true }, { id: "one", label: "One", href: "/one/" }, { id: "two", label: "Two", href: "/two/" }];
  const grouped = editableNavigationGroups(flat);
  assert.deepEqual(grouped[1].items.map(item => item.id), ["one", "two"]);
  grouped.reverse();
  assert.deepEqual(editableNavigationGroups(grouped), grouped);
  assert.equal(editableNavigationGroups([{ id: "empty", label: "Empty", section: true, items: [] }, flat[0]]).length, 2);
  assert.deepEqual(flat.map(item => item.id), ["feature", "group", "one", "two"]);
});

test("device gates and labels apply to the same visitor renderers, including disabled parent groups", () => {
  const model = navigationModel({ tabs: [{ id: "main", label: "Main", href: "/main/", desktopLabel: "Desktop name", mobileLabel: "Mobile name", items: [
    { id: "hidden-group", label: "Hidden", section: true, enabled: false }, { id: "hidden-child", label: "Hidden child", href: "/hidden/" },
    { id: "group", label: "Group", section: true }, { id: "desktop-only", label: "Desktop only", href: "/desktop/", mobile: false },
  ] }] });
  assert.match(renderDesktopNavigation(model), /Desktop name/);
  assert.match(renderDesktopNavigation(model), /Desktop only/);
  assert.doesNotMatch(renderDesktopNavigation(model), /Hidden child/);
  assert.match(renderMobileNavigation(model), /Mobile name/);
  assert.doesNotMatch(renderMobileNavigation(model), /Desktop only|Hidden child/);
});

test("navigation validation accepts legacy seed and rejects unsafe or malformed additions", () => {
  assert.doesNotThrow(() => validateNavigation(seed));
  for (const item of [{ label: "Unsafe", href: "javascript:alert(1)" }, { label: "Unsafe", image: "//untrusted.test/image.png" }, { label: "Bad", mobile: "false" }]) {
    assert.throws(() => validateNavigation({ tabs: [item] }), error => error.statusCode === 400);
  }
});

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

test("utility visibility follows its device and hidden main links do not suppress mobile utilities", () => {
  const model = navigationModel({ tabs: [{ id: "main", label: "Main", href: "/main/", mobile: false }], utility: [
    { id: "one", label: "One", href: "/main/", desktop: false, mobileLabel: "Mobile utility" },
    { id: "two", label: "Two", href: "/two/", mobile: false },
  ] });
  const utility = navigationUtilities(model);
  assert.doesNotMatch(renderUtilityNavigation(utility), /Mobile utility|One/);
  const mobile = renderUtilityNavigation(drawerUtilities(model, utility), { device: "mobile" });
  assert.match(mobile, /Mobile utility/);
  assert.doesNotMatch(mobile, /Two/);
});

test("compact drawer removes only duplicate destinations, preserving all unique utility paths", () => {
  const model = navigationModel(seed);
  const utility = navigationUtilities(model, [{ label: "Hub", href: "temples/" }, { label: "Calendar", href: "calendar/" }, { label: "Day", href: "calendar/day/" }, { label: "Contact", href: "#consult" }]);
  assert.deepEqual(drawerUtilities(model, utility).map(item => item.href), ["/calendar/day/", "/#consult"]);
});
