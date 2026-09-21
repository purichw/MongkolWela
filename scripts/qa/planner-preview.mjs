import http from "node:http";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { getTemplePlannerData } from "../../src/data/temple-planner.js";
import { createTemplePlannerPlan } from "../../src/lib/temple-planner-engine.js";

// Loopback-only, read-only fixture preview. No live database or CMS writes.
const content = JSON.parse(await fs.readFile(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const catalog = getTemplePlannerData(content);
catalog.revision = "local-" + createHash("sha256").update(JSON.stringify(catalog.items)).digest("hex").slice(0, 16);
const upstream = new URL(process.env.PLANNER_DEV_URL || "http://127.0.0.1:4326");
const port = Number(process.env.PLANNER_PREVIEW_PORT || 4330);
const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/admin/content") return json(res, 200, { ok: true, revision: "local-preview", content });
    if (req.method === "GET" && url.pathname === "/api/temple-planner/data") return json(res, 200, url.searchParams.get("revision") === catalog.revision ? { revision: catalog.revision, unchanged: true } : catalog);
    if (req.method === "POST" && url.pathname === "/api/temple-planner/plan") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 65536) return json(res, 413, { error: "Request too large" });
      }
      const request = JSON.parse(raw);
      if (request.revision !== catalog.revision) return json(res, 409, { code: "CATALOG_CHANGED", catalog });
      const result = createTemplePlannerPlan(catalog, request);
      return json(res, 200, { ...result, revision: catalog.revision, items: result.planIds.map(id => catalog.items.find(item => item.id === id)) });
    }
    if (req.method !== "GET" || url.pathname.startsWith("/api/")) return json(res, 405, { error: "This local preview supports Planner reads and calculations only" });
    const proxy = http.request(new URL(url.pathname + url.search, upstream), { headers: { ...req.headers, host: upstream.host } }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    proxy.on("error", () => json(res, 502, { error: "Start the Astro dev server first" }));
    proxy.end();
  } catch (error) { json(res, 400, { error: error.message || "Invalid preview request" }); }
}).listen(port, "127.0.0.1", () => console.log(`Planner local-CMS fixture preview: http://127.0.0.1:${port}/temples/planner/`));
