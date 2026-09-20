import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Imported only by Astro frontmatter; never include the registry in browser JS.
const registry = JSON.parse(readFileSync(resolve("public/assets/data/temples-thailand.json"), "utf8"));
const provinceIndex = registry.meta.columns.indexOf("จังหวัด");
if (provinceIndex < 0) throw new Error("Temple registry is missing its province column");

export const homeDirectorySummary = {
  templeCount: registry.rows.length,
  provinceCount: new Set(registry.rows.map(row => String(row[provinceIndex] || "").trim()).filter(Boolean)).size,
};
