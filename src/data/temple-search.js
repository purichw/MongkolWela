import popular from "./popular-temples.json" with { type: "json" };
import sacred from "./sacred-temples.json" with { type: "json" };
import mu from "./mu-temples.json" with { type: "json" };
import { applyTempleCmsRecords } from "./temple-cms.js";
import { getTempleDetailUrl } from "./temple-slugs.js";
import { searchCollectionKeys, searchCollectionLabels } from "../lib/temple-search.js";

const datasets = { popular, sacred, mu };
const pageIds = { popular: "templesPopular", sacred: "templesSacred", mu: "templesMu" };
const values = value => String(value || "").split(";").map(item => item.trim()).filter(item => item && !/^(nan|null|0)$/i.test(item));
const union = (left, right) => [...new Set([...left, ...right])];

// Search includes places without coordinates; Planner's catalog intentionally does not.
export function getTempleSearchCatalog(content) {
  const merged = new Map();
  const collections = [];
  for (const collection of searchCollectionKeys) {
    const page = content.pages?.find(page => page.id === pageIds[collection]);
    if (page?.enabled === false) continue;
    collections.push({ key: collection, label: page?.label || searchCollectionLabels[collection] });
    for (const temple of applyTempleCmsRecords(collection, datasets[collection], content)) {
      if (!String(temple.name || "").trim()) continue;
      const id = temple.plannerId || temple.cmsKey;
      const detailUrl = getTempleDetailUrl(collection, temple);
      const existing = merged.get(id);
      if (existing) {
        existing.collections.push(collection);
        existing.routes[collection] = detailUrl;
        existing.blessings = union(existing.blessings, values(temple.blessings));
        existing.objects = union(existing.objects, values(temple.objectHero));
      } else {
        merged.set(id, {
          id, name: temple.name, province: temple.province || "", district: temple.district || "",
          blessings: values(temple.blessings), objects: values(temple.objectHero),
          collections: [collection], routes: { [collection]: detailUrl }, detailUrl,
          imageUrl: temple.imageUrl || "", order: merged.size,
        });
      }
    }
  }
  const items = [...merged.values()];
  return { items, filters: {
    collections,
    provinces: [...new Set(items.map(item => item.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    purposes: [...new Set(items.flatMap(item => item.blessings))].sort((a, b) => a.localeCompare(b, "th")),
  } };
}
