import popularTemples from "./popular-temples.json" with { type: "json" };
import muTemples from "./mu-temples.json" with { type: "json" };
import sacredTemples from "./sacred-temples.json" with { type: "json" };
import { templePlaceholderImage } from "./temple-images.js";
import { applyTempleCmsRecords } from "./temple-cms.js";
import { getTempleDetailUrl } from "./temple-slugs.js";

const collectionPriority = ["popular", "mu", "sacred"];

function splitValues(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && item !== "0" && item.toLowerCase() !== "nan" && item.toLowerCase() !== "null");
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("th");
}

function mergeValues(left, right) {
  return Array.from(new Set([...splitValues(left), ...splitValues(right)])).join("; ");
}

function visitMinutesFor(temple) {
  const configured = Number(temple.visitDuration?.recommendedMinutes);
  if (Number.isFinite(configured) && configured > 0) return configured;
  if (!String(temple.placeType || "").includes("วัด")) return 30;
  if (Number(temple.globalMentions || temple.mentions || 0) >= 12) return 60;
  return 45;
}

function mergeTemple(existing, temple, collection) {
  if (!existing) {
    return {
      ...temple,
      collection,
      collections: [collection],
      blessings: mergeValues("", temple.blessings),
      objectHero: mergeValues("", temple.objectHero),
    };
  }

  existing.collections.push(collection);
  existing.categoryMembership = mergeValues(existing.categoryMembership, temple.categoryMembership);
  existing.globalRank = Math.min(
    Number(existing.globalRank || Number.POSITIVE_INFINITY),
    Number(temple.globalRank || Number.POSITIVE_INFINITY),
  );
  existing.globalMentions = Math.max(Number(existing.globalMentions || 0), Number(temple.globalMentions || 0));

  return existing;
}

export function getTemplePlannerData(content) {
  const sources = {
    popular: applyTempleCmsRecords("popular", popularTemples, content),
    mu: applyTempleCmsRecords("mu", muTemples, content),
    sacred: applyTempleCmsRecords("sacred", sacredTemples, content),
  };
  const merged = new Map();

  collectionPriority.forEach((collection) => {
    sources[collection].forEach((temple) => {
      if ([temple.latitude, temple.longitude].some((value) => value === "" || value == null || !Number.isFinite(Number(value)))) return;
      const key = temple.plannerId || `${normalizeKey(temple.name)}|${normalizeKey(temple.province)}`;
      merged.set(key, mergeTemple(merged.get(key), temple, collection));
    });
  });

  const items = Array.from(merged.entries())
    .map(([id, temple]) => ({
      id,
      name: temple.name,
      region: temple.region,
      province: temple.province,
      district: temple.district || "",
      placeType: temple.placeType || "วัด",
      blessings: splitValues(temple.blessings),
      objectHero: splitValues(temple.objectHero).slice(0, 3),
      collections: temple.collections,
      imageUrl: temple.imageUrl || templePlaceholderImage,
      imageMobileUrl: (temple.imageMobileUrl ?? temple.imageUrl) || templePlaceholderImage,
      imageAlt: temple.imageAlt ?? `${temple.name} ${temple.province}`,
      latitude: Number(temple.latitude),
      longitude: Number(temple.longitude),
      globalRank: Number.isFinite(Number(temple.globalRank)) ? Number(temple.globalRank) : 9999,
      globalMentions: Number(temple.globalMentions || temple.mentions || 0),
      visitMinutes: visitMinutesFor(temple),
      detailUrl: getTempleDetailUrl(temple.collection, temple),
    }))
    .sort(
      (left, right) =>
        left.globalRank - right.globalRank ||
        right.globalMentions - left.globalMentions ||
        left.name.localeCompare(right.name, "th"),
    );

  const regions = Array.from(new Set(items.map((item) => item.region))).filter(Boolean);
  const provinces = Array.from(new Set(items.map((item) => item.province))).filter(Boolean).sort((a, b) => a.localeCompare(b, "th"));
  const purposes = Array.from(new Set(items.flatMap((item) => item.blessings))).sort((a, b) => a.localeCompare(b, "th"));

  return {
    items,
    filters: { regions, provinces, purposes },
    placeholderImage: templePlaceholderImage,
  };
}
