import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  hasWritableDatabase,
  readDatabaseAnalyticsSummary,
  readDatabaseContent,
  writeDatabaseContent,
} from "./_database.js";

export const DEFAULT_CONTENT_PATH = path.join(process.cwd(), "public/admin/content/default.json");
export const LOCAL_LIVE_CONTENT_PATH = path.join(process.cwd(), "public/admin/content/live.json");
export const LOCAL_ANALYTICS_PATH = path.join(process.cwd(), "public/admin/content/analytics.json");

export const COOKIE_NAME = "mw_admin_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export function sendJson(res, status, payload, headers = {}) {
  res.statusCode = status;
  Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
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
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "mongkolwela-dev-session";
}

export function isProductionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function signValue(value) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
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
  if (!payload || !signature || signature !== signValue(payload)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function requireAdmin(req, res) {
  const session = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
  if (!session) {
    sendJson(res, 401, { ok: false, error: "Admin session required" });
    return null;
  }
  return session;
}

export function cookieHeader(value, { clear = false } = {}) {
  const secure = isProductionRuntime() ? "; Secure" : "";
  const maxAge = clear ? "Max-Age=0" : `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  return `${COOKIE_NAME}=${encodeURIComponent(value || "")}; Path=/; ${maxAge}; HttpOnly; SameSite=Lax${secure}`;
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

function mergeOrderedById(contentItems = [], bundledItems = []) {
  const existingById = new Map(contentItems.filter((item) => item?.id).map((item) => [item.id, item]));
  const bundledIds = new Set(bundledItems.filter((item) => item?.id).map((item) => item.id));
  const usedIds = new Set();
  const merged = [];

  bundledItems.forEach((bundledItem) => {
    const existingItem = bundledItem?.id ? existingById.get(bundledItem.id) : null;
    if (!existingItem) {
      merged.push(bundledItem);
      return;
    }
    usedIds.add(existingItem.id);
    merged.push({
      ...existingItem,
      ...(Array.isArray(existingItem.items) || Array.isArray(bundledItem.items)
        ? { items: mergeOrderedById(existingItem.items || [], bundledItem.items || []) }
        : {}),
    });
  });

  contentItems.forEach((item) => {
    if (!item?.id || (!usedIds.has(item.id) && !bundledIds.has(item.id))) merged.push(item);
  });

  return merged;
}

export function mergeWithBundledContent(content, bundledContent) {
  if (!content || !bundledContent || content === bundledContent) return content;
  const bundledPages = Array.isArray(bundledContent.pages) ? bundledContent.pages : null;
  const bundledTabs = Array.isArray(bundledContent.navigation?.tabs) ? bundledContent.navigation.tabs : null;
  const bundledUtility = Array.isArray(bundledContent.navigation?.utility)
    ? bundledContent.navigation.utility
    : null;
  const contentNavigation = content.navigation || {};
  const bundledNavigation = bundledContent.navigation || {};

  return {
    ...content,
    pages: bundledPages || mergeOrderedById(content.pages || [], bundledContent.pages || []),
    navigation: {
      ...contentNavigation,
      ...bundledNavigation,
      tabs: bundledTabs || mergeOrderedById(contentNavigation.tabs || [], bundledNavigation.tabs || []),
      utility: bundledUtility || contentNavigation.utility || [],
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
  const rawUrl = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${config.path}`;
  const response = await fetch(`${rawUrl}?ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

export async function readLiveContent() {
  const bundled = await readBundledLiveContent();
  const sources = isProductionRuntime()
    ? [readDatabaseContent, readGithubContent, async () => bundled, readDefaultContent]
    : [async () => bundled, readDatabaseContent, readGithubContent, readDefaultContent];

  for (const readSource of sources) {
    try {
      const content = await readSource();
      if (content) return mergeWithBundledContent(content, bundled);
    } catch {
      // Try the next source.
    }
  }

  throw new Error("Content source unavailable");
}

export async function publishLiveContent(content, actor = "admin", { fast = isProductionRuntime() } = {}) {
  const publishResults = [];
  const failures = [];

  if (hasWritableDatabase()) {
    try {
      const databaseResult = await writeDatabaseContent(content, actor, { source: "admin" });
      publishResults.push(databaseResult);
      if (fast) {
        return {
          mode: databaseResult.mode,
          commitSha: "",
          contentSha: "",
          warnings: [],
          fast: true,
        };
      }
    } catch (error) {
      failures.push(error);
    }
  }

  try {
    publishResults.push(await publishGithubContent(content, actor));
  } catch (error) {
    failures.push(error);
  }

  if (publishResults.length) {
    return {
      mode: publishResults.map((result) => result.mode).filter(Boolean).join("+"),
      commitSha: publishResults.find((result) => result.commitSha)?.commitSha || "",
      contentSha: publishResults.find((result) => result.contentSha)?.contentSha || "",
      warnings: failures.map((error) => error.message).filter(Boolean),
      fast: false,
    };
  }

  throw failures[0] || new Error("No publish target configured");
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
