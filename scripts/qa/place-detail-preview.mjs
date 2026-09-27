import http from "node:http";
import fs from "node:fs/promises";

// Loopback-only visual fixture, isolated from CMS and commerce writes.
const content = JSON.parse(await fs.readFile(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const upstream = new URL(process.env.PLACE_DEV_URL || "http://127.0.0.1:4391");
const port = Number(process.env.PLACE_PREVIEW_PORT || 4392);
const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};
http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method !== "GET") return json(res, 405, { error: "Read-only temple detail preview" });
  if (url.pathname === "/api/admin/content") return json(res, 200, { ok: true, revision: "place-local-preview", content });
  if (url.pathname === "/api/temple-activities") return json(res, 200, { ok: true, revision: "empty-preview", events: [] });
  if (url.pathname === "/api/commerce") return json(res, 503, { ok: false, code: "COMMERCE_DISABLED" });
  if (url.pathname.startsWith("/api/")) return json(res, 405, { error: "Read-only temple detail preview" });
  const proxy = http.request(new URL(url.pathname + url.search, upstream), { headers: { ...req.headers, host: upstream.host } }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  proxy.on("error", () => json(res, 502, { error: "Start the Astro dev server first" }));
  proxy.end();
}).listen(port, "127.0.0.1", () => console.log(`Temple detail fixture: http://127.0.0.1:${port}/temples/popular/002-ว-ดอร-ณ-กร-งเทพมหานคร/`));
