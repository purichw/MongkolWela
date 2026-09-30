import popular from "../data/popular-temples.json" with { type: "json" };
import mu from "../data/mu-temples.json" with { type: "json" };
import sacred from "../data/sacred-temples.json" with { type: "json" };
import { applyTempleCmsRecords } from "../data/temple-cms.js";
import { getTempleDetailUrl, templeSlugError } from "../data/temple-slugs.js";

export const templeDatasets = { popular, mu, sacred };

export function templeRouteCatalog(content, { includeHidden = false } = {}) {
  return Object.entries(templeDatasets).flatMap(([collection, rows]) =>
    applyTempleCmsRecords(collection, rows, content, { includeHidden }));
}

export function resolveTempleRoute(collection, slug, content) {
  if (!Object.hasOwn(templeDatasets, collection)) return null;
  const rows = applyTempleCmsRecords(collection, templeDatasets[collection], content);
  const temple = rows.find(item => item.cmsSlug === slug) || rows.find(item => item.cmsSlugAliases.includes(slug));
  if (!temple) return null;
  const others = rows.filter(item => item.cmsKey !== temple.cmsKey);
  return {
    temple,
    canonicalPath: getTempleDetailUrl(collection, temple),
    redirect: slug !== temple.cmsSlug,
    relatedTemples: others.sort((a, b) => {
      const score = item => item.province === temple.province ? 0 : item.region === temple.region ? 1 : 2;
      return score(a) - score(b);
    }).slice(0, 3),
  };
}

function invalid(message) {
  throw Object.assign(new Error(message), { statusCode: 400 });
}

// Normalize only the temple URL contract. Identities, order, media and visit data
// remain untouched. Existing publications are the authority for redirect history.
export function prepareTempleSlugPublication(next, current) {
  const content = structuredClone(next);
  content.temples ||= {};
  content.temples.records ||= {};
  const records = content.temples.records;
  if (Array.isArray(records) || typeof records !== "object") invalid("ข้อมูลสถานที่ไม่ถูกต้อง");
  const previous = new Map(templeRouteCatalog(current, { includeHidden: true }).map(item => [item.cmsKey, item]));
  const baseKeys = new Set(templeRouteCatalog({}).map(item => item.cmsKey));
  for (const [key, item] of previous) {
    if (!baseKeys.has(key) && !records[key]) {
      records[key] = { ...current.temples?.records?.[key], key, collection: item.collection, slug: item.cmsSlug, status: "deleted", enabled: false };
    }
  }
  for (const [key, record] of Object.entries(records)) {
    if (!record || !Object.hasOwn(templeDatasets, record.collection)) invalid(`หมวดสถานที่ไม่ถูกต้อง: ${key}`);
    if (!key.startsWith(`${record.collection}:`) || (record.key && record.key !== key)) invalid(`รหัสสถานที่ไม่ตรงกัน: ${key}`);
    if (record.slugMode !== undefined && !["auto", "custom"].includes(record.slugMode)) invalid("รูปแบบ URL ไม่ถูกต้อง");
    const oldRecord = current.temples?.records?.[key];
    if (record.slug !== undefined && (record.slug !== oldRecord?.slug || record.slugMode === "custom")) {
      const error = templeSlugError(record.slug);
      if (error) invalid(`${record.fields?.name || key}: ${error}`);
    }
    // Do not accept forged aliases or let a client erase published history.
    record.slugAliases = previous.get(key)?.cmsSlugAliases || [];
  }
  const rows = templeRouteCatalog(content, { includeHidden: true });
  for (const item of rows) {
    const before = previous.get(item.cmsKey);
    const aliases = [...new Set([
      ...item.cmsSlugAliases,
      ...(before ? [before.cmsSlug, ...before.cmsSlugAliases] : []),
    ])].filter(alias => alias !== item.cmsSlug);
    const existing = records[item.cmsKey] || content.temples.overrides?.[item.cmsKey];
    records[item.cmsKey] = {
      ...existing,
      key: item.cmsKey,
      collection: item.collection,
      source: existing?.source || item.cmsSource,
      slug: item.cmsSlug,
      slugMode: existing?.slugMode || item.cmsSlugMode,
      slugAliases: aliases,
    };
  }
  const claims = new Map();
  for (const record of Object.values(records)) {
    for (const slug of [record.slug, ...record.slugAliases]) {
      const path = `${record.collection}/${slug}`;
      if (claims.has(path) && claims.get(path) !== record.key) invalid(`ชื่อ URL ถูกใช้แล้วหรือเป็นลิงก์เดิมของสถานที่อื่น: ${slug}`);
      claims.set(path, record.key);
    }
  }
  return content;
}
