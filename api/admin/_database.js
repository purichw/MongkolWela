import { createClient } from "@supabase/supabase-js";

const LIVE_DOCUMENT_ID = "live";

function env(name) {
  return process.env[name] || "";
}

export function databaseConfig() {
  return {
    url: env("SUPABASE_URL") || env("PUBLIC_SUPABASE_URL"),
    anonKey: env("SUPABASE_ANON_KEY") || env("PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY"),
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

function supabaseClient({ service = false } = {}) {
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

  const { data, error } = await supabase
    .from("cms_documents")
    .select("content")
    .eq("id", LIVE_DOCUMENT_ID)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw new Error("Published content read failed", { cause: error });
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

  const { error: upsertError } = await supabase.from("cms_documents").upsert(document, { onConflict: "id" });
  if (upsertError) throw new Error(`Supabase content upsert failed: ${upsertError.message}`);

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

export async function readDatabaseAnalyticsSummary() {
  const supabase = supabaseClient({ service: true });
  if (!supabase) return null;

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
  const { data, error } = await supabase
    .from("analytics_events")
    .select("event_type,page_path,page_title,created_at")
    .gte("created_at", since)
    .limit(10000);

  if (error || !data) return null;

  const summary = { totals: { pageviews: 0, events: 0 }, paths: {}, events: {}, updatedAt: new Date().toISOString() };
  data.forEach((event) => {
    if (event.event_type === "pageview") {
      summary.totals.pageviews += 1;
      const key = event.page_path || "/";
      summary.paths[key] ||= { path: key, title: event.page_title || "", count: 0, lastSeenAt: event.created_at };
      summary.paths[key].count += 1;
      summary.paths[key].title = event.page_title || summary.paths[key].title;
      summary.paths[key].lastSeenAt = event.created_at;
    } else {
      summary.totals.events += 1;
      const key = event.event_type || "event";
      summary.events[key] ||= { type: key, count: 0, lastSeenAt: event.created_at };
      summary.events[key].count += 1;
      summary.events[key].lastSeenAt = event.created_at;
    }
  });

  return summary;
}
