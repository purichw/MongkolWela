import { requestJson } from "../request.js";

export async function loadPlannerCatalog(url, options = {}) {
  const payload = await requestJson(url, options);
  if (!Array.isArray(payload?.items) || !payload.filters) throw new Error("ข้อมูลสถานที่ไม่สมบูรณ์ กรุณาลองใหม่");
  return payload;
}

export async function requestPlannerPlan(body, options = {}) {
  const payload = await requestJson("/api/temple-planner/plan", {
    ...options, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (payload?.ok !== true || !Array.isArray(payload.planIds) || !payload.details) throw new Error("ข้อมูลแผนไม่สมบูรณ์ กรุณาลองใหม่");
  return payload;
}

export function reconcileCatalog(state, catalog) {
  state.selectionMap?.remove();
  state.routeMap?.remove();
  state.selectionMap = null;
  state.selectionCluster = null;
  state.routeMap = null;
  state.routeLayer = null;
  state.selectionMarkers.clear();
  state.items = catalog.items;
  state.itemById = new Map(catalog.items.map((item) => [item.id, item]));
  state.revision = catalog.revision;
  state.selected = state.selected.filter((id) => state.itemById.has(id));
  state.plan = state.plan.map((item) => state.itemById.get(item.id)).filter(Boolean);
  state.planDetails = null;
  state.lastSuccessfulPayload = null;
}
