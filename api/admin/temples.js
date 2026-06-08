import fs from "node:fs/promises";
import path from "node:path";
import { requireAdmin, sendJson } from "./_shared.js";

const DATA_FILES = {
  popular: "popular-temples.json",
  mu: "mu-temples.json",
  sacred: "sacred-temples.json",
};

const COLLECTION_LABELS = {
  popular: "สายไหว้พระ 9 วัด",
  mu: "สายมู",
  sacred: "วัดศักดิ์สิทธิ์",
};

const COLLECTION_ORDER = {
  popular: 1,
  mu: 2,
  sacred: 3,
};

function createTempleSlug(temple) {
  const rank = String(temple.rank || "").padStart(3, "0");
  const text = `${rank}-${temple.name || "temple"}-${temple.province || "thailand"}`;
  return text
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function readJson(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function imageKey(temple) {
  return `${temple.name}|${temple.province}`;
}

function normalizeVisitInfo(temple, visitInfoData) {
  const fallbackNotice = visitInfoData.fallbackNotice || "กรุณาตรวจสอบกับสถานที่ดังกล่าว";
  const key = `${String(temple.name || "").trim()}|${String(temple.province || "").trim()}`;
  const entry = visitInfoData.entries?.[key] || {};
  return {
    key,
    status: entry.status || "needs-direct-check",
    notice: entry.notice || fallbackNotice,
    reviewedAt: entry.reviewedAt || "",
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    admission: entry.admission || null,
    hours: entry.hours || null,
    contact: entry.contact || null,
  };
}

function applyImageOverride(collection, temple, imageOverrides) {
  const collectionOverrides = imageOverrides[collection] || {};
  const key = imageKey(temple);
  const direct = collectionOverrides[key];
  if (direct) return { ...temple, ...direct };

  for (const [name, overrides] of Object.entries(imageOverrides)) {
    if (name.startsWith("_") || !overrides || typeof overrides !== "object") continue;
    if (overrides[key]) return { ...temple, ...overrides[key] };
  }
  return temple;
}

async function loadTempleCatalog() {
  const [imageOverrides, visitInfoData] = await Promise.all([
    readJson("src/data/temple-image-overrides.json").catch(() => ({})),
    readJson("src/data/temple-visit-info.json").catch(() => ({})),
  ]);

  const collections = await Promise.all(
    Object.entries(DATA_FILES).map(async ([collection, file]) => {
      const temples = await readJson(`src/data/${file}`);
      return temples.map((sourceTemple) => {
        const temple = applyImageOverride(collection, sourceTemple, imageOverrides);
        const slug = createTempleSlug(temple);
        const detailUrl = `/temples/${collection}/${slug}/`;
        return {
          key: `${collection}:${slug}`,
          collection,
          collectionLabel: COLLECTION_LABELS[collection],
          slug,
          detailUrl,
          temple: {
            rank: temple.rank,
            name: temple.name,
            region: temple.region,
            province: temple.province,
            district: temple.district || "",
            placeType: temple.placeType || "",
            blessings: temple.blessings || "",
            objectHero: temple.objectHero || "",
            imageUrl: temple.imageUrl || "",
            imageAlt: temple.imageAlt || "",
            imageSourceLabel: temple.imageSourceLabel || "",
            imageSourceUrl: temple.imageSourceUrl || "",
            plusCode: temple.plusCode || "",
            latitude: temple.latitude ?? "",
            longitude: temple.longitude ?? "",
            travelModes: temple.travelModes || "",
          },
          visitInfo: normalizeVisitInfo(temple, visitInfoData),
        };
      });
    }),
  );

  return collections.flat().sort((a, b) => {
    if (a.collection !== b.collection) {
      return (COLLECTION_ORDER[a.collection] || 99) - (COLLECTION_ORDER[b.collection] || 99);
    }
    return (Number(a.temple.rank) || 0) - (Number(b.temple.rank) || 0);
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  try {
    sendJson(res, 200, {
      ok: true,
      temples: await loadTempleCatalog(),
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Temple catalog unavailable" });
  }
}
