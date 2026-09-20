import { requireAdmin, requireSameOrigin, readJsonBody, sendJson } from "./_shared.js";
import { readActivities, saveActivity } from "./_activities.js";
import { loadTempleCatalog } from "./temples.js";
import { validateActivity } from "../../src/lib/temple-activities.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "GET, POST" });
  if (!requireSameOrigin(req, res)) return;
  const session = requireAdmin(req, res);
  if (!session) return;
  try {
    if (req.method === "GET") return sendJson(res, 200, { ok: true, events: await readActivities() });
    const body = await readJsonBody(req, { maxBytes: 32000 });
    const temples = await loadTempleCatalog();
    const input = validateActivity(body.event, { templeIds: new Set(temples.map((temple) => temple.key)) });
    const event = await saveActivity(input, { id: body.id, expectedVersion: body.expectedVersion, actor: session.actor });
    sendJson(res, 200, { ok: true, event });
  } catch (error) { sendJson(res, error.statusCode || 503, { ok: false, error: error.message }); }
}
