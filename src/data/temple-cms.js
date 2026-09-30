import { normalizePlaceholderImage } from "../lib/image-placeholder.js";
import liveContent from "../../public/admin/content/live.json" with { type: "json" };
import templeImageOverrides from "./temple-image-overrides.json" with { type: "json" };
import { createLegacyTempleSlug, generateTempleSlug, templeSlugError, uniqueTempleSlug } from "./temple-slugs.js";

export const templeCollectionConfig = {
  popular: {
    key: "popular",
    label: "วัดดังน่าไป",
    href: "/temples/popular/",
  },
  mu: {
    key: "mu",
    label: "พิกัดสายมู",
    href: "/temples/mu/",
  },
  sacred: {
    key: "sacred",
    label: "วัดเด่นขอพร",
    href: "/temples/sacred/",
  },
};

export const templeImageSlots = {
  card: {
    label: "รูปหน้า Overview List",
    ratio: 16 / 10,
    ratioLabel: "16 : 10",
  },
  hero: {
    label: "รูป Banner หน้ารายละเอียด",
    ratio: 16 / 10,
    ratioLabel: "16 : 10",
  },
  map: {
    label: "รูปในแผนที่",
    ratio: 16 / 9,
    ratioLabel: "16 : 9",
  },
};

function imageKey(temple) {
  return `${temple.name}|${temple.province}`;
}

function applyImageOverride(collection, temple) {
  const key = imageKey(temple);
  const direct = templeImageOverrides[collection]?.[key];
  if (direct) return { ...temple, ...direct };

  for (const [name, overrides] of Object.entries(templeImageOverrides)) {
    if (name.startsWith("_") || !overrides || typeof overrides !== "object") continue;
    if (overrides[key]) return { ...temple, ...overrides[key] };
  }
  return temple;
}

function recordsFromContent(content) {
  const records = content?.temples?.records || {};
  if (Array.isArray(records)) return Object.fromEntries(records.filter((record) => record?.key).map((record) => [record.key, record]));
  return records && typeof records === "object" ? records : {};
}

function collectionOrderFromContent(content, collection) {
  const order = content?.temples?.order?.[collection];
  return Array.isArray(order) ? order.filter(Boolean) : [];
}

function imageVariant(value, fallbackUrl = "") {
  if (typeof value === "string") return { url: value };
  if (value && typeof value === "object") return { ...value, url: value.url ?? fallbackUrl };
  return { url: fallbackUrl };
}

export function normalizeTempleImages(images = {}, fallbackUrl = "", fallbackAlt = "") {
  const cardDesktop = imageVariant(images.card?.desktop, fallbackUrl);
  const cardMobile = imageVariant(images.card?.mobile, cardDesktop.url);
  const heroDesktop = imageVariant(images.hero?.desktop, cardDesktop.url);
  const heroMobile = imageVariant(images.hero?.mobile, heroDesktop.url);
  const mapDesktop = imageVariant(images.map?.desktop, cardDesktop.url);
  const mapMobile = imageVariant(images.map?.mobile, mapDesktop.url);

  return {
    card: {
      desktop: { alt: fallbackAlt, ...cardDesktop },
      mobile: { alt: fallbackAlt, ...cardMobile },
    },
    hero: {
      desktop: { alt: fallbackAlt, ...heroDesktop },
      mobile: { alt: fallbackAlt, ...heroMobile },
    },
    map: {
      desktop: { alt: fallbackAlt, ...mapDesktop },
      mobile: { alt: fallbackAlt, ...mapMobile },
    },
  };
}

