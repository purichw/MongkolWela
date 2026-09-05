import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  hasWritableDatabase,
  hasReadableDatabase,
  readDatabaseAnalyticsSummary,
  readDatabaseContent,
  writeDatabaseContent,
} from "./_database.js";
import { readPublishedContent } from "../../src/lib/live-content.js";

export const DEFAULT_CONTENT_PATH = path.join(process.cwd(), "public/admin/content/default.json");
export const LOCAL_LIVE_CONTENT_PATH = path.join(process.cwd(), "public/admin/content/live.json");
export const LOCAL_ANALYTICS_PATH = path.join(process.cwd(), "public/admin/content/analytics.json");

export const COOKIE_NAME = "mw_admin_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
export const CMS_EDITABLE_CONTRACT_VERSION = 2;
const DEFAULT_JSON_BODY_LIMIT_BYTES = 1024 * 1024;

export function sendJson(res, status, payload, headers = {}) {
  res.statusCode = status;
  Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

export async function readJsonBody(req, { maxBytes = DEFAULT_JSON_BODY_LIMIT_BYTES } = {}) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

export function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) return acc;
      acc[decodeURIComponent(part.slice(0, index))] = decodeURIComponent(part.slice(index + 1));
      return acc;
    }, {});
}

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
  if (secret) return secret;
  return isProductionRuntime() ? "" : "mongkolwela-dev-session";
}

