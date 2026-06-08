import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collectionFiles = {
  popular: "src/data/popular-temples.json",
  mu: "src/data/mu-temples.json",
  sacred: "src/data/sacred-temples.json",
};
const visitInfoPath = path.join(rootDir, "src/data/temple-visit-info.json");
const outputPath = path.join(rootDir, "outputs/temple-visit-info-coverage.json");

const visitInfo = readJson(visitInfoPath, { entries: {} });
const entries = visitInfo.entries || {};
const collections = Object.entries(collectionFiles).map(([name, file]) => ({
  name,
  rows: readJson(path.join(rootDir, file), []),
}));
const uniquePlaces = buildUniquePlaces(collections);
const collectionCoverage = collections.map((collection) => summarizeCollection(collection, entries));
const uniqueCoverage = summarizeRows(uniquePlaces, entries);
const missing = uniquePlaces
  .filter((place) => !entries[place.key])
  .sort((a, b) => a.minRank - b.minRank || a.name.localeCompare(b.name, "th"))
  .map((place) => ({
    key: place.key,
    name: place.name,
    province: place.province,
    collections: place.collections,
    minRank: place.minRank,
  }));
const partial = uniquePlaces
  .filter((place) => entries[place.key] && verifiedSectionCount(entries[place.key]) < 3)
  .sort((a, b) => a.minRank - b.minRank || a.name.localeCompare(b.name, "th"))
  .map((place) => ({
    key: place.key,
    name: place.name,
    province: place.province,
    collections: place.collections,
    minRank: place.minRank,
    verifiedSections: verifiedSectionCount(entries[place.key]),
  }));

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    uniquePlaces: uniqueCoverage.total,
    entries: Object.keys(entries).length,
    fullyVerified: uniqueCoverage.full,
    partiallyVerified: uniqueCoverage.partial,
    listedOnly: uniqueCoverage.listedOnly,
    missing: uniqueCoverage.missing,
  },
  collections: collectionCoverage,
  missing,
  partial,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log("Temple visit info coverage");
console.table([
  {
    scope: "unique",
    total: uniqueCoverage.total,
    full: uniqueCoverage.full,
    partial: uniqueCoverage.partial,
    listedOnly: uniqueCoverage.listedOnly,
    missing: uniqueCoverage.missing,
  },
  ...collectionCoverage.map((item) => ({
    scope: item.name,
    total: item.total,
    full: item.full,
    partial: item.partial,
    listedOnly: item.listedOnly,
    missing: item.missing,
  })),
]);
console.log(`Wrote ${path.relative(rootDir, outputPath)}`);

function buildUniquePlaces(collections) {
  const map = new Map();

  collections.forEach((collection) => {
    collection.rows.forEach((row, index) => {
      const name = text(row.name);
      const province = text(row.province);
      if (!name || !province) return;

      const key = `${name}|${province}`;
      const existing =
        map.get(key) ||
        {
          key,
          name,
          province,
          collections: [],
          minRank: Number.POSITIVE_INFINITY,
        };

      if (!existing.collections.includes(collection.name)) existing.collections.push(collection.name);
      existing.minRank = Math.min(existing.minRank, Number(row.rank) || index + 1);
      map.set(key, existing);
    });
  });

  return [...map.values()];
}

function summarizeCollection(collection, entries) {
  const rows = collection.rows.map((row) => ({
    key: `${text(row.name)}|${text(row.province)}`,
  }));
  return { name: collection.name, ...summarizeRows(rows, entries) };
}

function summarizeRows(rows, entries) {
  const total = rows.length;
  const full = rows.filter((row) => verifiedSectionCount(entries[row.key]) === 3).length;
  const partial = rows.filter((row) => {
    const count = verifiedSectionCount(entries[row.key]);
    return count > 0 && count < 3;
  }).length;
  const listedOnly = rows.filter((row) => verifiedSectionCount(entries[row.key]) === 0 && listedSectionCount(entries[row.key]) > 0).length;
  const missing = rows.filter((row) => verifiedSectionCount(entries[row.key]) === 0 && listedSectionCount(entries[row.key]) === 0).length;
  return { total, full, partial, listedOnly, missing };
}

function verifiedSectionCount(entry) {
  if (!entry) return 0;
  return ["admission", "hours", "contact"].filter((field) => entry[field]?.status === "verified").length;
}

function listedSectionCount(entry) {
  if (!entry) return 0;
  return ["admission", "hours", "contact"].filter((field) => entry[field]?.status === "listed").length;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`${path.relative(rootDir, filePath)}: ${error.message}`);
    return fallback;
  }
}

function text(value) {
  return String(value ?? "").trim();
}
