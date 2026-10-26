import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, parseEnv } from "node:util";
import { importPlaceHistories } from "./lib/place-history-import.mjs";
import { contentRevision } from "../src/lib/content-revision.js";
import { validateContentLibrary } from "../src/data/content-catalog.js";
import { validateContentPatches } from "../src/lib/content-patches.js";
import { validateHomepageContent } from "../src/lib/homepage-content.js";
import { validateNavigation } from "../src/lib/site-navigation.js";
import { validateDirectoryRecords } from "../src/lib/directory-places.js";
import { placeHistoryImportSql } from "./lib/place-history-sql.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: {
  env: { type: "string" }, input: { type: "string", default: "docs/research/curated-place-histories.json" },
  publish: { type: "boolean", default: false }, "expected-revision": { type: "string" },
  sql: { type: "string" }, checksum: { type: "string" },
} });
const histories = JSON.parse(await fs.readFile(path.resolve(root, values.input), "utf8"));
if (values.sql) {
  const sql = placeHistoryImportSql(histories, values.checksum);
  const file = path.resolve(root, values.sql);
  if (!file.startsWith(root + path.sep)) throw new Error("SQL output must stay inside the project");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, sql, { flag: "wx", mode: 0o600 });
  console.log(`Prepared reviewed import SQL: ${file}. No database changes made.`);
  process.exit(0);
}
if (values.env) Object.assign(process.env, parseEnv(await fs.readFile(path.resolve(root, values.env), "utf8")));
const { readLiveContent, publishLiveContent } = await import("../api/admin/_shared.js");
const { hasWritableDatabase } = await import("../api/admin/_database.js");
if (!hasWritableDatabase()) throw new Error("A writable production Supabase configuration is required. No data was changed.");
const current = await readLiveContent();
const { publishedAt, updatedAt, ...fields } = current;
const revision = contentRevision(fields);
const reviewedAt = "2026-10-26";
const { content, report } = importPlaceHistories(current, histories, { reviewedAt });
validateContentLibrary(content.contentLibrary);
validateContentPatches(content);
validateHomepageContent(content);
validateNavigation(content.navigation);
validateDirectoryRecords(content);
console.log(JSON.stringify({ mode: values.publish ? "publish" : "dry-run", revision, ...report }, null, 2));
if (values.publish && report.changed) {
  if (values["expected-revision"] !== revision) throw new Error("Expected revision missing or stale. Run dry-run against current content first.");
  const dir = path.join(root, ".local", "place-history-publication", new Date().toISOString().replace(/[:.]/g, "-"));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "before.json"), JSON.stringify(current, null, 2), { flag: "wx", mode: 0o600 });
  content.publishedAt = content.updatedAt = new Date().toISOString();
  content.publishedBy = "curated-place-history-import";
  await publishLiveContent(content, content.publishedBy, { expectedPublishedAt: current.publishedAt ?? null, source: "curated-place-history-import" });
  const live = await readLiveContent();
  if (contentRevision(live) !== contentRevision(content)) throw new Error("Publication response requires investigation: live content does not match. Do not repeat the write.");
  await fs.writeFile(path.join(dir, "receipt.json"), JSON.stringify({ ...report, previousRevision: revision, publishedAt: live.publishedAt }, null, 2));
  console.log(`Verified publication and CMS revision. Backup: ${dir}`);
}
