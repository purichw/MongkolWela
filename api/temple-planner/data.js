import { readPlannerCatalog } from "./_catalog.js";
import searchHandler from "./_search.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload).replace(/</g, "\\u003c"));
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  // Preserve the public search URL while sharing the existing read-only function.
  if (url.pathname === "/api/temple-search" || url.searchParams.get("view") === "search" || req.query?.view === "search") {
    return searchHandler(req, res);
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const catalog = await readPlannerCatalog();
    const revision = new URL(req.url, "http://localhost").searchParams.get("revision");
    sendJson(res, 200, revision === catalog.revision
      ? { revision: catalog.revision, unchanged: true }
      : catalog);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: "ไม่สามารถโหลดข้อมูลล่าสุดได้ กรุณาลองใหม่" });
  }
}
