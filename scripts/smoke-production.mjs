import { nfrKeyRoutePaths } from "../src/data/nfr-key-routes.js";

const defaultSiteUrl = "https://mongkolwela.vercel.app";
const siteUrl = normalizeBaseUrl(process.env.MONGKOLWELA_PRODUCTION_URL || defaultSiteUrl);
const failures = [];

const statusRoutes = unique([
  "/",
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

  if (failures.length) {
    console.error(`\nProduction smoke failed (${failures.length}):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`Production smoke passed across ${statusRoutes.length} routes.`);
  process.exit(0);
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
    await response.body?.cancel();
    return response;
  } catch (error) {
    failures.push(`${route}: request failed (${error.message})`);
    return null;
  }
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
