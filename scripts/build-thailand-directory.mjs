import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { templeRouteCatalog } from "../src/lib/temple-routing.js";
import { placeMetadata } from "../src/lib/place-metadata.js";

const source = JSON.parse(await fs.readFile(new URL("../artifacts/directory-places/osm/extracted.json", import.meta.url), "utf8"));
const normalize = value => String(value || "").normalize("NFC").toLocaleLowerCase("th").replace(/[\s\p{P}]/gu, "");
const curated = [...new Map(templeRouteCatalog({}).map(place => [place.plannerId || place.cmsKey, place])).values()];
const named = new Map();
for (const place of curated) {
  const key = `${place.province}|${normalize(place.name)}`;
  named.set(key, [...(named.get(key) || []), place]);
}
const matches = [], ambiguous = [];
const places = source.places.map(place => {
  const aliases = [place.name, ...Object.entries(place.tags).filter(([key]) => ["name", "name:th", "name:en", "official_name", "alt_name"].includes(key)).map(([, value]) => value)];
  const candidates = [...new Map(aliases.flatMap(name => named.get(`${place.province}|${normalize(name)}`) || []).map(item => [item.plannerId, item])).values()];
  const near = candidates.filter(item => Math.hypot((Number(item.latitude) - place.latitude) * 111195, (Number(item.longitude) - place.longitude) * 111195 * Math.cos(place.latitude * Math.PI / 180)) < 1000);
  const curatedKey = near.length === 1 ? near[0].plannerId : "";
  if (curatedKey) matches.push({ id: place.id, curatedKey });
  else if (candidates.length) ambiguous.push({ id: place.id, candidates: candidates.map(item => item.plannerId), reason: "name-match-location-needs-review" });
  const address = [place.tags["addr:housenumber"], place.tags["addr:street"], place.tags["addr:subdistrict"], place.tags["addr:postcode"]].filter(Boolean).join(" ");
  return { id: place.id, name: place.name, province: place.province, region: place.region, latitude: place.latitude, longitude: place.longitude,
    metadata: placeMetadata([{ provider: "osm", id: place.id, url: `https://www.openstreetmap.org/${place.id}`,
      retrievedAt: source.meta.sourceTimestamp, fields: place.tags, version: place.version, updatedAt: place.timestamp }]),
    ...(address ? { address } : {}), ...(place.tags["addr:district"] ? { district: place.tags["addr:district"] } : {}), ...(curatedKey ? { curatedKey } : {}) };
}).sort((a, b) => a.province.localeCompare(b.province, "th") || a.name.localeCompare(b.name, "th") || a.id.localeCompare(b.id));
const datasetRevision = createHash("sha256").update(JSON.stringify(places)).digest("hex");
const payload = { meta: { ...source.meta, datasetRevision }, places };
const directory = new URL("../public/assets/data/", import.meta.url);
await fs.writeFile(new URL("thailand-mapped-osm.json", directory), JSON.stringify(payload));
await fs.writeFile(new URL("thailand-mapped-osm-provenance.json", directory), JSON.stringify({ ...source, curatedMatches: matches, ambiguousCuratedMatches: ambiguous }));
console.log(JSON.stringify({ imported: places.length, curated: curated.length, matched: matches.length, ambiguous: ambiguous.length, provinces: source.meta.provinceCount, bytes: Buffer.byteLength(JSON.stringify(payload)) }, null, 2));
