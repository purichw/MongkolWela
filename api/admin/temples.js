import { sendJson } from "./_shared.js";
import { requireAdmin } from "./_auth.js";
import popularTemples from "../../src/data/popular-temples.json" with { type: "json" };
import muTemples from "../../src/data/mu-temples.json" with { type: "json" };
import sacredTemples from "../../src/data/sacred-temples.json" with { type: "json" };
import visitInfoData from "../../src/data/temple-visit-info.json" with { type: "json" };
import { applyTempleCmsRecords, templeCollectionConfig } from "../../src/data/temple-cms.js";
import { createTempleSlug } from "../../src/data/temple-slugs.js";
import { readLiveContent } from "./_shared.js";

const DATASETS = {
  popular: popularTemples,
  mu: muTemples,
  sacred: sacredTemples,
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

export async function loadTempleCatalog() {
  const content = await readLiveContent();
  const collections = Object.entries(DATASETS).map(([collection, temples]) =>
    applyTempleCmsRecords(collection, temples, content).map((temple) => {
      const slug = temple.cmsSlug || createTempleSlug(temple);
      const detailUrl = `/temples/${collection}/${slug}/`;
      return {
        key: temple.cmsKey || `${collection}:${slug}`,
        collection,
        collectionLabel: templeCollectionConfig[collection]?.label || COLLECTION_LABELS[collection],
        slug,
        detailUrl,
        source: temple.cmsSource || "dataset",
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
          images: temple.cmsImages || {},
          plusCode: temple.plusCode || "",
          latitude: temple.latitude ?? "",
          longitude: temple.longitude ?? "",
          travelModes: temple.travelModes || "",
        },
        visitInfo: normalizeVisitInfo(temple, visitInfoData),
      };
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

  const session = await requireAdmin(req, res);
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
