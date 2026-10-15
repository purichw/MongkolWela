import { nfrKeyRoutePaths } from "../src/data/nfr-key-routes.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { thailandDirectoryPage } from "../src/data/thailand-places.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSiteUrl = "https://mongkolwela.vercel.app";
const siteUrl = normalizeBaseUrl(process.env.MONGKOLWELA_PRODUCTION_URL || defaultSiteUrl);
const failures = [];
const liveContent = JSON.parse(fs.readFileSync(path.join(rootDir, "public/admin/content/live.json"), "utf8"));
const CMS_EDITABLE_CONTRACT_VERSION = 2;

const statusRoutes = unique([
  "/",
  "/api/admin/content",
  "/api/temple-planner/data",
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
    expected: "no-store",
  },
  {
    path: "/assets/data/temples-thailand.json",
    expected: "public, max-age=3600, stale-while-revalidate=86400",
  },
  {
    path: "/assets/data/temples-thailand-index.json",
    expected: "public, max-age=3600, stale-while-revalidate=86400",
  },
  {
    path: "/api/temple-planner/data",
    expected: "no-store",
  },
];

const headerChecks = [
  {
    path: "/assets/data/temples-thailand.json",
    header: "x-robots-tag",
    expected: "noindex, nofollow, noarchive, nosnippet",
  },
  {
    path: "/assets/data/temples-thailand.json",
    header: "access-control-allow-origin",
    expected: "https://mongkolwela.vercel.app",
  },
  {
    path: "/assets/data/temples-thailand-index.json",
    header: "x-robots-tag",
    expected: "noindex, nofollow, noarchive, nosnippet",
  },
  {
    path: "/assets/data/temples-thailand-index.json",
    header: "access-control-allow-origin",
    expected: "https://mongkolwela.vercel.app",
  },
  {
    path: "/llms.txt",
    header: "x-robots-tag",
    expected: "noindex, nofollow, noarchive, nosnippet",
  },
  {
    path: "/api/temple-planner/data",
    header: "x-robots-tag",
    expected: "noindex, nofollow, noarchive, nosnippet",
  },
];

await main();

