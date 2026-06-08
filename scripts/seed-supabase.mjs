import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadDotEnv(file) {
  try {
    const raw = await fs.readFile(path.join(root, file), "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    });
  } catch {
    // Optional local env file.
  }
}

await loadDotEnv(".env.local");
await loadDotEnv(".env");

const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Pull or add server-only Supabase env first.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function splitList(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && !["0", "nan", "null", "-"].includes(item.toLowerCase()));
}

function stableKey(row) {
  const raw = [row.name, row.province, row.district].map((part) => String(part || "").trim()).join("|");
  return crypto.createHash("sha1").update(raw).digest("hex");
}

function slugLike(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
}

async function upsertChunks(table, rows, options = {}) {
  const chunkSize = options.chunkSize || 200;
  const returning = options.returning || "";
  const results = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    let query = supabase.from(table).upsert(chunk, options.upsert || {});
    if (returning) query = query.select(returning);
    const { data, error } = await query;
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    if (data) results.push(...data);
  }
  return results;
}

async function seedCms() {
  let content;
  try {
    content = await readJson("public/admin/content/live.json");
  } catch {
    content = await readJson("public/admin/content/default.json");
  }
  const now = new Date().toISOString();
  await upsertChunks(
    "cms_documents",
    [
      {
        id: "live",
        content,
        schema_version: content.schemaVersion || 1,
        status: "published",
        published_by: content.publishedBy || "seed",
        published_at: content.publishedAt || now,
        updated_at: now,
      },
    ],
    { upsert: { onConflict: "id" } },
  );
}

async function seedTemples() {
  const collections = [
    ["popular", "สายไหว้พระ 9 วัด", "src/data/popular-temples.json"],
    ["mu", "สายมู", "src/data/mu-temples.json"],
    ["sacred", "วัดศักดิ์สิทธิ์", "src/data/sacred-temples.json"],
  ];

  await upsertChunks(
    "temple_collections",
    collections.map(([key, label], index) => ({
      key,
      label_th: label,
      sort_order: (index + 1) * 10,
      is_active: true,
    })),
    { upsert: { onConflict: "key" } },
  );

  const byKey = new Map();
  const entries = [];
  const sourceRows = new Map();
  const sourceMentions = [];

  for (const [collectionKey, , file] of collections) {
    const rows = await readJson(file);
    rows.forEach((row) => {
      const key = stableKey(row);
      byKey.set(key, {
        canonical_key: key,
        name_th: row.name,
        slug: `${slugLike(row.name)}-${slugLike(row.province)}`,
        place_type: row.placeType || null,
        region: row.region || null,
        province: row.province || null,
        district: row.district || null,
        subdistrict: row.subdistrict || null,
        postal_code: row.postalCode || null,
        latitude: Number.isFinite(row.latitude) ? row.latitude : null,
        longitude: Number.isFinite(row.longitude) ? row.longitude : null,
        plus_code: row.plusCode || null,
        coordinate_status: row.coordinateStatus || null,
        coordinate_confidence: row.coordinateConfidence || null,
        coordinate_source: row.coordinateSource || null,
        coordinate_address: row.coordinateAddress || null,
        blessings: splitList(row.blessings),
        object_heroes: splitList(row.objectHero),
        object_hero_types: splitList(row.objectHeroType),
        category_membership: splitList(row.categoryMembership),
        travel_modes: splitList(row.travelModes),
        image_url: row.imageUrl || null,
        image_alt: row.imageAlt || null,
        image_source_label: row.imageSourceLabel || null,
        image_source_url: row.imageSourceUrl || null,
        image_match_score: Number.isFinite(row.imageMatchScore) ? row.imageMatchScore : null,
        admin_editable: row.adminEditable !== false,
        raw_data: row,
      });
      entries.push({ collectionKey, key, row });

      const keys = splitList(row.sourceKeys);
      const types = splitList(row.sourceTypes);
      keys.forEach((sourceKey, index) => {
        if (!sourceRows.has(sourceKey)) {
          sourceRows.set(sourceKey, {
            source_key: sourceKey,
            source_type: types[index] || types[0] || null,
            raw_data: { sourceKey, sourceTypes: types },
          });
        }
        sourceMentions.push({ sourceKey, collectionKey, key, row });
      });
    });
  }

  const places = await upsertChunks("temple_places", [...byKey.values()], {
    chunkSize: 100,
    returning: "id,canonical_key",
    upsert: { onConflict: "canonical_key" },
  });
  const placeIds = new Map(places.map((place) => [place.canonical_key, place.id]));

  await upsertChunks(
    "temple_collection_entries",
    entries.map(({ collectionKey, key, row }) => ({
      collection_key: collectionKey,
      place_id: placeIds.get(key),
      rank: Number.isFinite(row.rank) ? row.rank : null,
      category_rank: Number.isFinite(row.categoryRank) ? row.categoryRank : null,
      mentions: Number.isFinite(row.mentions) ? row.mentions : null,
      category_mentions: Number.isFinite(row.categoryMentions) ? row.categoryMentions : null,
      global_rank: Number.isFinite(row.globalRank) ? row.globalRank : null,
      global_mentions: Number.isFinite(row.globalMentions) ? row.globalMentions : null,
      global_source_count: Number.isFinite(row.globalSourceCount) ? row.globalSourceCount : null,
      route_names: splitList(row.routeNames),
      tour_companies: splitList(row.tourCompanies),
      source_keys: splitList(row.sourceKeys),
      source_types: splitList(row.sourceTypes),
      raw_data: row,
    })),
    { chunkSize: 100, upsert: { onConflict: "collection_key,place_id" } },
  );

  if (sourceRows.size) {
    await upsertChunks("temple_sources", [...sourceRows.values()], { upsert: { onConflict: "source_key" } });
    await upsertChunks(
      "temple_source_mentions",
      sourceMentions.map(({ sourceKey, collectionKey, key, row }) => ({
        source_key: sourceKey,
        place_id: placeIds.get(key),
        collection_key: collectionKey,
        mention_count: 1,
        raw_data: { rank: row.rank, name: row.name, province: row.province },
      })),
      { chunkSize: 100, upsert: { onConflict: "source_key,place_id,collection_key" } },
    );
  }
}

await seedCms();
await seedTemples();

console.log("Seeded Supabase CMS and temple datasets.");
