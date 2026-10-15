import { templeRouteCatalog } from "../lib/temple-routing.js";
import { directoryAdminCatalog, directoryPublicPlaces } from "../lib/directory-places.js";
import snapshot from "../../public/assets/data/thailand-mapped-osm.json" with { type: "json" };
import enrichment from "../../public/assets/data/thailand-directory-metadata.json" with { type: "json" };
import watportal from "./watportal-temple-details.json" with { type: "json" };
import { directorySnapshotBase } from "../lib/directory-snapshot.js";
import { placeMetadata, mergePlaceMetadata } from "../lib/place-metadata.js";
import { contentRevision } from "../lib/content-revision.js";

// Curated collections are protected inputs. Never edit or prune them during imports.
export function thailandCuratedBasePlaces(content) {
  const places = new Map();
  for (const temple of templeRouteCatalog(content)) {
    if (![temple.latitude, temple.longitude].every(value => typeof value === "number" || typeof value === "string" && value.trim() !== "")) continue;
    const lat = Number(temple.latitude), lng = Number(temple.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 5.5 || lat > 20.5 || lng < 97.3 || lng > 105.7) continue;
    const identity = temple.plannerId || temple.cmsKey;
    const { name, region, province, district, coordinateAddress, summary, imageAlt, imageSourceLabel, imageSourceUrl, rank } = temple;
    const detail = watportal.entries[`${name}|${province}`];
    const sources = [{ provider: "curated", id: identity, url: `/temples/${temple.collection}/${temple.cmsSlug}/`,
      fields: { collection: temple.collection, placeType: temple.placeType || "", blessings: temple.blessings || "", coordinateSource: temple.coordinateSource,
        coordinateConfidence: temple.coordinateConfidence, originalPlusCode: temple.plusCode || "" } }];
    if (detail) sources.push({ provider: "watportal", id: detail.iid, url: detail.url, retrievedAt: detail.reviewedAt,
      fields: { "ชื่อ": detail.officialName, "ที่ตั้ง": detail.address, "นิกาย": detail.sect,
        "ชนิด": detail.legalStatus, "ประเภทวัด": detail.templeTypes, "วัน - เวลาเปิด": detail.hoursSummary } });
    if (places.has(identity)) {
      const existing = places.get(identity).temple;
      existing.metadata = mergePlaceMetadata(existing.metadata, placeMetadata(sources));
      continue;
    }
    places.set(identity, {
      key: `thailand:${identity}`, source: "curated",
      temple: { name, region, province, district, coordinateAddress, summary, imageAlt, imageSourceLabel, imageSourceUrl, rank,
        metadata: placeMetadata(sources),
        latitude: lat, longitude: lng, plusCode: "", images: temple.cmsImages || {}, imageUrl: temple.imageUrl },
    });
  }
  return [...places.values()];
}

export const thailandSnapshotDescriptor = { url: "/assets/data/thailand-mapped-osm.json", revision: snapshot.meta.datasetRevision };
export const thailandBasePlaces = content => directorySnapshotBase(thailandCuratedBasePlaces(content), snapshot, enrichment);
export const thailandAdminCatalog = content => directoryAdminCatalog(content, thailandBasePlaces(content));
export const thailandPublicPlaces = content => directoryPublicPlaces(content, directorySnapshotBase(thailandCuratedBasePlaces(content), snapshot));

let cached;
export function thailandDirectoryState(content) {
  const revision = contentRevision({ temples: content.temples || {}, dataset: snapshot.meta.datasetRevision, metadata: enrichment.meta.datasetRevision });
  if (cached?.revision === revision) return cached;
  const places = thailandPublicPlaces(content);
  const facets = [...new Map(places.filter(place => place.province).map(place => [place.province, { province: place.province, region: place.region }])).values()];
  cached = { revision, places, facets, summary: { templeCount: places.length, provinceCount: facets.length } };
  return cached;
}

export function thailandDirectoryPage(content, params = new URLSearchParams()) {
  const state = thailandDirectoryState(content);
  const offset = Math.max(0, Math.floor(Number(params.get("offset")) || 0));
  const normalize = value => String(value || "").normalize("NFC").toLocaleLowerCase("th").replace(/\s+/g, "");
  const query = normalize(params.get("q") || params.get("name"));
  const province = params.get("province"), region = params.get("region"), selected = params.get("place");
  const rows = state.places.filter(place => (!province || place.province === province) && (!region || place.region === region)
    && (!selected || place.key === selected) && (!query || normalize(`${place.name} ${place.province} ${place.district}`).includes(query)));
  return { revision: state.revision, places: rows.slice(offset, offset + 24), offset,
    nextOffset: offset + 24 < rows.length ? offset + 24 : null, total: rows.length, facets: state.facets, summary: state.summary };
}
