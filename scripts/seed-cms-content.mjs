import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await loadDotEnv(".env.local");
await loadDotEnv(".env");

const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Pull or add server-only Supabase env first.");
  process.exit(1);
}

const content = await readJson("public/admin/content/live.json");
const now = new Date().toISOString();
const actor = process.env.MONGKOLWELA_CMS_SEED_ACTOR || "cms-seed";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const document = {
  id: "live",
  content,
  schema_version: content.schemaVersion || 1,
  status: "published",
  published_by: content.publishedBy || actor,
  published_at: content.publishedAt || now,
  updated_at: now,
};

const { error: upsertError } = await supabase.from("cms_documents").upsert(document, { onConflict: "id" });
if (upsertError) {
  console.error(`CMS document seed failed: ${upsertError.message}`);
  process.exit(1);
}

const { error: revisionError } = await supabase.from("cms_revisions").insert({
  document_id: "live",
  content,
  schema_version: content.schemaVersion || 1,
  actor,
  source: "seed-cms-content",
  commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
  published_at: content.publishedAt || now,
});
if (revisionError) {
  console.warn(`CMS revision insert warning: ${revisionError.message}`);
}

const { error: auditError } = await supabase.from("admin_audit_events").insert({
  actor,
  event_type: "cms.seed",
  metadata: {
    documentId: "live",
    schemaVersion: content.schemaVersion || 1,
    pages: content.pages?.length || 0,
    navTabs: content.navigation?.tabs?.length || 0,
  },
});
if (auditError) {
  console.warn(`CMS audit insert warning: ${auditError.message}`);
}

console.log(
  `Seeded CMS live content: ${content.pages?.length || 0} pages, ${
    content.navigation?.tabs?.length || 0
  } navigation tabs.`,
);

async function loadDotEnv(file) {
  try {
    const raw = await fs.readFile(path.join(rootDir, file), "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    });
  } catch {
    // Optional local env file.
  }
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(rootDir, relativePath), "utf8"));
}
