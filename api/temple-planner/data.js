import { getTemplePlannerData } from "../../src/data/temple-planner.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload).replace(/</g, "\\u003c"));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    sendJson(res, 200, getTemplePlannerData());
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Planner data unavailable" });
  }
}
