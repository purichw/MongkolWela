import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nfrKeyRoutePaths } from "../src/data/nfr-key-routes.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const budgetPath = path.join(rootDir, "config/nfr-budgets.json");
const budget = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
const failures = [];

if (!fs.existsSync(distDir)) {
  console.error("dist/ ยังไม่มี กรุณารัน npm run build ก่อน");
  process.exit(1);
}

const files = walk(distDir);
checkAssetBudget("javascript", files.filter((file) => file.endsWith(".js")));
checkAssetBudget("css", files.filter((file) => file.endsWith(".css")));
checkHtmlBudget();
checkRouteStyles();
checkKeyRouteImages();

console.log(
  `Unmeasured field targets: LCP <= ${budget.coreWebVitals.lcpMs}ms, CLS <= ${budget.coreWebVitals.cls}, INP <= ${budget.coreWebVitals.inpMs}ms. This check measures file sizes only; use browser measurements and field telemetry for Web Vitals.`,
);
console.log(`Browser matrix: ${budget.browserMatrix.join(", ")}`);

if (failures.length) {
  console.error("\nPerformance budget failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Static asset budget passed (not a Core Web Vitals result).");

function checkAssetBudget(kind, matchedFiles) {
  const limits = budget.assets[kind];
  const totalKb = sumBytes(matchedFiles) / 1024;
  if (totalKb > limits.totalKb) {
    failures.push(`${kind} รวม ${formatKb(totalKb)} เกินงบ ${limits.totalKb}KB`);
  }

  matchedFiles.forEach((file) => {
    const sizeKb = fs.statSync(file).size / 1024;
    if (sizeKb > limits.maxFileKb) {
      failures.push(`${relative(file)} ${formatKb(sizeKb)} เกินงบต่อไฟล์ ${limits.maxFileKb}KB`);
    }
  });

  console.log(`${kind}: ${formatKb(totalKb)} across ${matchedFiles.length} files`);
}

function checkHtmlBudget() {
  const limit = budget.assets.html.maxFileKb;
  getKeyRouteHtmlFiles().forEach((file) => {
    if (!fs.existsSync(file)) { failures.push(`Missing key route: ${relative(file)}`); return; }
    const sizeKb = fs.statSync(file).size / 1024;
    if (sizeKb > limit) failures.push(`${relative(file)} HTML ${formatKb(sizeKb)} เกินงบ ${limit}KB`);
  });
}

function checkRouteStyles() {
  const routes = new Set([...nfrKeyRoutePaths, ...Object.keys(budget.assets.css.routes || {})]);
  for (const route of routes) {
    const htmlFile = route === "/404.html" ? path.join(distDir, "404.html") : path.join(distDir, route, "index.html");
    if (!fs.existsSync(htmlFile)) { failures.push(`Missing CSS budget route: ${route}`); continue; }
    const html = fs.readFileSync(htmlFile, "utf8");
    const sheets = [...html.matchAll(/<link\b[^>]*>/gi)].filter(([tag]) => /rel=["']stylesheet["']/i.test(tag)).map(([tag]) => tag.match(/href=["']([^"']+)["']/i)?.[1]).filter((href) => href?.startsWith("/"));
    if (!sheets.length) failures.push(`${route}: no local stylesheets`);
    let bytes = 0;
    for (const href of new Set(sheets)) {
      const file = path.join(distDir, href.split("?")[0]);
      if (!fs.existsSync(file)) { failures.push(`${route}: missing stylesheet ${href}`); continue; }
      if (!href.startsWith("/_astro/")) failures.push(`${route}: stylesheet is not content-hashed: ${href}`);
      bytes += fs.statSync(file).size;
    }
    const limit = budget.assets.css.routes?.[route] ?? budget.assets.css.maxRouteKb;
    if (bytes / 1024 > limit) failures.push(`${route}: CSS ${formatKb(bytes / 1024)} exceeds ${limit}KB`);
    console.log(`${route}: CSS ${formatKb(bytes / 1024)}`);
  }
}

function checkKeyRouteImages() {
  const limits = budget.assets.keyRouteImages;
  getKeyRouteHtmlFiles().forEach((htmlFile) => {
    if (!htmlFile || !fs.existsSync(htmlFile)) return;
    const html = fs.readFileSync(htmlFile, "utf8");
    const imageFiles = findLocalImages(html, path.dirname(htmlFile));
    const totalKb = sumBytes(imageFiles) / 1024;
    if (totalKb > limits.totalKb) {
      failures.push(`${relative(htmlFile)} รูป local รวม ${formatKb(totalKb)} เกินงบ ${limits.totalKb}KB`);
    }

    imageFiles.forEach((imageFile) => {
      const sizeKb = fs.statSync(imageFile).size / 1024;
      if (sizeKb > limits.maxFileKb) {
        failures.push(`${relative(imageFile)} ${formatKb(sizeKb)} เกินงบรูปต่อไฟล์ ${limits.maxFileKb}KB`);
      }
    });
  });
}

function getKeyRouteHtmlFiles() {
  return nfrKeyRoutePaths.map((route) => {
    if (route === "/404.html") return path.join(distDir, "404.html");
    const cleanRoute = route.replace(/^\/+|\/+$/g, "");
    return cleanRoute ? path.join(distDir, cleanRoute, "index.html") : path.join(distDir, "index.html");
  });
}

function findLocalImages(html, htmlDir) {
  const matches = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  const imagePaths = new Set();

  matches.forEach(([, src]) => {
    if (/^(https?:|data:|blob:)/i.test(src)) return;
    const cleanSrc = src.split("?")[0].split("#")[0];
    const imagePath = cleanSrc.startsWith("/")
      ? path.join(distDir, cleanSrc)
      : path.resolve(htmlDir, cleanSrc);
    if (fs.existsSync(imagePath)) imagePaths.add(imagePath);
  });

  return [...imagePaths];
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function sumBytes(matchedFiles) {
  return matchedFiles.reduce((total, file) => total + fs.statSync(file).size, 0);
}

function relative(file) {
  return path.relative(rootDir, file);
}

function formatKb(value) {
  return `${value.toFixed(1)}KB`;
}
