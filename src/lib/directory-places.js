import locationCode from "open-location-code";
import { mergePlaceMetadata } from "./place-metadata.js";

const codes = new locationCode.OpenLocationCode();
export const directoryCollection = { key: "thailand", label: "วัดทั่วประเทศไทย" };
const text = value => typeof value === "string" ? value.trim() : "";
const present = value => value !== undefined && value !== null && value !== "";
const coordinate = (value, limit) => (typeof value === "number" || typeof value === "string" && value.trim() !== "")
  && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;

export function parsePlusCode(value) {
  const input = text(value);
  if (!input) return null;
  const [raw, ...area] = input.split(/\s+/);
  const code = raw.toUpperCase();
  if (!codes.isValid(code) || code.includes("0") || code.split("+")[1]?.length < 2) return null;
  const locality = area.join(" ");
  if (codes.isFull(code)) {
    const point = codes.decode(code);
    return { query: code, latitude: point.latitudeCenter, longitude: point.longitudeCenter };
  }
  // A short code alone is ambiguous. Do not guess an origin or province centre.
  if (codes.isShort(code) && /[\p{L}]{2}/u.test(locality)) return { query: `${code} ${locality}` };
  return null;
}

export function directoryLocationErrors(fields = {}) {
  const errors = {};
  const hasLat = present(fields.latitude), hasLng = present(fields.longitude);
  if (hasLat && !coordinate(fields.latitude, 90)) errors.latitude = "ละติจูดต้องเป็นตัวเลขระหว่าง -90 ถึง 90";
  if (hasLng && !coordinate(fields.longitude, 180)) errors.longitude = "ลองจิจูดต้องเป็นตัวเลขระหว่าง -180 ถึง 180";
  if (hasLat && !hasLng) errors.longitude = "กรุณาระบุลองจิจูดให้ครบคู่กับละติจูด";
  if (hasLng && !hasLat) errors.latitude = "กรุณาระบุละติจูดให้ครบคู่กับลองจิจูด";
  const plus = parsePlusCode(fields.plusCode);
  if (present(fields.plusCode) && !plus) errors.plusCode = "กรอก Plus Code แบบเต็ม หรือรหัสย่อพร้อมชื่อพื้นที่ เช่น QF2P+W6 Bangkok";
  if (!hasLat && !hasLng && !plus && !errors.plusCode) errors.plusCode = "ระบุ Plus Code หรือกรอกละติจูดและลองจิจูดเพื่อใช้นำทาง";
  return errors;
}

export function directoryMapLinks(fields) {
  if (Object.keys(directoryLocationErrors(fields)).length) return null;
  const plus = parsePlusCode(fields.plusCode);
  const destination = plus?.query || `${Number(fields.latitude)},${Number(fields.longitude)}`;
  return {
    search: `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: destination })}`,
    directions: `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination })}`,
  };
}

export function validateDirectoryRecords(content) {
  for (const [key, record] of Object.entries(content?.temples?.records || {})) {
    if (record?.collection !== directoryCollection.key && !key.startsWith("thailand:")) continue;
    const fail = message => { throw Object.assign(new Error(`${record?.fields?.name || key}: ${message}`), { statusCode: 400 }); };
    if (record?.collection !== directoryCollection.key || !key.startsWith("thailand:") || record.key && record.key !== key) fail("รหัสสถานที่ไม่ตรงกัน");
    if (record.enabled === false || record.status === "deleted") continue;
    const fields = record.fields || {};
    if (!text(fields.name) || fields.name.length > 200) fail("กรุณาระบุชื่อสถานที่ไม่เกิน 200 ตัวอักษร");
    const errors = directoryLocationErrors(fields);
    if (Object.keys(errors).length) fail(Object.values(errors)[0]);
  }
}

export function directoryAdminCatalog(content, base = []) {
  const order = content?.temples?.order?.thailand || [];
  const positions = new Map(order.map((key, index) => [key, index]));
  const records = content?.temples?.records || {};
  const merged = new Map(base.map(item => [item.key, item]));
  for (const [key, record] of Object.entries(records)) {
    if (record?.collection !== "thailand") continue;
    const original = merged.get(key);
    // An OSM-derived entry whose curated source was hidden must stay hidden.
    if (!original && ["osm", "curated", "watportal"].includes(record.source)) continue;
    if (record.enabled === false || record.status === "deleted") { merged.delete(key); continue; }
    const locationChanged = original && ["latitude", "longitude", "plusCode"].some(field => Object.hasOwn(record.fields || {}, field) && String(record.fields[field] ?? "") !== String(original.temple[field] ?? ""));
    merged.set(key, { key, source: original?.source || "admin", locationSource: locationChanged ? "admin" : original?.source || "admin", temple: { ...original?.temple, ...record.fields,
      metadata: mergePlaceMetadata(original?.temple.metadata, record.fields?.metadata), images: record.images || original?.temple.images || {} } });
  }
  return [...merged.values()].map(({ key, source, locationSource, temple }) => ({
      key, collection: "thailand", collectionLabel: directoryCollection.label, source, locationSource: locationSource || source,
      detailUrl: `/temples/thailand/?place=${encodeURIComponent(key)}#directory-managed`,
      temple, visitInfo: {},
    })).sort((a, b) => {
      const position = key => positions.get(key) ?? Number.MAX_SAFE_INTEGER;
      return position(a.key) - position(b.key) || (Number(a.temple.rank) || 0) - (Number(b.temple.rank) || 0);
    });
}

export function directoryPublicPlaces(content, base = []) {
  return directoryAdminCatalog(content, base).flatMap(record => {
    const fields = record.temple;
    const links = directoryMapLinks(fields);
    if (!links || !text(fields.name)) return [];
    const variant = value => typeof value === "string" ? value : value?.url;
    return [{
      key: record.key, source: record.locationSource, name: text(fields.name), region: text(fields.region), province: text(fields.province), district: text(fields.district),
      address: text(fields.coordinateAddress), summary: text(fields.summary), links,
      image: variant(fields.images?.card?.desktop) ?? fields.imageUrl ?? "",
      imageMobile: variant(fields.images?.card?.mobile) ?? variant(fields.images?.card?.desktop) ?? fields.imageUrl ?? "",
      imageAlt: text(fields.imageAlt), imageSourceLabel: text(fields.imageSourceLabel), imageSourceUrl: text(fields.imageSourceUrl),
    }];
  });
}
