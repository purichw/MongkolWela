import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createActivitiesPreview } from "./activities-preview.mjs";
import commerce from "../../api/commerce.js";
import session from "../../api/commerce/session.js";
import { loadTempleCatalog } from "../../api/admin/temples.js";
import { commerceFixture } from "./commerce-fixtures.mjs";

export async function createCommercePreview({ directory, seed = false, astroBase } = {}) {
  if (!directory || process.env.VERCEL || process.env.NODE_ENV === "production" || ["SUPABASE_URL", "PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "MONGKOLWELA_GITHUB_TOKEN", "GITHUB_CONTENT_TOKEN"].some(key => process.env[key])) throw new Error("Commerce preview requires a credential-free local environment");
  process.env.MONGKOLWELA_COMMERCE_PREVIEW = "1";
  process.env.MONGKOLWELA_COMMERCE_DIR = directory;
  process.env.MONGKOLWELA_ACTIVITIES_DIR = directory;
  process.env.MONGKOLWELA_PREVIEW_PASSWORD = "preview-only-password";
  if (seed) {
    const temples = await loadTempleCatalog();
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "commerce.json"), JSON.stringify(commerceFixture(temples[0].key).state), { flag: "wx", mode: 0o600 });
  }
  return createActivitiesPreview({ astroBase, extraHandlers: { "/api/commerce": commerce, "/api/commerce/": commerce, "/api/commerce/session": session } });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.join(process.cwd(), ".local/commerce-preview");
  let seed = false;
  try { await fs.access(path.join(directory, "commerce.json")); } catch { seed = true; }
  const server = await createCommercePreview({ directory, seed });
  server.listen(4330, "127.0.0.1", () => process.stdout.write("Commerce preview http://127.0.0.1:4330 · seller@example.test / preview-only-password · platform Admin password: admin\n"));
}