function mergeTempleRecord(baseTemple, record, collection, key) {
  const fields = { ...(record?.fields || {}) };
  const merged = { ...baseTemple, ...fields };
  const fallbackImage = fields.imageUrl ?? merged.imageUrl ?? "";
  const fallbackAlt = fields.imageAlt ?? merged.imageAlt ?? `${merged.name || "สถานที่"} ${merged.province || ""}`.trim();
  const images = normalizeTempleImages(record?.images, fallbackImage, fallbackAlt);
  const storedSlug = record?.slug || merged.cmsSlug || "";
  const slug = !templeSlugError(storedSlug) ? storedSlug : generateTempleSlug(baseTemple?.name ? baseTemple : merged);
  const aliases = [...new Set([
    ...(baseTemple?.name ? [createLegacyTempleSlug(baseTemple), generateTempleSlug(baseTemple)] : []),
    storedSlug,
    ...(Array.isArray(record?.slugAliases) ? record.slugAliases : []),
  ].filter(value => typeof value === "string" && value && !/[/?#\\]/.test(value)))];

  return {
    ...merged,
    cmsKey: key,
    cmsVisitInfoKey: baseTemple?.name ? imageKey(baseTemple) : "",
    plannerId: baseTemple?.name
      ? `${baseTemple.name}|${baseTemple.province}`.normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("th")
      : key,
    cmsSlug: slug,
    cmsSlugAliases: aliases.filter(value => value !== slug),
    cmsSlugMode: record?.slugMode || (storedSlug && !templeSlugError(storedSlug) ? "custom" : "auto"),
    cmsSlugExplicit: Boolean(storedSlug && !templeSlugError(storedSlug)),
    cmsHidden: record?.status === "deleted" || record?.enabled === false,
    cmsSource: record?.source || (baseTemple ? "dataset" : "admin"),
    cmsImages: images,
    imageUrl: normalizePlaceholderImage(images.card.desktop.url),
    imageMobileUrl: normalizePlaceholderImage(images.card.mobile.url),
    detailImageUrl: normalizePlaceholderImage(images.hero.desktop.url),
    detailImageMobileUrl: normalizePlaceholderImage(images.hero.mobile.url),
    mapImageUrl: normalizePlaceholderImage(images.map.desktop.url),
    mapImageMobileUrl: normalizePlaceholderImage(images.map.mobile.url),
    imageAlt: fallbackAlt,
    collection,
  };
}

export function applyTempleCmsRecords(collection, temples, content = liveContent, { includeHidden = false } = {}) {
  const records = recordsFromContent(content);
  const legacyOverrides = content?.temples?.overrides || {};
  const explicitOrder = collectionOrderFromContent(content, collection);
  const usedKeys = new Set();
  const merged = [];

  temples.map((temple) => applyImageOverride(collection, temple)).forEach((temple) => {
    const baseSlug = createLegacyTempleSlug(temple);
    const key = `${collection}:${baseSlug}`;
    const record = records[key] || legacyOverrides[key];
    usedKeys.add(key);
    merged.push(mergeTempleRecord(temple, record, collection, key));
  });

  Object.entries(records).forEach(([key, record]) => {
    if (usedKeys.has(key) || record?.collection !== collection) return;
    merged.push(mergeTempleRecord({}, record, collection, key));
  });

  const occupied = new Set(merged.filter(item => item.cmsSlugExplicit).flatMap(item => [item.cmsSlug, ...item.cmsSlugAliases]));
  for (const item of [...merged].sort((a, b) => a.cmsKey.localeCompare(b.cmsKey))) {
    if (item.cmsSlugExplicit) continue;
    const proposed = item.cmsSlug;
    item.cmsSlug = uniqueTempleSlug(proposed, occupied);
    item.cmsSlugAliases = item.cmsSlugAliases.filter(alias => alias !== item.cmsSlug);
    occupied.add(item.cmsSlug);
    for (const alias of item.cmsSlugAliases) occupied.add(alias);
  }
  const ranked = merged.filter(item => includeHidden || !item.cmsHidden).sort((a, b) => {
    const rankDifference = (Number(a.rank) || Number.MAX_SAFE_INTEGER) - (Number(b.rank) || Number.MAX_SAFE_INTEGER);
    return rankDifference || String(a.name || "").localeCompare(String(b.name || ""), "th");
  });

  if (!explicitOrder.length) return ranked;

  const positions = new Map(explicitOrder.map((key, index) => [key, index]));
  ranked.sort((a, b) => {
    const aPosition = positions.get(a.cmsKey);
    const bPosition = positions.get(b.cmsKey);
    if (aPosition !== undefined && bPosition !== undefined) return aPosition - bPosition;
    if (aPosition !== undefined) return -1;
    if (bPosition !== undefined) return 1;
    const rankDifference = (Number(a.rank) || Number.MAX_SAFE_INTEGER) - (Number(b.rank) || Number.MAX_SAFE_INTEGER);
    return rankDifference || String(a.name || "").localeCompare(String(b.name || ""), "th");
  });

  return ranked.map((temple, index) => ({ ...temple, rank: index + 1 }));
}

export function getTempleCmsRecordMap(content = liveContent) {
  return recordsFromContent(content);
}