async function main() {
  console.log(`Production smoke target: ${siteUrl}`);

  await Promise.all(statusRoutes.map(checkStatus));
  await checkSecurityHeaders("/");
  await Promise.all(cacheChecks.map(checkCacheHeader));
  await Promise.all(headerChecks.map(checkResponseHeader));
  await checkCmsContent();
  await checkNationalDirectory();
  await checkPlannerApi();

  if (failures.length) {
    console.error(`\nProduction smoke failed (${failures.length}):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`Production smoke passed across ${statusRoutes.length} routes.`);
  process.exit(0);
}

async function checkNationalDirectory() {
  const receipt = JSON.parse(fs.readFileSync(path.join(rootDir, "docs/thailand-registry-cleanup.json"), "utf8"));
  const registryResponse = await fetchRoute("/assets/data/temples-thailand.json");
  if (registryResponse?.ok) {
    const body = await registryResponse.text();
    if (createHash("sha256").update(body).digest("hex") !== receipt.retainedSha256) {
      failures.push("National registry: deployed bytes do not match the approved cleanup");
    }
  } else failures.push("National registry: missing deployed data");
  const indexResponse = await fetchRoute("/assets/data/temples-thailand-index.json");
  if (indexResponse?.ok) {
    const index = await indexResponse.json();
    const areas = JSON.parse(fs.readFileSync(path.join(rootDir, "src/data/thailand-admin-areas.json"), "utf8"));
    if (index.meta?.rowCount !== receipt.retained || JSON.stringify(index.facets?.regions) !== JSON.stringify(areas.regions)) {
      failures.push("National registry: CMS geographic choices/count differ from the approved snapshot");
    }
  } else failures.push("National registry: missing CMS geographic index");
  const contentResponse = await fetchRoute("/api/admin/content");
  const pageResponse = await fetchRoute("/api/admin/content?view=directory");
  if (!contentResponse?.ok || !pageResponse?.ok) {
    failures.push("National directory: content/page API unavailable");
    return;
  }
  const { content } = await contentResponse.json();
  const { page } = await pageResponse.json();
  const expected = thailandDirectoryPage(content);
  if (JSON.stringify(page) !== JSON.stringify(expected)) failures.push("National directory: deployed page differs from published CMS and source snapshot");
  if (page?.summary?.provinceCount !== 77 || page.places?.length !== 24) failures.push("National directory: province coverage or pagination incomplete");
  console.log(`National directory: ${page?.summary?.templeCount} navigable places; registry ${receipt.retained} rows.`);
}

async function checkResponseHeader({ path, header, expected }) {
  const response = await fetchRoute(path);
  if (!response) return;

  const actual = normalizeHeader(response.headers.get(header));
  if (actual !== normalizeHeader(expected)) {
    failures.push(`${path}: ${header} expected "${expected}", got "${actual || "(missing)"}"`);
  }
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

  if (Number(content.cmsContractVersion || 0) >= CMS_EDITABLE_CONTRACT_VERSION) {
    validateEditableCmsContent(content);
    return;
  }

  comparePages(liveContent.pages || [], content.pages || []);
  compareNavigation(liveContent.navigation?.tabs || [], content.navigation?.tabs || []);
  compareUtilityNavigation(liveContent.navigation?.utility || [], content.navigation?.utility || []);
}

function validateEditableCmsContent(content) {
  if (!Array.isArray(content.pages)) failures.push("/api/admin/content: pages must be an array");
  if (!Array.isArray(content.navigation?.tabs)) {
    failures.push("/api/admin/content: navigation.tabs must be an array");
  }
  if (!Array.isArray(content.navigation?.utility)) {
    failures.push("/api/admin/content: navigation.utility must be an array");
  }
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

async function checkPlannerApi() {
  const path = "/api/temple-planner/plan";
  let response;
  try {
    response = await fetch(new URL(path, siteUrl), {
      method: "POST",
      redirect: "manual",
      headers: {
        accept: "application/json,text/plain,*/*",
        "accept-language": "th-TH,th;q=0.9,en-US;q=0.6,en;q=0.5",
        "content-type": "application/json",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "mongkolwela-production-smoke/1.0",
      },
      body: JSON.stringify({
        mode: "auto",
        criteria: {
          count: 3,
          budget: "300",
          startTime: "09:00",
          provinces: ["กรุงเทพมหานคร"],
          purposes: ["การงาน"],
        },
      }),
    });
  } catch (error) {
    failures.push(`${path}: request failed (${error.message})`);
    return;
  }

  if (!response.ok) {
    failures.push(`${path}: expected 2xx status, got ${response.status}`);
    return;
  }

  const cacheControl = normalizeHeader(response.headers.get("cache-control"));
  if (cacheControl !== "no-store") {
    failures.push(`${path}: Cache-Control expected "no-store", got "${cacheControl || "(missing)"}"`);
  }

  const robots = normalizeHeader(response.headers.get("x-robots-tag"));
  if (robots !== "noindex, nofollow, noarchive, nosnippet") {
    failures.push(`${path}: x-robots-tag expected "noindex, nofollow, noarchive, nosnippet", got "${robots || "(missing)"}"`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    failures.push(`${path}: JSON parse failed (${error.message})`);
    return;
  }

  if (payload.ok !== true || !Array.isArray(payload.planIds) || payload.planIds.length < 1 || !payload.details?.stops?.length) {
    failures.push(`${path}: missing planner result payload`);
  }
}

async function fetchRoute(route) {
  try {
    const response = await fetch(new URL(route, siteUrl), {
      redirect: "manual",
      headers: {
        accept: route.endsWith(".json") || route.startsWith("/api/") ? "application/json,text/plain,*/*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "th-TH,th;q=0.9,en-US;q=0.6,en;q=0.5",
        "sec-fetch-dest": route.startsWith("/api/") || route.endsWith(".json") ? "empty" : "document",
        "sec-fetch-mode": route.startsWith("/api/") || route.endsWith(".json") ? "cors" : "navigate",
        "sec-fetch-site": "same-origin",
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

function compareUtilityNavigation(expectedItems, actualItems) {
  const expectedOrder = expectedItems.map((item) => item.id).join(",");
  const actualOrder = actualItems.map((item) => item.id).join(",");
  if (expectedOrder !== actualOrder) {
    failures.push(`/api/admin/content navigation utility: item order mismatch`);
  }

  const expectedById = byId(expectedItems);
  const actualById = byId(actualItems);
  expectedById.forEach((expectedItem, id) => {
    const actualItem = actualById.get(id);
    if (!actualItem) {
      failures.push(`/api/admin/content navigation utility: missing item ${id}`);
      return;
    }
    ["label", "href", "enabled"].forEach((field) => {
      if ((expectedItem[field] ?? null) !== (actualItem[field] ?? null)) {
        failures.push(`/api/admin/content navigation utility item ${id}: ${field} mismatch`);
      }
    });
  });
  actualById.forEach((_actualItem, id) => {
    if (!expectedById.has(id)) {
      failures.push(`/api/admin/content navigation utility: unexpected item ${id}`);
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
