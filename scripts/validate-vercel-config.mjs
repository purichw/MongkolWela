import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(rootDir, "vercel.json");
const errors = [];

const config = readJson(configPath);
validateRewrites(config.rewrites || []);
validateHeaders(config.headers || []);

if (errors.length) {
  console.error(`\nVercel config validation errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Vercel config validation passed.");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`อ่าน vercel.json ไม่สำเร็จ (${error.message})`);
    return {};
  }
}

function validateRewrites(rewrites) {
  assert(Array.isArray(rewrites), "rewrites ต้องเป็น array");
  assert(
    rewrites.some((rewrite) => rewrite.source === "/p/:path*" && rewrite.destination === "/admin/page-shell/"),
    "ต้องมี rewrite สำหรับ /p/:path* ไป /admin/page-shell/",
  );
  assert(
    rewrites.some((rewrite) => rewrite.source === "/p/:path*/" && rewrite.destination === "/admin/page-shell/"),
    "ต้องมี rewrite สำหรับ /p/:path*/ ไป /admin/page-shell/",
  );
}

function validateHeaders(headers) {
  assert(Array.isArray(headers), "headers ต้องเป็น array");

  const globalHeaders = getHeaderMap(headers, "/(.*)");
  requireHeader(globalHeaders, "Content-Security-Policy");
  requireHeader(globalHeaders, "Referrer-Policy", "strict-origin-when-cross-origin");
  requireHeader(globalHeaders, "X-Content-Type-Options", "nosniff");
  requireHeader(globalHeaders, "X-Frame-Options", "DENY");
  requireHeader(globalHeaders, "Strict-Transport-Security");
  requireHeader(globalHeaders, "Permissions-Policy");

  const csp = globalHeaders.get("Content-Security-Policy") || "";
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
    assert(csp.includes(directive), `Content-Security-Policy ขาด directive: ${directive}`);
  });

  requireCache(headers, "/assets/data/(.*)", "public, max-age=3600, stale-while-revalidate=86400");
  requireCache(headers, "/assets/(.*)", "public, max-age=31536000, immutable");
  requireCache(headers, "/_astro/(.*)", "public, max-age=31536000, immutable");
  requireCache(headers, "/api/temple-planner/(.*)", "no-store");
  requireCache(headers, "/styles.css", "public, max-age=31536000, immutable");
  requireCache(headers, "/site.webmanifest", "public, max-age=86400, stale-while-revalidate=604800");
  requireCache(headers, "/sitemap.xml", "public, max-age=3600, stale-while-revalidate=86400");
  requireCache(headers, "/robots.txt", "public, max-age=3600, stale-while-revalidate=86400");
  requireCache(headers, "/llms.txt", "public, max-age=3600, stale-while-revalidate=86400");
  requireHeader(getHeaderMap(headers, "/assets/data/(.*)"), "X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  requireHeader(getHeaderMap(headers, "/api/admin/(.*)"), "X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  requireHeader(getHeaderMap(headers, "/api/temple-planner/(.*)"), "X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  requireHeader(getHeaderMap(headers, "/llms.txt"), "X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  requireHeader(getHeaderMap(headers, "/assets/data/(.*)"), "Access-Control-Allow-Origin", "https://mongkolwela.vercel.app");
  requireHeader(getHeaderMap(headers, "/assets/data/(.*)"), "Vary", "Origin");

  const dataHeaderIndex = headers.findIndex((entry) => entry.source === "/assets/data/(.*)");
  const assetsHeaderIndex = headers.findIndex((entry) => entry.source === "/assets/(.*)");
  assert(dataHeaderIndex > -1 && assetsHeaderIndex > -1 && dataHeaderIndex > assetsHeaderIndex, "/assets/data header ควรมาหลัง /assets header เพื่อ override Cache-Control บน Vercel");
}

function requireHeader(headers, key, expectedValue) {
  const value = headers.get(key);
  assert(value, `ขาด security header ${key}`);
  if (expectedValue) assert(value === expectedValue, `${key} ต้องเป็น ${expectedValue}`);
}

function requireCache(headers, source, expectedValue) {
  const headerMap = getHeaderMap(headers, source);
  const cacheControl = headerMap.get("Cache-Control");
  assert(cacheControl === expectedValue, `${source}: Cache-Control ต้องเป็น ${expectedValue}`);
}

function getHeaderMap(headers, source) {
  const entry = headers.find((item) => item.source === source);
  const map = new Map();
  (entry?.headers || []).forEach((header) => map.set(header.key, header.value));
  return map;
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}
