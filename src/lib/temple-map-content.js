import { publishedTempleUrl } from "./temple-url.js";

const imageUrl = value => typeof value === "string" ? value : value?.url;
const coordinate = (value, limit) => ["number", "string"].includes(typeof value) && String(value).trim() !== "" && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;

export function templeMapItems(items, content = {}, collection) {
  const order = content.temples?.order?.[collection] || [];
  return items.flatMap(item => {
    const key = item.key || decodeURIComponent(item.detailUrl).replace(/^\/temples\//, "").replace(/\/$/, "").replace("/", ":");
    const record = content.temples?.records?.[key] || content.temples?.overrides?.[key] || {};
    if (record.enabled === false || record.status === "deleted") return [];
    const fields = record.fields || {};
    const next = { ...item };
    next.detailUrl = publishedTempleUrl(content, key, next.detailUrl);
    for (const field of ["name", "region", "province", "district", "latitude", "longitude", "rank", "imageAlt"]) {
      if (Object.hasOwn(fields, field)) next[field] = fields[field];
    }
    const index = order.indexOf(key);
    if (index >= 0) next.rank = index + 1;
    const desktop = imageUrl(record.images?.map?.desktop) ?? imageUrl(record.images?.card?.desktop) ?? fields.imageUrl;
    const mobile = imageUrl(record.images?.map?.mobile) ?? (desktop !== undefined ? desktop : undefined);
    if (desktop !== undefined) next.imageUrl = desktop;
    if (mobile !== undefined) next.imageMobileUrl = mobile;
    return coordinate(next.latitude, 90) && coordinate(next.longitude, 180) ? [{ ...next, latitude: Number(next.latitude), longitude: Number(next.longitude) }] : [];
  });
}
