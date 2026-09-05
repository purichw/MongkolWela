import { readPlannerCatalog } from "./_catalog.js";
import { createTemplePlannerPlan } from "../../src/lib/temple-planner-engine.js";

const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload).replace(/</g, "\\u003c"));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      sendJson(res, 400, { ok: false, error: "Invalid planner request" });
      return;
    }
    if ((body.selectedIds !== undefined && (!Array.isArray(body.selectedIds) || body.selectedIds.length > 9 || body.selectedIds.some((id) => typeof id !== "string"))) || (body.criteria != null && (typeof body.criteria !== "object" || Array.isArray(body.criteria)))) {
      sendJson(res, 400, { ok: false, error: "Invalid planner criteria" });
      return;
    }
    const catalog = await readPlannerCatalog();
    if (body.revision && body.revision !== catalog.revision) {
      sendJson(res, 409, { ok: false, code: "CATALOG_CHANGED", error: "ข้อมูลสถานที่มีการเปลี่ยนแปลง กรุณาตรวจสอบแล้วจัดแผนอีกครั้ง", catalog });
      return;
    }
    const ids = new Set(catalog.items.map((item) => item.id));
    if ((body.selectedIds || []).some((id) => !ids.has(id)) || (body.criteria?.start && !ids.has(body.criteria.start))) {
      sendJson(res, 422, { ok: false, error: "มีสถานที่ที่ไม่พร้อมใช้งาน กรุณาตรวจสอบรายการอีกครั้ง" });
      return;
    }
    const result = createTemplePlannerPlan(catalog, body);
    if (result.ok) {
      result.revision = catalog.revision;
      result.items = result.planIds.map((id) => catalog.items.find((item) => item.id === id));
    }
    sendJson(res, result.ok ? 200 : 422, result);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message || "Planner API failed" });
  }
}
