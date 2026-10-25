import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { navigationBreadcrumbs, renderNavigationBreadcrumbs, navigationBreadcrumbJsonLd } from "../../src/lib/navigation-breadcrumbs.js";
import { navigationModel, renderDesktopNavigation, renderMobileNavigation } from "../../src/lib/site-navigation.js";

const seed = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url)));

test("shop and merit use their full published ancestry, including a shared group URL", () => {
  for (const [route, label] of [["/shop/", "วัตถุมงคลและเครื่องราง"], ["/merit/", "กฐินและร่วมบุญ"]]) {
    const items = navigationBreadcrumbs(seed, route);
    assert.deepEqual(items.map(item => item.label), ["หน้าแรก", "ร้านค้าและร่วมบุญ", label]);
    assert.deepEqual(items.map(item => item.href), ["/", "/shop/", route]);
    const markup = renderNavigationBreadcrumbs(items);
    assert.equal((markup.match(/aria-current="page"/g) || []).length, 1);
    const schema = JSON.parse(navigationBreadcrumbJsonLd(items, route));
    assert.deepEqual(schema.itemListElement.map(item => item.name), items.map(item => item.label));
  }
});

test("old default shop names are normalized in both menus and breadcrumbs without mutating CMS", () => {
  const content = structuredClone(seed);
  const group = content.navigation.tabs.find(item => item.id === "commerce");
  Object.assign(group.items[0], { label: "ร้านค้ากลาง", mobileLabel: "ร้านค้ากลาง", desktopLabel: "ร้านค้ากลาง" });
  const before = structuredClone(content);
  const model = navigationModel(content.navigation);
  for (const render of [renderDesktopNavigation, renderMobileNavigation]) {
    assert.doesNotMatch(render(model), /ร้านค้ากลาง/);
    assert.match(render(model), /วัตถุมงคลและเครื่องราง/);
  }
  assert.equal(navigationBreadcrumbs(content, "/shop/").at(-1).label, "วัตถุมงคลและเครื่องราง");
  assert.deepEqual(content, before);
});

test("ancestry follows CMS labels, moved destinations, grouping and query/trailing slash variants", () => {
  const content = structuredClone(seed);
  const group = content.navigation.tabs.find(item => item.id === "commerce");
  group.label = "งานบุญของเรา";
  group.href = "/events/";
  group.items[0] = { ...group.items[0], label: "สินค้าจากชุมชน", href: "/gifts/?category=all" };
  assert.deepEqual(navigationBreadcrumbs(content, "/gifts").map(item => item.label), ["หน้าแรก", "งานบุญของเรา", "สินค้าจากชุมชน"]);
  group.items = [{ id: "group", section: true, label: "ของขวัญ", items: group.items }];
  assert.deepEqual(navigationBreadcrumbs(content, "/gifts/?q=one").map(item => item.label), ["หน้าแรก", "งานบุญของเรา", "ของขวัญ", "สินค้าจากชุมชน"]);
});

test("removed or disabled navigation does not restore seed ancestors", () => {
  for (const mode of ["disabled", "removed"]) {
    const content = structuredClone(seed);
    if (mode === "disabled") content.navigation.tabs.find(item => item.id === "commerce").enabled = false;
    else content.navigation.tabs = [];
    content.pages.find(page => page.id === "shop").label = "สินค้าที่แอดมินตั้งชื่อเอง";
    assert.deepEqual(navigationBreadcrumbs(content, "/shop/").map(item => item.label), ["หน้าแรก", "สินค้าที่แอดมินตั้งชื่อเอง"]);
  }
});

test("a path-projected CMS payload still derives the hierarchy without the home page record", () => {
  const content = { ...seed, pages: seed.pages.filter(page => page.id === "shop") };
  assert.deepEqual(navigationBreadcrumbs(content, "/shop/").map(item => item.label), ["หน้าแรก", "ร้านค้าและร่วมบุญ", "วัตถุมงคลและเครื่องราง"]);
});

test("CMS text is escaped in markup and JSON-LD and unsafe URLs cannot become links", () => {
  const items = [{ label: '<script>alert("x")</script>', href: "javascript:alert(1)" }, { label: "Current", href: "/shop/" }];
  const markup = renderNavigationBreadcrumbs(items);
  assert.doesNotMatch(markup, /<script>|javascript:/);
  assert.match(markup, /&lt;script&gt;/);
  assert.doesNotMatch(navigationBreadcrumbJsonLd(items, "/shop/"), /<script>/);
});
