import { sendJson } from "./admin/_shared.js";
import { readActivities } from "./admin/_activities.js";
import { loadTempleCatalog } from "./admin/temples.js";
import { publicActivities } from "../src/lib/temple-activities.js";
import { contentRevision } from "../src/lib/content-revision.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "GET" });
  const url = new URL(req.url, "http://localhost");
  const templeId = url.searchParams.get("templeId");
  if (!templeId || templeId.length > 250) return sendJson(res, 400, { ok: false, error: "กรุณาระบุสถานที่" });
  try {
    const temples = await loadTempleCatalog();
    if (!temples.some((temple) => temple.key === templeId)) return sendJson(res, 404, { ok: false, error: "สถานที่นี้ไม่เปิดเผยแพร่" });
    const events = publicActivities(await readActivities({ templeId, publicOnly: true }), templeId);
    const revision = contentRevision(events);
    sendJson(res, 200, url.searchParams.get("revision") === revision ? { ok: true, revision, unchanged: true } : { ok: true, revision, events });
  } catch { sendJson(res, 503, { ok: false, error: "ไม่สามารถโหลดกิจกรรมได้ กรุณาลองใหม่" }); }
}
