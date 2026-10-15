import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { templeRouteCatalog } from "../src/lib/temple-routing.js";
import { placeMetadata } from "../src/lib/place-metadata.js";

const root = new URL("../", import.meta.url);
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), "utf8"));
const optional = async path => { try { return await read(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; } };
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const write = (path, value) => fs.writeFile(new URL(path, root), JSON.stringify(value));
const normalize = value => String(value || "").normalize("NFC").toLocaleLowerCase("th").replace(/^วัด\s*/, "").replace(/[\s\p{P}]/gu, "");
const signature = (name, province) => `${province}|${normalize(name)}`;
const osm = await read("public/assets/data/thailand-mapped-osm.json");
const registry = await read("public/assets/data/temples-thailand.json");
const research = await read("src/data/directory-research-evidence.json");
const watportal = await optional("artifacts/directory-places/watportal/index.json");
const curated = templeRouteCatalog({});
const targets = new Map();
for (const place of curated) {
  const key = `thailand:${place.plannerId}`;
  if (targets.has(key)) targets.get(key).aliases.push(place.name);
  else targets.set(key, { ...place, aliases: [place.name] });
}
for (const place of osm.places) {
  const key = place.curatedKey ? `thailand:${place.curatedKey}` : `thailand:osm:${place.id}`;
  const aliases = [place.name, ...Object.entries(place.metadata.sources[0].fields)
    .filter(([key]) => /^(name|alt_name|official_name|short_name|loc_name)(:|$)/.test(key)).flatMap(([, value]) => value.split(";"))];
  if (targets.has(key)) targets.get(key).aliases.push(...aliases);
  else targets.set(key, { ...place, aliases });
}
const indexRows = (rows, names, province) => {
  const index = new Map();
  for (const row of rows) for (const name of new Set(names(row))) {
    const key = signature(name, province(row));
    index.set(key, [...(index.get(key) || []), row]);
  }
  return index;
};
const registryIndex = indexRows(registry.rows, row => [row[2]], row => row[11]);
const watportalIndex = indexRows(watportal?.records || [], row => [row.name], row => row.province);
const details = new Map();
const categories = new Map();
try {
  for (const file of await fs.readdir(new URL("artifacts/directory-places/watportal/details/", root))) {
    const row = await read(`artifacts/directory-places/watportal/details/${file}`);
    details.set(row.id, row);
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }
try {
  for (const file of await fs.readdir(new URL("artifacts/directory-places/watportal/categories/", root))) {
    const category = await read(`artifacts/directory-places/watportal/categories/${file}`);
    for (const row of category.records) categories.set(row.id, [...(categories.get(row.id) || []), category]);
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }
const researchRows = research.sources.flatMap(source => source.places.map(place => ({ ...place, source })));
const researchIndex = indexRows(researchRows, row => [row.name, ...(row.aliases || [])], row => row.province);
const byKey = {}, review = [], sourceCounts = {};
const match = (index, place, id) => [...new Map(place.aliases.flatMap(name => index.get(signature(name, place.province)) || []).map(row => [id(row), row])).values()];
const oneLocation = (rows, place, district) => {
  if (rows.length <= 1) return rows;
  return place.district ? rows.filter(row => normalize(district(row)).replace(/^อำเภอ|^เขต/, "") === normalize(place.district).replace(/^อำเภอ|^เขต/, "")) : [];
};
for (const [key, place] of targets) {
  const sources = [];
  const original = match(registryIndex, place, row => row[1]);
  const matched = oneLocation(original, place, row => row[10]);
  if (matched.length === 1) {
    const row = matched[0];
    sources.push({ provider: "legacy-registry", id: row[1], url: null, sourceFile: registry.meta.sourceFile,
      retrievedAt: registry.meta.generatedAt, identityMatch: "unique-name-province-or-district",
      fields: Object.fromEntries(registry.meta.columns.map((column, index) => [column, row[index] ?? null])) });
  } else if (original.length > 1) review.push({ key, provider: "legacy-registry", reason: "ambiguous-name", candidates: original.map(row => row[1]) });
  const portalCandidates = match(watportalIndex, place, row => row.id);
  const portal = oneLocation(portalCandidates, place, row => row.district);
  if (portal.length === 1) {
    const row = portal[0], detail = details.get(row.id);
    sources.push({ provider: "watportal", id: row.id, url: row.url, retrievedAt: detail?.retrievedAt || null,
      identityMatch: "unique-name-province-or-district", fields: detail?.fields || { "ชื่อ": row.name, "ที่ตั้ง": row.listingAddress },
      detailStatus: detail ? "fetched" : "not-fetched" });
    for (const category of categories.get(row.id) || []) sources.push({ provider: "watportal", id: row.id,
      url: category.url, retrievedAt: category.retrievedAt, evidence: "source-filter",
      request: { method: category.method, type: category.filter },
      fields: { "ประเภทวัด": category.category } });
  } else if (portalCandidates.length > 1) review.push({ key, provider: "watportal", reason: "ambiguous-name", candidates: portalCandidates.map(row => row.id) });
  for (const row of match(researchIndex, place, row => `${row.source.url}|${row.name}`)) {
    sources.push({ provider: row.source.provider, url: row.source.url, retrievedAt: research.reviewedAt,
      evidence: row.source.evidence, identityMatch: "name-province",
      fields: { name: row.name, province: row.province, ...(row.aliases ? { aliases: row.aliases } : {}),
        ...(row.plusCode ? { plusCode: row.plusCode } : {}), ...(row.coordinates ? { coordinates: row.coordinates } : {}) },
      assertions: [{ facet: "sourceMention", value: row.source.provider }, ...(row.assertions || [])] });
  }
  if (sources.length) {
    byKey[key] = placeMetadata(sources);
    for (const source of sources) sourceCounts[source.provider] = (sourceCounts[source.provider] || 0) + 1;
  }
}
const payload = { meta: { datasetRevision: hash(byKey), reviewedAt: research.reviewedAt, watportalIndexComplete: watportal?.complete === true,
  watportalDetailsFetched: details.size, sourceCounts, missingFieldsPolicy: "unknown; never infer sect or legal status from temple names" }, byKey };
await write("public/assets/data/thailand-directory-metadata.json", payload);
await write("artifacts/directory-places/metadata-review.json", { sourceCounts, review });

// A deletion proposal is only created after the entire Watportal index is read.
// Matching absence is an eligibility policy, not proof that a temple does not exist.
if (watportal?.complete && watportal.records.length === watportal.total) {
  await write("src/data/watportal-directory-index.json", watportal);
  const evidence = indexRows([...targets.values(), ...watportal.records, ...researchRows], row => [row.name, ...(row.aliases || [])], row => row.province);
  const keep = [], candidates = [];
  for (const row of registry.rows) {
    const item = { id: row[1], name: row[2], province: row[11], district: row[10] };
    (evidence.has(signature(row[2], row[11])) ? keep : candidates).push(item);
  }
  const protectedFiles = ["src/data/popular-temples.json", "src/data/sacred-temples.json", "src/data/mu-temples.json"];
  const proposal = {
    status: "AWAITING_USER_APPROVAL_NO_DELETION_PERFORMED", workspaceRoot: fileURLToPath(root), originalRecords: registry.rows.length,
    sourceMatchedRecords: keep.length, unmatchedCandidates: candidates.length,
    matchingPolicy: "Conservative exact normalized name + province; ambiguous matches retained. Curated collections protected. Not an exhaustive internet absence claim.",
    files: [{ path: "public/assets/data/temples-thailand.json",
      action: "Remove only candidate row IDs from rows; retain all columns and metadata of source-matched records. Update count metadata and rebuild the dependent geographic index.",
      recordsBefore: registry.rows.length, recordsToRemove: candidates.length, recordsAfter: keep.length,
      bytes: (await fs.stat(new URL("public/assets/data/temples-thailand.json", root))).size,
      sha256: createHash("sha256").update(await fs.readFile(new URL("public/assets/data/temples-thailand.json", root))).digest("hex") }],
    prerequisites: ["Extract CMS province/district/subdistrict lookup before removal", "Preserve metadata for source-matched places", "Update legacy index and smoke tests", "Obtain explicit approval of final paths/counts"],
    protectedFiles: await Promise.all(protectedFiles.map(async path => ({ path, records: (await read(path)).length, sha256: createHash("sha256").update(await fs.readFile(new URL(path, root))).digest("hex") }))),
    scope: "Current project working tree and future deployment only. Git history, remote deployments and backups are not purged.",
    candidates,
  };
  await write("artifacts/directory-places/deletion-proposal.json", proposal);
}
console.log(JSON.stringify({ ...payload.meta, placesWithMetadata: Object.keys(byKey).length, reviewCount: review.length }, null, 2));
