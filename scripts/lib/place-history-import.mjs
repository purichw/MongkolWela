import { templeDatasets } from "../../src/lib/temple-routing.js";
import { createLegacyTempleSlug } from "../../src/data/temple-slugs.js";

const identity = row => `${row.name}|${row.province}`.normalize("NFC");
const failure = message => { throw new Error(message); };

export function importPlaceHistories(current, histories, { reviewedAt } = {}) {
  const expected = new Set(Object.values(templeDatasets).flat().map(identity));
  const byKey = new Map();
  for (const entry of histories) {
    if (!expected.has(entry.key) || entry.key !== identity(entry) || byKey.has(entry.key)) failure(`Unexpected or duplicate history: ${entry.key}`);
    if (entry.status !== "ready" || !entry.description?.trim() || entry.description.length > 650) failure(`History not ready or too long: ${entry.key}`);
    if (/<\/?[a-z][^>]*>|เป็นหนึ่งในสถานที่|สำหรับเลือกเส้นทางไหว้พระ/.test(entry.description)) failure(`Invalid history prose: ${entry.key}`);
    if (!entry.sources?.length || entry.sources.some(source => {
      try { return !["http:", "https:"].includes(new URL(source.url).protocol) || !source.title; } catch { return true; }
    })) failure(`Missing valid evidence: ${entry.key}`);
    byKey.set(entry.key, entry);
  }
  const missing = [...expected].filter(key => !byKey.has(key));
  if (missing.length) failure(`Missing ${missing.length} histories: ${missing.slice(0, 5).join(", ")}`);
  const content = structuredClone(current);
  content.temples ||= {};
  content.temples.records ||= {};
  const changes = [];
  const conflicts = [];
  for (const [collection, rows] of Object.entries(templeDatasets)) for (const row of rows) {
    const key = `${collection}:${createLegacyTempleSlug(row)}`;
    const entry = byKey.get(identity(row));
    const old = content.temples.records[key] || content.temples.overrides?.[key];
    const description = entry.description.trim();
    if (Object.hasOwn(old?.fields || {}, "description") && old.fields.description !== description
      && old.fields.description !== old.historyResearch?.importedDescription) {
      conflicts.push(key);
      continue;
    }
    const research = {
      key: entry.canonicalKey || entry.key,
      reviewedAt,
      importedDescription: description,
      sources: entry.sources.map(({ url, title, provider }) => ({ url, title, ...(provider ? { provider } : {}) })),
      factNotes: entry.factNotes || [],
    };
    const next = {
      ...old,
      key,
      collection,
      source: old?.source || "dataset",
      fields: { ...old?.fields, description },
      historyResearch: research,
    };
    if (JSON.stringify(next) !== JSON.stringify(old)) changes.push(key);
    content.temples.records[key] = next;
  }
  if (conflicts.length) failure(`Preserved Admin descriptions; resolve ${conflicts.length} conflicts before import: ${conflicts.join(", ")}`);
  return { content, report: { places: byKey.size, memberships: Object.values(templeDatasets).flat().length, changed: changes.length, keys: changes } };
}
