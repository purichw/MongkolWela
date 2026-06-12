import popularTemples from "./popular-temples.json";
import muTemples from "./mu-temples.json";
import sacredTemples from "./sacred-temples.json";
import { applyTempleImageOverrides, templePlaceholderImage } from "./temple-images.js";
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
  existing.blessings = mergeValues(existing.blessings, temple.blessings);
  existing.objectHero = mergeValues(existing.objectHero, temple.objectHero);
  existing.categoryMembership = mergeValues(existing.categoryMembership, temple.categoryMembership);
  existing.globalRank = Math.min(
    Number(existing.globalRank || Number.POSITIVE_INFINITY),
    Number(temple.globalRank || Number.POSITIVE_INFINITY),
  );
  existing.globalMentions = Math.max(Number(existing.globalMentions || 0), Number(temple.globalMentions || 0));

  if ((!existing.imageUrl || existing.imageUrl === templePlaceholderImage) && temple.imageUrl) {
    existing.imageUrl = temple.imageUrl;
    existing.imageMobileUrl = temple.imageMobileUrl;
    existing.imageAlt = temple.imageAlt;
  }

  return existing;
}

export function getTemplePlannerData() {
  const sources = {
    popular: applyTempleImageOverrides("popular", [...popularTemples]),
    mu: applyTempleImageOverrides("mu", [...muTemples]),
    sacred: applyTempleImageOverrides("sacred", [...sacredTemples]),
  };
  const merged = new Map();

  collectionPriority.forEach((collection) => {
    sources[collection].forEach((temple) => {
      if (!Number.isFinite(Number(temple.latitude)) || !Number.isFinite(Number(temple.longitude))) return;
      const key = `${normalizeKey(temple.name)}|${normalizeKey(temple.province)}`;
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
      imageMobileUrl: temple.imageMobileUrl || temple.imageUrl || templePlaceholderImage,
      imageAlt: temple.imageAlt || `${temple.name} ${temple.province}`,
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
