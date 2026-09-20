import http from "node:http";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import session from "../../api/admin/session.js";
import content from "../../api/admin/content.js";
import temples from "../../api/admin/temples.js";
import activities from "../../api/admin/activities.js";
import publicActivities from "../../api/temple-activities.js";

export function createActivitiesPreview({ astroBase = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4324", extraHandlers = {} } = {}) {
  if (process.env.VERCEL || process.env.NODE_ENV === "production" || ["SUPABASE_URL", "PUBLIC_SUPABASE_URL", "MONGKOLWELA_GITHUB_TOKEN", "GITHUB_CONTENT_TOKEN"].some((key) => process.env[key])) throw new Error("Preview requires an isolated local environment");
  const handlers = { "/api/admin/session": session, "/api/admin/temples": temples, "/api/admin/activities": activities, "/api/temple-activities": publicActivities, ...extraHandlers };
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (handlers[pathname]) return handlers[pathname](req, res);
    if (pathname === "/api/admin/content" && req.method === "GET") return content(req, res);
    if (["/api/admin/analytics", "/api/admin/media"].includes(pathname) && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, analytics: { totals: { pageviews: 0, events: 0 }, paths: {} }, media: {} }));
      return;
    }
    if (pathname.startsWith("/api/")) { res.statusCode = 404; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ ok: false, error: "Not available in isolated activities preview" })); return; }
    try {
      const headers = Object.fromEntries(Object.entries(req.headers).filter(([key]) => !["host", "connection", "content-length"].includes(key)));
      const response = await fetch(`${astroBase}${req.url}`, { redirect: "manual", headers });
      res.statusCode = response.status;
      response.headers.forEach((value, key) => { if (!["content-encoding", "content-length", "transfer-encoding"].includes(key)) res.setHeader(key, value); });
      if (response.body) Readable.fromWeb(response.body).pipe(res);
      else res.end();
    } catch { res.statusCode = 502; res.end(`Start Astro at ${astroBase} first`); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.env.MONGKOLWELA_ACTIVITIES_DIR = path.join(process.cwd(), ".local/activities-preview");
  const server = createActivitiesPreview();
  server.listen(4327, "127.0.0.1", () => process.stdout.write("Isolated activities preview: http://127.0.0.1:4327 (local Admin password: admin)\n"));
}
