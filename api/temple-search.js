import { readLiveContent, sendJson } from "./admin/_shared.js";
import { getTempleSearchCatalog } from "../src/data/temple-search.js";
import { searchTemples } from "../src/lib/temple-search.js";

export default async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "GET" });
  try {
    const content = await readLiveContent();
    const params = new URL(req.url, "http://localhost").searchParams;
    return sendJson(res, 200, searchTemples(getTempleSearchCatalog(content), params));
  } catch {
    return sendJson(res, 503, { ok: false, error: "โหลดผลค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง" });
  }
}
