const dayKey = value => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

export function summarizeAnalyticsEvents(rows, { since, now, limited = false }) {
  const summary = { totals: { pageviews: 0, events: 0 }, paths: {}, events: {}, daily: [], referrers: [], updatedAt: now, coverage: { since, until: now, limited, limit: 10000 } };
  const daily = new Map();
  const referrers = new Map();
  const eventDaily = new Map();
  let lastRecordedAt = null;
  for (const event of rows) {
    if (/^\/admin(?:\/|$|\?)/.test(event.page_path || "")) continue;
    if (Number.isFinite(Date.parse(event.created_at)) && (!lastRecordedAt || event.created_at > lastRecordedAt)) lastRecordedAt = event.created_at;
    const pageview = event.event_type === "pageview";
    const key = pageview ? event.page_path || "/" : event.event_type || "event";
    const group = pageview ? summary.paths : summary.events;
    summary.totals[pageview ? "pageviews" : "events"] += 1;
    group[key] ||= { ...(pageview ? { path: key, title: event.page_title || "" } : { type: key }), count: 0, lastSeenAt: event.created_at };
    group[key].count += 1;
    if (event.created_at > group[key].lastSeenAt) group[key].lastSeenAt = event.created_at;
    if (!pageview) {
      if (Number.isFinite(Date.parse(event.created_at))) {
        const date = dayKey(event.created_at);
        eventDaily.set(date, (eventDaily.get(date) || 0) + 1);
      }
      continue;
    }
    if (Number.isFinite(Date.parse(event.created_at))) {
      const date = dayKey(event.created_at);
      daily.set(date, (daily.get(date) || 0) + 1);
    }
    let source = "ไม่มีข้อมูลแหล่งอ้างอิง";
    try { source = new URL(event.referrer).hostname || source; } catch { /* Missing referrer is not evidence of a direct visit. */ }
    referrers.set(source, (referrers.get(source) || 0) + 1);
  }
  summary.daily = [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  summary.eventDaily = [...eventDaily].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  summary.lastRecordedAt = lastRecordedAt;
  summary.referrers = [...referrers].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  return summary;
}
