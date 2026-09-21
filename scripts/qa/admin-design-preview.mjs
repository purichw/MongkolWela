import http from "node:http";
import session from "../../api/admin/session.js";
import content from "../../api/admin/content.js";
import temples from "../../api/admin/temples.js";
import analytics from "../../api/admin/analytics.js";
import media from "../../api/admin/media.js";
import activities from "../../api/admin/activities.js";

// Review the real read handlers without bypassing authentication or publishing.
const handlers = { session, content, temples, analytics, media, activities };
const port = Number(process.env.ADMIN_PREVIEW_PORT || 4357);
const upstream = Number(process.env.ADMIN_PREVIEW_UPSTREAM || 4356);
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  if (path.startsWith("/api/")) {
    const name = path.match(/^\/api\/admin\/([a-z]+)$/)?.[1];
    const handler = handlers[name];
    if (handler && (req.method === "GET" || name === "session")) {
      try { await handler(req, res); }
      catch { res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ ok: false, error: "ไม่สามารถโหลดข้อมูลได้" })); }
      return;
    }
    res.writeHead(405, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: false, error: "พรีวิวแบบอ่านอย่างเดียว ไม่บันทึกหรือเผยแพร่ข้อมูลจริง" }));
    return;
  }
  const proxy = http.request({ host: "127.0.0.1", port: upstream, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${upstream}` } }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  proxy.on("error", () => { res.writeHead(502); res.end("Start the local Astro server first."); });
  req.pipe(proxy);
});
server.listen(port, "127.0.0.1", () => console.log(`Read-only admin design preview: http://127.0.0.1:${port}/admin/`));
