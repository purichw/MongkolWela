import http from "node:http";
import fs from "node:fs/promises";

// Read-only, loopback fixture. It never contacts commerce or CMS write endpoints.
const content = JSON.parse(await fs.readFile(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const upstream = new URL(process.env.SHOP_DEV_URL || "http://127.0.0.1:4348");
const port = Number(process.env.SHOP_PREVIEW_PORT || 4354);
const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};
http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/api/admin/content") return json(res, 200, { ok: true, revision: "shop-local-preview", content });
  if (req.method === "GET" && url.pathname === "/api/commerce") return json(res, 503, { ok: false, code: "COMMERCE_DISABLED", error: "ระบบร้านค้าและร่วมบุญยังไม่เปิดบริการ" });
  if (req.method !== "GET" || url.pathname.startsWith("/api/")) return json(res, 405, { error: "Read-only Shop visual preview" });
  const proxy = http.request(new URL(url.pathname + url.search, upstream), { headers: { ...req.headers, host: upstream.host } }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  proxy.on("error", () => json(res, 502, { error: "Start the Astro dev server first" }));
  proxy.end();
}).listen(port, "127.0.0.1", () => console.log(`Shop closed-state fixture: http://127.0.0.1:${port}/shop/`));
