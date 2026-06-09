import { nfrKeyRoutePaths } from "../src/data/nfr-key-routes.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSiteUrl = "https://mongkolwela.vercel.app";
const siteUrl = normalizeBaseUrl(process.env.MONGKOLWELA_PRODUCTION_URL || defaultSiteUrl);
const failures = [];
const liveContent = JSON.parse(fs.readFileSync(path.join(rootDir, "public/admin/content/live.json"), "utf8"));

const statusRoutes = unique([
  "/",
  "/api/admin/content",
  "/temples/",
  "/temples/popular/",
  "/temples/mu/",
  "/temples/sacred/",
  "/temples/thailand/",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
  "/404.html",
  ...nfrKeyRoutePaths,
]);

const securityHeaders = [
  "content-security-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-frame-options",
  "strict-transport-security",
  "permissions-policy",
];

const cacheChecks = [
  {
    path: "/sitemap.xml",
    expected: "public, max-age=3600, stale-while-revalidate=86400",
  },
  {
    path: "/assets/data/temples-thailand.json",
    expected: "public, max-age=3600, stale-while-revalidate=86400",
  },
];

await main();

async function main() {
  console.log(`Production smoke target: ${siteUrl}`);

  await Promise.all(statusRoutes.map(checkStatus));
  await checkSecurityHeaders("/");
  await Promise.all(cacheChecks.map(checkCacheHeader));
  await checkCmsContent();

  if (failures.length) {
    console.error(`\nProduction smoke failed (${failures.length}):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`Production smoke passed across ${statusRoutes.length} routes.`);
  process.exit(0);
}

async function checkCmsContent() {
  const response = await fetchRoute("/api/admin/content");
  if (!response?.ok) return;

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    failures.push(`/api/admin/content: JSON parse failed (${error.message})`);
    return;
  }

  const content = payload.content;
  if (!content) {
    failures.push("/api/admin/content: missing content payload");
    return;
  }

  comparePages(liveContent.pages || [], content.pages || []);
  compareNavigation(liveContent.navigation?.tabs || [], content.navigation?.tabs || []);
}

async function checkStatus(route) {
  const response = await fetchRoute(route);
  if (!response) return;
  if (!response.ok) {
    failures.push(`${route}: expected 2xx status, got ${response.status}`);
  }
}

async function checkSecurityHeaders(route) {
  const response = await fetchRoute(route);
  if (!response) return;

  securityHeaders.forEach((header) => {
    if (!response.headers.get(header)) {
      failures.push(`${route}: missing security header ${header}`);
    }
  });

  const csp = response.headers.get("content-security-policy") || "";
  [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].forEach((directive) => {
    if (!csp.includes(directive)) {
      failures.push(`${route}: Content-Security-Policy missing ${directive}`);
    }
  });
}

async function checkCacheHeader({ path, expected }) {
  const response = await fetchRoute(path);
  if (!response) return;

  const actual = normalizeHeader(response.headers.get("cache-control"));
  if (actual !== normalizeHeader(expected)) {
    failures.push(`${path}: Cache-Control expected "${expected}", got "${actual || "(missing)"}"`);
  }
}

async function fetchRoute(route) {
  try {
    const response = await fetch(new URL(route, siteUrl), {
      redirect: "manual",
      headers: {
        "user-agent": "mongkolwela-production-smoke/1.0",
      },
    });
    return response;
  } catch (error) {
    failures.push(`${route}: request failed (${error.message})`);
    return null;
  }
}

function comparePages(expectedPages, actualPages) {
  const expectedById = byId(expectedPages);
  const actualById = byId(actualPages);
  expectedById.forEach((expectedPage, id) => {
    const actualPage = actualById.get(id);
    if (!actualPage) {
      failures.push(`/api/admin/content: missing page ${id}`);
      return;
    }
    ["kind", "label", "route", "enabled"].forEach((field) => {
      if ((expectedPage[field] ?? null) !== (actualPage[field] ?? null)) {
        failures.push(`/api/admin/content page ${id}: ${field} mismatch`);
      }
    });
  });
}

function compareNavigation(expectedTabs, actualTabs) {
  const actualTabsById = byId(actualTabs);
  expectedTabs.forEach((expectedTab, tabIndex) => {
    const actualTab = actualTabsById.get(expectedTab.id);
    if (!actualTab) {
      failures.push(`/api/admin/content: missing nav tab ${expectedTab.id}`);
      return;
    }
    if (actualTabs[tabIndex]?.id !== expectedTab.id) {
      failures.push(`/api/admin/content: nav tab order mismatch for ${expectedTab.id}`);
    }
    ["label", "href", "enabled"].forEach((field) => {
      if ((expectedTab[field] ?? null) !== (actualTab[field] ?? null)) {
        failures.push(`/api/admin/content nav tab ${expectedTab.id}: ${field} mismatch`);
      }
    });
    compareNavigationItems(expectedTab.id, expectedTab.items || [], actualTab.items || []);
  });
}

function compareNavigationItems(tabId, expectedItems, actualItems) {
  const actualById = byId(actualItems);
  const expectedOrder = expectedItems.map((item) => item.id).join(",");
  const actualOrder = actualItems.map((item) => item.id).join(",");
  if (expectedOrder !== actualOrder) {
    failures.push(`/api/admin/content nav tab ${tabId}: item order mismatch`);
  }

  expectedItems.forEach((expectedItem) => {
    const actualItem = actualById.get(expectedItem.id);
    if (!actualItem) {
      failures.push(`/api/admin/content nav tab ${tabId}: missing item ${expectedItem.id}`);
      return;
    }
    ["label", "href", "enabled"].forEach((field) => {
      if ((expectedItem[field] ?? null) !== (actualItem[field] ?? null)) {
        failures.push(`/api/admin/content nav item ${expectedItem.id}: ${field} mismatch`);
      }
    });
    if (Boolean(expectedItem.section) !== Boolean(actualItem.section)) {
      failures.push(`/api/admin/content nav item ${expectedItem.id}: section mismatch`);
    }
  });
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.href;
}

function normalizeHeader(value) {
  return (value || "").replace(/\s*,\s*/g, ", ").trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function byId(items) {
  return new Map(items.filter((item) => item?.id).map((item) => [item.id, item]));
}
