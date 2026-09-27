import { createClient } from "@supabase/supabase-js";
import { summarizeAnalyticsEvents } from "../../src/lib/admin-analytics.js";

const LIVE_DOCUMENT_ID = "live";

function env(name) {
  return process.env[name] || "";
}

export function databaseConfig() {
  return {
    url: env("SUPABASE_URL") || env("PUBLIC_SUPABASE_URL"),
    anonKey: env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY") || env("PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY"),
  };
}

export function hasReadableDatabase() {
  const config = databaseConfig();
  return Boolean(config.url && (config.anonKey || config.serviceRoleKey));
}

export function hasWritableDatabase() {
  const config = databaseConfig();
  return Boolean(config.url && config.serviceRoleKey);
}

export function supabaseClient({ service = false } = {}) {
  const config = databaseConfig();
  const key = service ? config.serviceRoleKey : config.anonKey || config.serviceRoleKey;
  if (!config.url || !key) return null;
  return createClient(config.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store", signal: options.signal || AbortSignal.timeout(10000) }),
    },
  });
}

export async function readDatabaseContent() {
  const supabase = supabaseClient();
  if (!supabase) return null;

  const { data, error, status } = await supabase
    .from("cms_documents")
    .select("content")
    .eq("id", LIVE_DOCUMENT_ID)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("Published CMS database request failed", { status, code: error.code || null });
    throw new Error("Published content read failed", { cause: error });
  }
  if (!data?.content) console.error("Published CMS document missing", { status, rowFound: Boolean(data) });
  return data?.content || null;
}

export async function writeDatabaseContent(content, actor = "admin", meta = {}) {
  const supabase = supabaseClient({ service: true });
  if (!supabase) return null;

  const now = new Date().toISOString();
  const document = {
    id: LIVE_DOCUMENT_ID,
    content,
    schema_version: content.schemaVersion || 1,
    status: "published",
    published_by: actor || "admin",
    published_at: content.publishedAt || now,
    updated_at: now,
  };

  if (Object.hasOwn(meta, "expectedPublishedAt")) {
    let update = supabase.from("cms_documents").update(document).eq("id", LIVE_DOCUMENT_ID);
    update = meta.expectedPublishedAt === null ? update.is("content->>publishedAt", null) : update.eq("content->>publishedAt", meta.expectedPublishedAt);
    const { data, error } = await update.select("id").maybeSingle();
    if (error) throw new Error(`Supabase content update failed: ${error.message}`);
    if (!data) throw Object.assign(new Error("เนื้อหาถูกแก้ไขโดยผู้ดูแลอื่น กรุณาโหลดเวอร์ชันล่าสุด"), { statusCode: 409 });
  } else {
    const { error: upsertError } = await supabase.from("cms_documents").upsert(document, { onConflict: "id" });
    if (upsertError) throw new Error(`Supabase content upsert failed: ${upsertError.message}`);
  }

  const { error: revisionError } = await supabase.from("cms_revisions").insert({
    document_id: LIVE_DOCUMENT_ID,
    content,
    schema_version: content.schemaVersion || 1,
    actor: actor || "admin",
    source: meta.source || "admin",
    commit_sha: meta.commitSha || null,
    published_at: content.publishedAt || now,
  });
  if (revisionError) throw new Error(`Supabase revision insert failed: ${revisionError.message}`);

  await supabase.from("admin_audit_events").insert({
    actor: actor || "admin",
    event_type: "cms.publish",
    metadata: {
      documentId: LIVE_DOCUMENT_ID,
      schemaVersion: content.schemaVersion || 1,
      source: meta.source || "admin",
      commitSha: meta.commitSha || "",
    },
  });

  return { mode: "supabase" };
}

export async function recordDatabaseAnalyticsEvent(event) {
  const supabase = supabaseClient({ service: true });
  if (!supabase) return null;

  const { error } = await supabase.from("analytics_events").insert({
    event_type: event.type || "pageview",
    page_path: event.path || "/",
    page_title: event.title || "",
    session_id: event.sessionId || null,
    metadata: event.metadata || {},
    user_agent: event.userAgent || null,
    referrer: event.referrer || null,
  });
  if (error) return null;
  return { mode: "supabase" };
}

export async function readDatabaseAnalyticsSummary(range = null) {
  const supabase = supabaseClient({ service: true });
  if (!supabase) return null;

  const since = range?.since || new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
  const now = range?.until || new Date().toISOString();
  const rows = [];
  // Page below PostgREST's row cap; otherwise a successful response can silently
  // truncate the report. A fixed upper bound prevents moving pages during reads.
  for (let offset = 0; offset <= 10000; offset += 500) {
    const { data, error } = await supabase.from("analytics_events")
      .select("event_type,page_path,page_title,created_at,referrer")
      .gte("created_at", since).lte("created_at", now)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, Math.min(offset + 499, 10000));
    if (error || !data) throw Object.assign(new Error("ยังไม่สามารถโหลดข้อมูลสถิติได้"), { statusCode: 503 });
    rows.push(...data);
    if (data.length < 500) break;
  }
  const summary = summarizeAnalyticsEvents(rows.slice(0, 10000), { since, now, limited: rows.length > 10000 });
  summary.updatedAt = new Date().toISOString();
  return summary;
}
