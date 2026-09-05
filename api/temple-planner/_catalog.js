import { createHash } from "node:crypto";
import { readLiveContent } from "../admin/_shared.js";
import { getTemplePlannerData } from "../../src/data/temple-planner.js";

export async function readPlannerCatalog() {
  const content = await readLiveContent();
  const catalog = getTemplePlannerData(content);
  const revision = createHash("sha256").update(JSON.stringify(catalog.items)).digest("hex").slice(0, 24);
  return { ...catalog, revision };
}
