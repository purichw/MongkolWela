import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPath = path.join(rootDir, "public/admin/content/default.json");
const livePath = path.join(rootDir, "public/admin/content/live.json");
const productionUrl = normalizeBaseUrl(process.env.MONGKOLWELA_PRODUCTION_URL || "https://mongkolwela.vercel.app");
const checkProduction = process.argv.includes("--production");
const errors = [];

const defaultContent = readJson(defaultPath, "default.json");
const liveContent = readJson(livePath, "live.json");

validateSource("default.json", defaultContent);
validateSource("live.json", liveContent);
compareSources("default.json", defaultContent, "live.json", liveContent);

if (checkProduction) {
  const apiContent = await readProductionContent();
  if (apiContent) {
    validateSource("/api/admin/content", apiContent);
    compareSources("live.json", liveContent, "/api/admin/content", apiContent);
  }
}

if (errors.length) {
  console.error(`\nCMS content validation errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  checkProduction
    ? "CMS content validation passed for default.json, live.json, and /api/admin/content."
    : "CMS content validation passed for default.json and live.json.",
);

function validateSource(label, content) {
  if (!content || typeof content !== "object") {
    errors.push(`${label}: content must be an object`);
    return;
  }

  if (!content.schemaVersion) errors.push(`${label}: missing schemaVersion`);
  if (!Array.isArray(content.pages)) errors.push(`${label}: pages must be an array`);
  if (!Array.isArray(content.navigation?.tabs)) errors.push(`${label}: navigation.tabs must be an array`);

  const pages = content.pages || [];
  const pageIds = new Set();
  const pageRoutes = new Set();

  pages.forEach((page, index) => {
    const ref = `${label}: pages[${index}]`;
    if (!page.id) errors.push(`${ref}: missing id`);
    if (page.id && pageIds.has(page.id)) errors.push(`${ref}: duplicate page id ${page.id}`);
    if (page.id) pageIds.add(page.id);
    if (!page.label) errors.push(`${ref}: missing label`);
    if (!page.route || !page.route.startsWith("/") || !page.route.endsWith("/")) {
      errors.push(`${ref}: route must start and end with /`);
    }
    if (page.route && pageRoutes.has(page.route)) errors.push(`${ref}: duplicate route ${page.route}`);
    if (page.route) pageRoutes.add(page.route);
  });

  const tabIds = new Set();
  (content.navigation?.tabs || []).forEach((tab, tabIndex) => {
    const tabRef = `${label}: navigation.tabs[${tabIndex}]`;
    if (!tab.id) errors.push(`${tabRef}: missing id`);
    if (tab.id && tabIds.has(tab.id)) errors.push(`${tabRef}: duplicate tab id ${tab.id}`);
    if (tab.id) tabIds.add(tab.id);
    if (!tab.label) errors.push(`${tabRef}: missing label`);
    if (!Array.isArray(tab.items)) errors.push(`${tabRef}: items must be an array`);

    const itemIds = new Set();
    (tab.items || []).forEach((item, itemIndex) => {
      const itemRef = `${tabRef}.items[${itemIndex}]`;
      if (!item.id) errors.push(`${itemRef}: missing id`);
      if (item.id && itemIds.has(item.id)) errors.push(`${itemRef}: duplicate item id ${item.id}`);
      if (item.id) itemIds.add(item.id);
      if (!item.label) errors.push(`${itemRef}: missing label`);

      if (item.section) return;
      if (!item.href) {
        errors.push(`${itemRef}: non-section item must have href`);
        return;
      }
      if (isPageHref(item.href) && !pageRoutes.has(normalizeHrefRoute(item.href))) {
        errors.push(`${itemRef}: href ${item.href} does not match any page route`);
      }
    });
  });
}

function compareSources(leftLabel, left, rightLabel, right) {
  comparePages(leftLabel, left.pages || [], rightLabel, right.pages || []);
  compareNavigation(leftLabel, left.navigation?.tabs || [], rightLabel, right.navigation?.tabs || []);
}

function comparePages(leftLabel, leftPages, rightLabel, rightPages) {
  const leftById = byId(leftPages);
  const rightById = byId(rightPages);
  compareIdSets(`${leftLabel} pages`, leftById, `${rightLabel} pages`, rightById);

  leftById.forEach((leftPage, id) => {
    const rightPage = rightById.get(id);
    if (!rightPage) return;
    compareField(`${rightLabel} page ${id}`, "kind", leftPage.kind, rightPage.kind);
    compareField(`${rightLabel} page ${id}`, "label", leftPage.label, rightPage.label);
    compareField(`${rightLabel} page ${id}`, "route", leftPage.route, rightPage.route);
    compareField(`${rightLabel} page ${id}`, "enabled", leftPage.enabled, rightPage.enabled);
  });
}

function compareNavigation(leftLabel, leftTabs, rightLabel, rightTabs) {
  const leftById = byId(leftTabs);
  const rightById = byId(rightTabs);
  compareIdSets(`${leftLabel} navigation tabs`, leftById, `${rightLabel} navigation tabs`, rightById);

  leftTabs.forEach((leftTab, tabIndex) => {
    const rightTab = rightById.get(leftTab.id);
    if (!rightTab) return;
    const ref = `${rightLabel} tab ${leftTab.id}`;
    compareField(ref, "label", leftTab.label, rightTab.label);
    compareField(ref, "href", leftTab.href, rightTab.href);
    compareField(ref, "enabled", leftTab.enabled, rightTab.enabled);
    compareSequence(`${ref} item order`, leftTab.items || [], rightTab.items || []);

    const rightItemsById = byId(rightTab.items || []);
    (leftTab.items || []).forEach((leftItem) => {
      const rightItem = rightItemsById.get(leftItem.id);
      if (!rightItem) return;
      const itemRef = `${rightLabel} nav item ${leftItem.id}`;
      compareField(itemRef, "label", leftItem.label, rightItem.label);
      compareField(itemRef, "href", leftItem.href, rightItem.href);
      compareField(itemRef, "section", Boolean(leftItem.section), Boolean(rightItem.section));
      compareField(itemRef, "enabled", leftItem.enabled, rightItem.enabled);
    });

    const expectedTabId = leftTabs[tabIndex]?.id;
    const actualTabId = rightTabs[tabIndex]?.id;
    if (expectedTabId !== actualTabId) {
      errors.push(`${rightLabel}: tab order mismatch at index ${tabIndex}, expected ${expectedTabId}, got ${actualTabId}`);
    }
  });
}

function compareIdSets(leftLabel, leftById, rightLabel, rightById) {
  [...leftById.keys()].forEach((id) => {
    if (!rightById.has(id)) errors.push(`${rightLabel}: missing ${id} from ${leftLabel}`);
  });
  [...rightById.keys()].forEach((id) => {
    if (!leftById.has(id)) errors.push(`${rightLabel}: unexpected ${id} not in ${leftLabel}`);
  });
}

function compareSequence(label, expectedItems, actualItems) {
  const expected = expectedItems.map((item) => item.id).join(",");
  const actual = actualItems.map((item) => item.id).join(",");
  if (expected !== actual) errors.push(`${label}: expected ${expected}, got ${actual}`);
}

function compareField(ref, field, expected, actual) {
  if ((expected ?? null) !== (actual ?? null)) {
    errors.push(`${ref}: ${field} expected ${JSON.stringify(expected ?? null)}, got ${JSON.stringify(actual ?? null)}`);
  }
}

async function readProductionContent() {
  const url = new URL("/api/admin/content", productionUrl);
  url.searchParams.set("ts", Date.now().toString());

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "mongkolwela-cms-validation/1.0" },
    });
    if (!response.ok) {
      errors.push(`/api/admin/content: expected 2xx status, got ${response.status}`);
      return null;
    }
    const payload = await response.json();
    if (!payload.content) {
      errors.push("/api/admin/content: missing content payload");
      return null;
    }
    return payload.content;
  } catch (error) {
    errors.push(`/api/admin/content: request failed (${error.message})`);
    return null;
  }
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${label}: cannot read or parse JSON (${error.message})`);
    return {};
  }
}

function byId(items) {
  return new Map(items.filter((item) => item?.id).map((item) => [item.id, item]));
}

function isPageHref(href) {
  return href && !href.startsWith("#") && !/^(https?:|mailto:|tel:)/.test(href);
}

function normalizeHrefRoute(href) {
  const route = href.startsWith("/") ? href : `/${href}`;
  return route.endsWith("/") ? route : `${route}/`;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.href;
}
