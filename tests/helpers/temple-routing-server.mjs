import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createAuthFixture } from "./supabase-auth-fixture.mjs";
import contentHandler from "../../api/admin/content.js";
import templesHandler from "../../api/admin/temples.js";
import sessionHandler from "../../api/admin/session.js";
import plannerHandler from "../../api/temple-planner/data.js";

const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const readBody = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };

// Test-only, loopback-only fixture. The actual publish handler and built SSR
// function share an in-memory database, never a project CMS file or live source.
export async function createTempleRoutingServer() {
  const state = { content: JSON.parse(await fs.readFile(new URL("../../public/admin/content/live.json", import.meta.url), "utf8")), outage: false, writes: 0 };
  const auth = createAuthFixture();
  const db = http.createServer(async (req, res) => {
    if (await auth.handle(req, res)) return;
    const url = new URL(req.url, "http://localhost");
    const send = (value, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
    if (url.pathname === "/rest/v1/cms_documents") {
      if (state.outage) return send({ error: "fixture outage" }, 503);
      if (req.method === "GET") return send({ content: state.content });
      if (req.method === "PATCH") {
        const next = await readBody(req);
        const expected = state.content.publishedAt ? `eq.${state.content.publishedAt}` : "is.null";
        if (url.searchParams.get("content->>publishedAt") !== expected) return send(null);
        state.content = next.content; state.writes++; return send({ id: next.id });
      }
    }
    if (["/rest/v1/cms_revisions", "/rest/v1/admin_audit_events"].includes(url.pathname)) return send({});
    send({}, 404);
  });
  const databaseUrl = await listen(db);
  const env = { SUPABASE_URL: databaseUrl, SUPABASE_ANON_KEY: "test-public-key", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", VERCEL_ENV: "production" };
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const configUrl = new URL("../../.vercel/output/functions/_render.func/.vc-config.json", import.meta.url);
  const config = JSON.parse(await fs.readFile(configUrl, "utf8"));
  const { default: renderer } = await import(new URL(config.handler, configUrl));
  const staticRoot = path.resolve(".vercel/output/static");
  const app = http.createServer(async (req, res) => {
    try {
      req.headers["x-forwarded-proto"] = "http";
      const url = new URL(req.url, `http://${req.headers.host}`);
      const api = { "/api/admin/content": contentHandler, "/api/admin/temples": templesHandler, "/api/admin/session": sessionHandler, "/api/temple-planner/data": plannerHandler, "/api/temple-search": plannerHandler }[url.pathname];
      if (api) return await api(req, res);
      if (url.pathname.startsWith("/api/")) {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ ok: true, media: {}, analytics: { totals: { pageviews: 0, events: 0 } }, events: [], enabled: false, products: [], funds: [] })); return;
      }
      if (url.pathname === "/sitemap.xml" || /^\/temples\/(popular|mu|sacred)\/[^/]+\/?$/.test(url.pathname)) {
        const response = await renderer.fetch(new Request(url, { headers: req.headers }));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") + (url.pathname.endsWith("/") ? "index.html" : "");
      const file = path.resolve(staticRoot, relative);
      if (!file.startsWith(staticRoot + path.sep)) { res.writeHead(403); res.end(); return; }
      const data = await fs.readFile(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(data);
    } catch (error) { res.writeHead(error.code === "ENOENT" ? 404 : 500); res.end(error.message); }
  });
  const url = await listen(app);
  return { url, state, async close() {
    await close(app); await close(db);
    for (const [key, value] of Object.entries(before)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } };
}
