import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const visitInfoPath = path.join(rootDir, "src/data/temple-visit-info.json");
const watportalPath = path.join(rootDir, "src/data/watportal-temple-details.json");
const collectionFiles = [
  "src/data/popular-temples.json",
  "src/data/mu-temples.json",
  "src/data/sacred-temples.json",
];
const officialSourceTypes = new Set(["official", "government", "official-tourism"]);
const errors = [];
const warnings = [];

const visitInfo = readJson(visitInfoPath, {});
const watportalData = readJson(watportalPath, { entries: {} });
const validKeys = buildValidTempleKeys();
const entries = visitInfo.entries || {};
const watportalEntries = watportalData.entries || {};

if (!text(visitInfo.fallbackNotice)) errors.push("fallbackNotice ต้องมีข้อความ fallback");
if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
  errors.push("entries ต้องเป็น object");
} else {
  Object.entries(entries).forEach(([key, entry]) => validateEntry(key, entry));
}
validateWatPortalData();

report();

function validateEntry(key, entry) {
  if (!validKeys.has(key)) warnings.push(`${key}: ไม่พบ key นี้ใน temple runtime data ปัจจุบัน`);
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push(`${key}: entry ต้องเป็น object`);
    return;
  }

  requireText(key, "status", entry.status);
  requireText(key, "reviewedAt", entry.reviewedAt);

  if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
    errors.push(`${key}: ต้องมี sources อย่างน้อย 1 รายการ`);
    return;
  }

  const sourceMap = new Map();
  entry.sources.forEach((source, index) => {
    const ref = `${key}.sources[${index}]`;
    requireText(ref, "id", source?.id);
    requireText(ref, "label", source?.label);
    requireText(ref, "url", source?.url);
    requireText(ref, "type", source?.type);
    if (source?.url && !/^https?:\/\//.test(source.url)) errors.push(`${ref}: url ต้องเป็น https/http URL`);
    if (source?.id) sourceMap.set(source.id, source);
  });

  ["admission", "hours", "contact"].forEach((field) => validateFactSection(key, field, entry[field], sourceMap));
}

function validateFactSection(key, field, section, sourceMap) {
  if (!section) return;
  const ref = `${key}.${field}`;
  if (!["verified", "listed"].includes(section.status)) return;

  requireText(ref, "summary", section.summary);
  if (!Array.isArray(section.sourceIds) || section.sourceIds.length === 0) {
    errors.push(`${ref}: ${section.status} section ต้องมี sourceIds`);
    return;
  }

  const sources = section.sourceIds.map((id) => sourceMap.get(id));
  section.sourceIds.forEach((id) => {
    if (!sourceMap.has(id)) errors.push(`${ref}: sourceIds อ้างถึง source ที่ไม่มี (${id})`);
  });

  if (section.status === "listed") return;

  const hasOfficialSource = sources.some((source) => officialSourceTypes.has(source?.type));
  if (!hasOfficialSource && section.sourceIds.length < 2) {
    errors.push(`${ref}: แหล่งไม่เป็นทางการต้องมีอย่างน้อย 2 sources`);
  }
}

function validateWatPortalData() {
  if (!watportalData || typeof watportalData !== "object" || Array.isArray(watportalData)) {
    errors.push("watportal-temple-details.json: root ต้องเป็น object");
    return;
  }

  if (!watportalEntries || typeof watportalEntries !== "object" || Array.isArray(watportalEntries)) {
    errors.push("watportal-temple-details.json: entries ต้องเป็น object");
    return;
  }

  Object.entries(watportalEntries).forEach(([key, entry]) => {
    const ref = `watportal.${key}`;
    if (!validKeys.has(key)) warnings.push(`${ref}: ไม่พบ key นี้ใน temple runtime data ปัจจุบัน`);
    requireText(ref, "sourceId", entry?.sourceId);
    requireText(ref, "sourceLabel", entry?.sourceLabel);
    requireText(ref, "url", entry?.url);
    requireText(ref, "officialName", entry?.officialName);
    if (entry?.url && !/^https:\/\/www\.watportal\.com\/th\/wat\/region\/detail\/iid\/\d+/.test(entry.url)) {
      errors.push(`${ref}: url ต้องเป็น Wat Portal detail URL`);
    }
    if (!Number.isFinite(Number(entry?.matchScore)) || Number(entry.matchScore) < 80) {
      errors.push(`${ref}: matchScore ต้องมากกว่าหรือเท่ากับ 80`);
    }
    if (!text(entry?.address) && !text(entry?.hoursSummary)) {
      errors.push(`${ref}: ต้องมี address หรือ hoursSummary อย่างน้อยหนึ่งอย่าง`);
    }
    if (entry?.hoursRows && !Array.isArray(entry.hoursRows)) {
      errors.push(`${ref}: hoursRows ต้องเป็น array`);
    }
  });
}

function buildValidTempleKeys() {
  const keys = new Set();
  collectionFiles.forEach((file) => {
    const rows = readJson(path.join(rootDir, file), []);
    rows.forEach((temple) => {
      const name = text(temple.name);
      const province = text(temple.province);
      if (name && province) keys.add(`${name}|${province}`);
    });
  });
  return keys;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(rootDir, filePath)}: อ่าน JSON ไม่สำเร็จ (${error.message})`);
    return fallback;
  }
}

function requireText(ref, field, value) {
  if (!text(value)) errors.push(`${ref}: ต้องมี ${field}`);
}

function text(value) {
  return String(value ?? "").trim();
}

function report() {
  if (warnings.length) {
    console.warn(`\nTemple visit info warnings (${warnings.length}):`);
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error(`\nTemple visit info errors (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Temple visit info validation passed.");
}