export function isProductionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function signValue(value) {
  const secret = sessionSecret();
  if (!secret) {
    const error = new Error("Admin session secret is not configured");
    error.statusCode = 503;
    throw error;
  }
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionCookie(actor = "admin") {
  const payload = Buffer.from(
    JSON.stringify({
      actor,
      exp: Date.now() + SESSION_TTL_MS,
    }),
  ).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

export function verifySessionCookie(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(signature, expectedSignature)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function requireAdmin(req, res) {
  if (isProductionRuntime() && !sessionSecret()) {
    sendJson(res, 503, { ok: false, error: "Admin session secret is not configured" });
    return null;
  }

  const session = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
  if (!session) {
    sendJson(res, 401, { ok: false, error: "Admin session required" });
    return null;
  }
  return session;
}

export function requireSameOrigin(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;

  const origin = String(req.headers.origin || "");
  if (!origin) return true;

  const requestHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!requestHost) return true;

  const requestProtocol = String(req.headers["x-forwarded-proto"] || (isProductionRuntime() ? "https" : "http"))
    .split(",")[0]
    .trim();
  const allowedOrigins = new Set(
    [
      `${requestProtocol}://${requestHost}`,
      process.env.MONGKOLWELA_SITE_URL,
      process.env.MONGKOLWELA_ADMIN_ORIGIN,
    ]
      .filter(Boolean)
      .map((value) => String(value).replace(/\/+$/g, "")),
  );

  let normalizedOrigin = "";
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    normalizedOrigin = origin.replace(/\/+$/g, "");
  }

  if (allowedOrigins.has(normalizedOrigin)) return true;

  sendJson(res, 403, { ok: false, error: "Same-origin request required" });
  return false;
}

export function cookieHeader(value, { clear = false } = {}) {
  const secure = isProductionRuntime() ? "; Secure" : "";
  const maxAge = clear ? "Max-Age=0" : `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  return `${COOKIE_NAME}=${encodeURIComponent(value || "")}; Path=/; ${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function safeEqual(value, expected) {
  const left = Buffer.from(String(value));
  const right = Buffer.from(String(expected));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function readDefaultContent() {
  return JSON.parse(await fs.readFile(DEFAULT_CONTENT_PATH, "utf8"));
}

async function readBundledLiveContent() {
  try {
    return JSON.parse(await fs.readFile(LOCAL_LIVE_CONTENT_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function normalizeCmsContent(content) {
  if (!content || typeof content !== "object") return null;
  if (!Array.isArray(content.pages)) return null;
  if (!Array.isArray(content.navigation?.tabs)) return null;
  if (!Array.isArray(content.navigation?.utility)) return null;
  const contractVersion = Number(content.cmsContractVersion || CMS_EDITABLE_CONTRACT_VERSION);
  return {
    ...content,
    schemaVersion: content.schemaVersion || 1,
    cmsContractVersion: Number.isFinite(contractVersion) ? contractVersion : CMS_EDITABLE_CONTRACT_VERSION,
    navigation: {
      ...content.navigation,
      tabs: content.navigation.tabs,
      utility: content.navigation.utility,
    },
  };
}

export function githubContentConfig() {
  return {
    owner: process.env.MONGKOLWELA_GITHUB_OWNER || "purichw",
    repo: process.env.MONGKOLWELA_GITHUB_REPO || "hora-astro",
    branch: process.env.MONGKOLWELA_GITHUB_BRANCH || "main",
    path: process.env.MONGKOLWELA_GITHUB_CONTENT_PATH || "public/admin/content/live.json",
    token: process.env.MONGKOLWELA_GITHUB_TOKEN || process.env.GITHUB_CONTENT_TOKEN || "",
  };
}

export async function readGithubContent() {
  const config = githubContentConfig();
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/vnd.github.raw+json", Authorization: `Bearer ${config.token}`, "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`Published content read failed (${response.status})`);
  return response.json();
}

export async function readLiveContent() {
  const read = hasReadableDatabase() ? readDatabaseContent
    : githubContentConfig().token ? readGithubContent
    : !process.env.VERCEL && !isProductionRuntime() ? readBundledLiveContent
    : async () => { throw new Error("Live source is not configured"); };
  return readPublishedContent({ read, normalize: normalizeCmsContent });
}

export async function publishLiveContent(content, actor = "admin") {
  if (hasWritableDatabase()) {
    const result = await writeDatabaseContent(content, actor, { source: "admin" });
    return { ...result, warnings: [], fast: true };
  }
  if (hasReadableDatabase()) {
    throw Object.assign(new Error("Live source is read-only"), { statusCode: 503 });
  }
  const result = await publishGithubContent(content, actor);
  return { ...result, warnings: [], fast: false };
}

export async function readLiveAnalytics() {
  const databaseSummary = await readDatabaseAnalyticsSummary();
  if (databaseSummary) return databaseSummary;

  return readAnalyticsStore();
}

export async function writeLocalLiveContent(content) {
  await fs.mkdir(path.dirname(LOCAL_LIVE_CONTENT_PATH), { recursive: true });
  await fs.writeFile(LOCAL_LIVE_CONTENT_PATH, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return { mode: "local-file" };
}

export async function publishGithubContent(content, actor = "admin") {
  const config = githubContentConfig();
  if (!config.token) {
    if (!isProductionRuntime()) return writeLocalLiveContent(content);
    const error = new Error("Missing MONGKOLWELA_GITHUB_TOKEN for production publishing");
    error.statusCode = 501;
    throw error;
  }

  const apiBase = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${config.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
  const existingResponse = await fetch(`${apiBase}?ref=${encodeURIComponent(config.branch)}`, { headers });
  let sha;
  if (existingResponse.ok) {
    const existing = await existingResponse.json();
    sha = existing.sha;
  } else if (existingResponse.status !== 404) {
    throw new Error(`GitHub read failed (${existingResponse.status})`);
  }

  const body = {
    message: `Publish admin content (${new Date(content.publishedAt).toISOString()})`,
    content: Buffer.from(`${JSON.stringify(content, null, 2)}\n`, "utf8").toString("base64"),
    branch: config.branch,
    committer: {
      name: "Mongkol Wela Admin",
      email: "admin@mongkolwela.local",
    },
    author: {
      name: actor || "Mongkol Wela Admin",
      email: "admin@mongkolwela.local",
    },
    ...(sha ? { sha } : {}),
  };
  const publishResponse = await fetch(apiBase, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await publishResponse.json().catch(() => ({}));
  if (!publishResponse.ok) {
    throw new Error(payload.message || `GitHub publish failed (${publishResponse.status})`);
  }
  return {
    mode: "github",
    commitSha: payload.commit?.sha,
    contentSha: payload.content?.sha,
  };
}

export async function readAnalyticsStore() {
  try {
    return JSON.parse(await fs.readFile(LOCAL_ANALYTICS_PATH, "utf8"));
  } catch {
    return { totals: { pageviews: 0, events: 0 }, paths: {}, events: {}, updatedAt: null };
  }
}

export async function writeAnalyticsStore(data) {
  await fs.mkdir(path.dirname(LOCAL_ANALYTICS_PATH), { recursive: true });
  await fs.writeFile(LOCAL_ANALYTICS_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
