import fs from "node:fs";
import path from "node:path";
import { createTempleRoutingServer } from "../../tests/helpers/temple-routing-server.mjs";

export const builtStaticDir = path.resolve("dist/client");

// Measure actual built server HTML alongside static assets, using isolated CMS
// data rather than emitting stale copies of dynamic pages into the public build.
export async function builtRouteContent(routes) {
  const pages = new Map();
  let server;
  try {
    for (const route of new Set(routes)) {
      const file = path.join(builtStaticDir, route, route.endsWith("/") ? "index.html" : "");
      if (fs.existsSync(file)) { pages.set(route, fs.readFileSync(file, "utf8")); continue; }
      server ||= await createTempleRoutingServer();
      const response = await fetch(new URL(route, server.url));
      if (!response.ok) throw new Error(`${route}: built route returned ${response.status}`);
      pages.set(route, await response.text());
    }
  } finally { await server?.close(); }
  return pages;
}
