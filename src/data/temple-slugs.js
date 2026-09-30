import { romanize } from "@pcampus/thai-romanization";
import { templeEnglishNames, templeEnglishPlaceNames } from "./temple-english-names.js";
import { TEMPLE_SLUG_MAX_LENGTH, reservedTempleSlugs as reserved } from "../lib/temple-slug-format.js";
export { TEMPLE_SLUG_MAX_LENGTH, templeSlugError, uniqueTempleSlug } from "../lib/temple-slug-format.js";

// This exact legacy spelling is a persisted CMS identity, not a public URL.
export function createLegacyTempleSlug(temple) {
  const rank = String(temple.rank || "").padStart(3, "0");
  const text = `${rank}-${temple.name || "temple"}-${temple.province || "thailand"}`;
  return text
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function generateTempleSlug(temple) {
  const name = String(temple?.name || "").trim();
  const known = templeEnglishPlaceNames[`${name}|${temple?.province || ""}`] || templeEnglishNames[name];
  if (known) return known;
  const romanized = name.replace(/[\u0e00-\u0e7f]+/g, word => romanize(word, { separator: "-", tone: "omit" }));
  const slug = romanized.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, TEMPLE_SLUG_MAX_LENGTH).replace(/-+$/g, "");
  return slug && !reserved.has(slug) ? slug : "place";
}

export function createTempleSlug(temple) {
  return temple?.cmsSlug || generateTempleSlug(temple);
}

export function getTempleDetailUrl(collection, temple) {
  return `/temples/${collection}/${createTempleSlug(temple)}/`;
}
