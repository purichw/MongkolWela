import {
  readLiveAnalytics,
  readAnalyticsStore,
  readJsonBody,
  requireAdmin,
  sendJson,
  writeAnalyticsStore,
} from "./_shared.js";
import { recordDatabaseAnalyticsEvent } from "./_database.js";

function safeKey(value, fallback = "unknown") {
  return String(value || fallback)
    .slice(0, 160)
    .replace(/[<>]/g, "");
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const session = requireAdmin(req, res);
      if (!session) return;
      const data = await readLiveAnalytics();
      sendJson(res, 200, { ok: true, analytics: data });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const type = safeKey(body.type || "pageview");
    const pagePath = safeKey(body.path || "/");
    const title = safeKey(body.title || "");
    const data = await readAnalyticsStore();
    const now = new Date().toISOString();

    data.totals ||= { pageviews: 0, events: 0 };
    data.paths ||= {};
    data.events ||= {};
    data.updatedAt = now;

    if (type === "pageview") {
      data.totals.pageviews += 1;
      data.paths[pagePath] ||= { path: pagePath, title, count: 0, lastSeenAt: now };
      data.paths[pagePath].count += 1;
      data.paths[pagePath].title = title || data.paths[pagePath].title;
      data.paths[pagePath].lastSeenAt = now;
    } else {
      data.totals.events += 1;
      data.events[type] ||= { type, count: 0, lastSeenAt: now };
      data.events[type].count += 1;
      data.events[type].lastSeenAt = now;
    }

    try {
      await recordDatabaseAnalyticsEvent({
        type,
        path: pagePath,
        title,
        userAgent: req.headers["user-agent"] || "",
        referrer: req.headers.referer || req.headers.referrer || "",
      });
      await writeAnalyticsStore(data);
    } catch {
      // Serverless production filesystems are ephemeral/read-only in some modes.
      // The endpoint should still remain non-blocking for visitors.
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Analytics API failed" });
  }
}
