import fs from "node:fs";
import { applyTempleCmsRecords, templeCollectionConfig } from "../../src/data/temple-cms.js";
import { createTempleSlug } from "../../src/data/temple-slugs.js";

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
export function adminDesignFixture() {
  const content = read("../../public/admin/content/live.json");
  const visits = read("../../src/data/temple-visit-info.json");
  const temples = ["popular", "mu", "sacred"].flatMap(collection => applyTempleCmsRecords(collection, read(`../../src/data/${collection}-temples.json`), content).map(temple => {
    const slug = temple.cmsSlug || createTempleSlug(temple);
    return { key: temple.cmsKey || `${collection}:${slug}`, collection, collectionLabel: templeCollectionConfig[collection].label, slug, detailUrl: `/temples/${collection}/${slug}/`, source: temple.cmsSource || "dataset", temple: { ...temple, images: temple.cmsImages || {} }, visitInfo: visits.entries?.[`${temple.name}|${temple.province}`] || { status: "needs-direct-check" } };
  }));
  // Test-only authentication. The preview server must never import this fixture.
  return {
    "/api/admin/session": { ok: true, actor: "UI Test", email: "admin@example.test" },
    "/api/admin/content": { ok: true, content },
    "/api/admin/temples": { ok: true, temples },
    "/api/admin/analytics": { ok: true, analytics: { totals: { pageviews: 0, events: 0 }, paths: {}, events: {}, daily: [], referrers: [], updatedAt: null } },
    "/api/admin/media": { ok: true, media: { provider: "", cloudinary: { enabled: false }, imagekit: { enabled: false } } },
    "/api/admin/activities": { ok: true, events: [] },
  };
}
