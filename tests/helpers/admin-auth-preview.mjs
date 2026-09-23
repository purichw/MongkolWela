import http from "node:http";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAuthFixture } from "./supabase-auth-fixture.mjs";
import session from "../../api/admin/session.js";
import content from "../../api/admin/content.js";
import temples from "../../api/admin/temples.js";
import media from "../../api/admin/media.js";
import analytics from "../../api/admin/analytics.js";
import activities from "../../api/admin/activities.js";

const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

export async function createAdminAuthPreview({ astroBase }) {
  const keys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === "production" || [...keys, "PUBLIC_SUPABASE_URL", "PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_KEY"].some(key => process.env[key])) {
    throw new Error("Auth preview requires a credential-free local process");
  }
  const auth = createAuthFixture();
  let published = { schemaVersion: 1, cmsContractVersion: 2, pages: [{ id: "home", label: "หน้าแรก", route: "/", blocks: [], sections: [], patches: [] }], navigation: { tabs: [], utility: [] }, components: { cards: [] }, temples: { records: {} } };
  const database = http.createServer(async (req, res) => {
    if (await auth.handle(req, res)) return;
    res.setHeader("Content-Type", "application/json");
    if (req.url.startsWith("/rest/v1/cms_documents")) {
      if (req.method === "GET") {
        res.end(JSON.stringify(new URL(req.url, "http://localhost").searchParams.get("id") === "eq.live" ? { content: published } : []));
      } else {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const expected = new URL(req.url, "http://localhost").searchParams.get("content->>publishedAt");
        if (req.method === "PATCH" && expected !== (published.publishedAt ? `eq.${published.publishedAt}` : "is.null")) {
          res.end("null"); return;
        }
        published = body.content;
        res.end(JSON.stringify({ id: body.id }));
      }
    } else { res.end("[]"); }
  });
  const databaseUrl = await listen(database);
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { SUPABASE_URL: databaseUrl, SUPABASE_ANON_KEY: "test-public-key", SUPABASE_SERVICE_ROLE_KEY: "test-service-key" });
  const handlers = { session, content, temples, media, analytics, activities };
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const handler = pathname.startsWith("/api/admin/") ? handlers[pathname.split("/").at(-1)] : null;
    if (handler) return handler(req, res);
    if (pathname.startsWith("/api/")) { res.statusCode = 404; res.end("{}"); return; }
    try {
      const headers = Object.fromEntries(Object.entries(req.headers).filter(([key]) => !["host", "connection", "content-length", "cookie", "authorization"].includes(key)));
      const response = await fetch(new URL(req.url, astroBase), { redirect: "manual", headers });
      res.statusCode = response.status;
      response.headers.forEach((value, key) => { if (!["content-encoding", "content-length", "transfer-encoding"].includes(key)) res.setHeader(key, value); });
      if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
    } catch { res.statusCode = 502; res.end("Start the isolated Astro server first"); }
  });
  const base = await listen(server);
  return { base, auth, close: async () => {
    await close(server); await close(database);
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const preview = await createAdminAuthPreview({ astroBase: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4344" });
  process.stdout.write(`Local Auth fixture: ${preview.base}/admin/ (admin@example.test / test-only-password)\n`);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await preview.close(); process.exit(0); });
}
