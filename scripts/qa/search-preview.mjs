import http from "node:http";
import content from "../../api/admin/content.js";
import search from "../../api/temple-planner/data.js";

// Loopback-only preview of real GET handlers. No writes or authentication bypass.
const port = Number(process.env.SEARCH_PREVIEW_PORT || 4371);
const upstream = Number(process.env.SEARCH_DEV_PORT || 4363);
http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  if (path.startsWith("/api/")) {
    const handler = { "/api/admin/content": content, "/api/temple-search": search }[path];
    if (handler && req.method === "GET") return handler(req, res);
    res.writeHead(405); res.end("Read-only search preview"); return;
  }
  const proxy = http.request({ host: "127.0.0.1", port: upstream, path: req.url, headers: { ...req.headers, host: `127.0.0.1:${upstream}` } }, response => {
    res.writeHead(response.statusCode, response.headers); response.pipe(res);
  });
  proxy.on("error", () => { res.writeHead(502); res.end("Start Astro first"); });
  proxy.end();
}).listen(port, "127.0.0.1", () => console.log(`Read-only search preview: http://127.0.0.1:${port}/`));
