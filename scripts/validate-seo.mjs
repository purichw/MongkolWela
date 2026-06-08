import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTempleDetailUrl } from "../src/data/temple-slugs.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const siteUrl = "https://mongkolwela.vercel.app";
const popularTemples = JSON.parse(fs.readFileSync(path.join(rootDir, "src/data/popular-temples.json"), "utf8"));
const watArunRoute = getTempleDetailUrl("popular", popularTemples.find((temple) => temple.name === "วัดอรุณ"));

const indexedRoutes = [
  "/",
  "/calendar/",
  "/horoscope/thai-astrology/",
  "/tarot/daily/",
  "/temples/",
  "/temples/popular/",
  "/temples/mu/",
  "/temples/sacred/",
  "/temples/thailand/",
  watArunRoute,
].filter(Boolean);

const noindexRoutes = [
  "/404.html",
  "/tarot/daily/result/",
  "/tarot/monthly/result/",
  "/tarot/luck/result/",
];

const errors = [];

main();

function main() {
  requireFile("sitemap.xml");
  requireFile("robots.txt");
  requireFile("llms.txt");
  requireFile("site.webmanifest");

  const sitemap = readDist("sitemap.xml");
  const robots = readDist("robots.txt");

  indexedRoutes.forEach((route) => {
    validateHtml(route, { shouldIndex: true });
    assert(sitemap.includes(`<loc>${absoluteRouteUrl(route)}</loc>`), `sitemap.xml ไม่มี ${route}`);
  });

  noindexRoutes.forEach((route) => {
    validateHtml(route, { shouldIndex: false });
    assert(!sitemap.includes(`<loc>${siteUrl}${route}</loc>`), `sitemap.xml ไม่ควรมี noindex route ${route}`);
  });

  ["/tarot/daily/result/", "/tarot/monthly/result/", "/tarot/luck/result/"].forEach((route) => {
    assert(robots.includes(`Disallow: ${route}`), `robots.txt ไม่ได้ Disallow ${route}`);
  });

  assert((sitemap.match(/<url>/g) || []).length >= 300, "sitemap.xml ควรมี URL รายละเอียดวัดจำนวนมาก");
  assert(robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`), "robots.txt ต้องชี้ sitemap canonical");

  if (errors.length) {
    console.error(`\nSEO validation errors (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("SEO validation passed.");
}

function validateHtml(route, { shouldIndex }) {
  const html = readRoute(route);
  const routeLabel = route;
  const canonical = absoluteRouteUrl(route);
  const robots = getMeta(html, "robots");
  const description = getMeta(html, "description");

  assert(getTitle(html), `${routeLabel}: ไม่มี <title>`);
  assert(description, `${routeLabel}: ไม่มี meta description`);
  assert(!/ต้นแบบ/.test(description), `${routeLabel}: meta description ยังมีคำว่า “ต้นแบบ”`);
  assert(html.includes(`<link rel="canonical" href="${canonical}"`), `${routeLabel}: canonical ไม่ตรง (${canonical})`);
  assert(getProperty(html, "og:title"), `${routeLabel}: ไม่มี og:title`);
  assert(getProperty(html, "og:description"), `${routeLabel}: ไม่มี og:description`);
  assert(getProperty(html, "og:image")?.startsWith("https://"), `${routeLabel}: og:image ต้องเป็น absolute URL`);
  assert(getMeta(html, "twitter:card") === "summary_large_image", `${routeLabel}: twitter card ต้องเป็น summary_large_image`);
  assert(getJsonLdBlocks(html).length > 0, `${routeLabel}: ไม่มี JSON-LD`);
  getJsonLdBlocks(html).forEach((block, index) => {
    try {
      JSON.parse(unescapeHtml(block));
    } catch (error) {
      errors.push(`${routeLabel}: JSON-LD block ${index + 1} parse ไม่ได้ (${error.message})`);
    }
  });

  if (shouldIndex) {
    assert(!/noindex/i.test(robots), `${routeLabel}: indexed route ห้ามมี noindex`);
  } else {
    assert(/noindex/i.test(robots), `${routeLabel}: noindex route ต้องมี noindex`);
  }
}

function readRoute(route) {
  const filePath = route === "/404.html"
    ? path.join(distDir, "404.html")
    : route === "/"
      ? path.join(distDir, "index.html")
      : path.join(distDir, route, "index.html");
  if (!fs.existsSync(filePath)) {
    errors.push(`${route}: ไม่พบไฟล์ build ที่ ${path.relative(rootDir, filePath)}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function requireFile(relativePath) {
  const filePath = path.join(distDir, relativePath);
  assert(fs.existsSync(filePath), `ไม่พบ ${relativePath} ใน dist`);
}

function readDist(relativePath) {
  const filePath = path.join(distDir, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function getTitle(html) {
  return html.match(/<title>(.*?)<\/title>/is)?.[1]?.trim() || "";
}

function getMeta(html, name) {
  return getTagContent(html, "name", name);
}

function getProperty(html, property) {
  return getTagContent(html, "property", property);
}

function getTagContent(html, attribute, value) {
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}="${escapeRegExp(value)}"[^>]*content="([^"]*)"[^>]*>`, "i");
  return html.match(pattern)?.[1]?.trim() || "";
}

function getJsonLdBlocks(html) {
  return [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim());
}

function unescapeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function absoluteRouteUrl(route) {
  return new URL(route, siteUrl).href;
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}
