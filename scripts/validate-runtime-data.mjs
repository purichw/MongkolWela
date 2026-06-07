import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTempleDetailUrl } from "../src/data/temple-slugs.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collections = [
  { key: "popular", file: "src/data/popular-temples.json", label: "สายไหว้พระ 9 วัด" },
  { key: "mu", file: "src/data/mu-temples.json", label: "สายมู" },
  { key: "sacred", file: "src/data/sacred-temples.json", label: "พิกัดศักดิ์สิทธิ์" },
];

const errors = [];
const warnings = [];

for (const collection of collections) {
  const absolutePath = path.join(rootDir, collection.file);
  const rows = readJsonArray(absolutePath, collection);
  validateCollection(collection, rows);
}

report();

function readJsonArray(absolutePath, collection) {
  try {
    const data = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    if (!Array.isArray(data)) {
      errors.push(`${collection.file}: root ต้องเป็น array`);
      return [];
    }
    return data;
  } catch (error) {
    errors.push(`${collection.file}: อ่าน JSON ไม่สำเร็จ (${error.message})`);
    return [];
  }
}

function validateCollection(collection, rows) {
  const rankSeen = new Map();
  const urlSeen = new Map();
  const nameSeen = new Map();

  rows.forEach((temple, index) => {
    const ref = `${collection.file}[${index}]`;
    const name = text(temple.name);
    const rank = Number(temple.rank);
    const url = safeDetailUrl(collection.key, temple);

    requireText(ref, "name", temple.name);
    requireText(ref, "region", temple.region);
    requireText(ref, "province", temple.province);

    if (!Number.isInteger(rank) || rank <= 0) {
      errors.push(`${ref}: rank ต้องเป็นจำนวนเต็มบวก`);
    } else if (rankSeen.has(rank)) {
      errors.push(`${ref}: rank ซ้ำกับ ${rankSeen.get(rank)} (#${rank})`);
    } else {
      rankSeen.set(rank, ref);
    }

    if (url) {
      if (urlSeen.has(url)) errors.push(`${ref}: detail URL ซ้ำกับ ${urlSeen.get(url)} (${url})`);
      urlSeen.set(url, ref);
    }

    if (name) {
      const normalizedName = normalize(name);
      if (nameSeen.has(normalizedName)) warnings.push(`${ref}: ชื่อซ้ำกับ ${nameSeen.get(normalizedName)} (${name})`);
      nameSeen.set(normalizedName, ref);
    }

    validateCoordinatePair(ref, temple);
    validatePlusCode(ref, temple.plusCode);
    validateListField(ref, "blessings", temple.blessings);
    validateListField(ref, "objectHero", temple.objectHero);
    validateListField(ref, "travelModes", temple.travelModes);
    validateImage(ref, temple.imageUrl);
    validateTravelDetail(ref, temple.travelDetail);
  });
}

function validateCoordinatePair(ref, temple) {
  const lat = numberOrNull(temple.latitude);
  const lng = numberOrNull(temple.longitude);

  if ((lat === null) !== (lng === null)) {
    errors.push(`${ref}: latitude/longitude ต้องมีพร้อมกันหรือว่างพร้อมกัน`);
    return;
  }

  if (lat === null) {
    warnings.push(`${ref}: ยังไม่มี latitude/longitude`);
    return;
  }

  if (lat < 5 || lat > 22 || lng < 96 || lng > 107) {
    warnings.push(`${ref}: พิกัดอยู่นอกกรอบประเทศไทยโดยประมาณ (${lat}, ${lng})`);
  }
}

function validatePlusCode(ref, value) {
  const plusCode = text(value);
  if (!plusCode) {
    warnings.push(`${ref}: ยังไม่มี plusCode`);
    return;
  }

  if (!/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:\s+.+)?$/i.test(plusCode)) {
    warnings.push(`${ref}: plusCode รูปแบบน่าสงสัย (${plusCode})`);
  }
}

function validateListField(ref, field, value) {
  if (value === undefined || value === null || value === "") return;
  const items = splitList(value);
  if (!items.length) warnings.push(`${ref}: ${field} มีค่า default/ว่างแปลก ๆ (${value})`);

  const duplicates = findDuplicates(items.map(normalize));
  if (duplicates.length) warnings.push(`${ref}: ${field} มีรายการซ้ำ (${duplicates.join(", ")})`);
}

function validateImage(ref, value) {
  const imageUrl = text(value);
  if (!imageUrl) {
    warnings.push(`${ref}: ยังไม่มี imageUrl`);
    return;
  }

  if (!/^https?:\/\//.test(imageUrl) && !imageUrl.startsWith("/")) {
    warnings.push(`${ref}: imageUrl ไม่ใช่ URL หรือ path ที่ชัดเจน (${imageUrl})`);
  }
}

function validateTravelDetail(ref, value) {
  if (value === undefined || value === null || value === "") {
    warnings.push(`${ref}: ยังไม่มี travelDetail`);
    return;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${ref}: travelDetail ต้องเป็น object`);
    return;
  }

  if (!Array.isArray(value.routes)) {
    warnings.push(`${ref}: travelDetail.routes ยังไม่มีหรือไม่ใช่ array`);
    return;
  }

  value.routes.forEach((route, index) => {
    const routeRef = `${ref}.travelDetail.routes[${index}]`;
    if (!route || typeof route !== "object" || Array.isArray(route)) {
      errors.push(`${routeRef}: route ต้องเป็น object`);
      return;
    }

    requireText(routeRef, "mode", route.mode);
    requireText(routeRef, "stop", route.stop || route.name || route.title);
    if (!text(route.routeText || route.route || route.line)) warnings.push(`${routeRef}: ยังไม่มีสาย/เส้นทาง`);
  });
}

function requireText(ref, field, value) {
  if (!text(value)) errors.push(`${ref}: ต้องมี ${field}`);
}

function safeDetailUrl(collection, temple) {
  try {
    return getTempleDetailUrl(collection, temple);
  } catch (error) {
    errors.push(`${collection}: สร้าง detail URL ไม่สำเร็จสำหรับ ${temple?.name || "unknown"} (${error.message})`);
    return "";
  }
}

function splitList(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && !["0", "nan", "null", "undefined", "-"].includes(item.toLowerCase()));
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  values.forEach((value) => {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  });
  return [...duplicate].filter(Boolean);
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return text(value).replace(/\s+/g, "").toLocaleLowerCase("th-TH");
}

function report() {
  if (warnings.length) {
    console.warn(`\nData validation warnings (${warnings.length}):`);
    warnings.slice(0, 80).forEach((warning) => console.warn(`- ${warning}`));
    if (warnings.length > 80) console.warn(`- ...และอีก ${warnings.length - 80} รายการ`);
  }

  if (errors.length) {
    console.error(`\nData validation errors (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("Data validation passed.");
}
