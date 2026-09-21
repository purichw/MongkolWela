import {
  readLiveAnalytics,
  readAnalyticsStore,
  readJsonBody,
  sendJson,
  writeAnalyticsStore,
} from "./_shared.js";
import { requireAdmin } from "./_auth.js";
import { recordDatabaseAnalyticsEvent } from "./_database.js";

const ANALYTICS_BODY_LIMIT_BYTES = 16 * 1024;
const ANALYTICS_RATE_LIMIT = 60;
const ANALYTICS_RATE_WINDOW_MS = 60 * 1000;
const analyticsBuckets = new Map();
const ignoredUserAgentPattern =
  /(bot|crawler|spider|scrapy|curl|wget|python-requests|aiohttp|httpx|postmanruntime|insomnia|headlesschrome|phantomjs|selenium|playwright|puppeteer)/i;

function safeKey(value, fallback = "unknown") {
  return String(value || fallback)
    .slice(0, 160)
    .replace(/[<>]/g, "");
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const session = await requireAdmin(req, res);
      if (!session) return;
      const data = await readLiveAnalytics();
      sendJson(res, 200, { ok: true, analytics: data });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    if (shouldIgnoreAnalyticsRequest(req) || isAnalyticsRateLimited(req)) {
      sendJson(res, 200, { ok: true, ignored: true });
      return;
    }

    const body = await readJsonBody(req, { maxBytes: ANALYTICS_BODY_LIMIT_BYTES });
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
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message || "Analytics API failed" });
  }
}

function shouldIgnoreAnalyticsRequest(req) {
  const userAgent = String(req.headers["user-agent"] || "");
  if (ignoredUserAgentPattern.test(userAgent)) return true;

  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return true;

  const origin = String(req.headers.origin || "");
  return Boolean(origin && !isAllowedOrigin(req, origin));
}

function isAllowedOrigin(req, origin) {
  let normalizedOrigin = "";
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    normalizedOrigin = origin.replace(/\/+$/g, "");
  }

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const protocol = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const allowedOrigins = new Set(
    [`${protocol}://${host}`, process.env.MONGKOLWELA_SITE_URL]
      .filter(Boolean)
      .map((value) => String(value).replace(/\/+$/g, "")),
  );

  return allowedOrigins.has(normalizedOrigin);
}

function isAnalyticsRateLimited(req) {
  const key = getRequestIp(req);
  const now = Date.now();
  const bucket = analyticsBuckets.get(key);

  if (!bucket || now > bucket.expiresAt) {
    analyticsBuckets.set(key, { count: 1, expiresAt: now + ANALYTICS_RATE_WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > ANALYTICS_RATE_LIMIT;
}

function getRequestIp(req) {
  return String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}
