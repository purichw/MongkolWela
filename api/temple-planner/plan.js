import { getTemplePlannerData } from "../../src/data/temple-planner.js";
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
    const result = createTemplePlannerPlan(getTemplePlannerData(), body);
    sendJson(res, result.ok ? 200 : 422, result);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message || "Planner API failed" });
  }
}
