import fs from "node:fs";
import { templeCatalogFromContent } from "../../api/admin/temples.js";

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
export function adminDesignFixture() {
  const content = read("../../public/admin/content/live.json");
  const temples = templeCatalogFromContent(content);
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
