// Lightweight client projection: never derive a persisted CMS key from a new URL.
export function publishedTempleUrl(content, key, fallback = "") {
  const route = content?.temples?.routes?.[key];
  if (route) return route;
  const record = content?.temples?.records?.[key] || content?.temples?.overrides?.[key];
  if (record && ["popular", "mu", "sacred"].includes(record.collection) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug || "")) {
    return `/temples/${record.collection}/${record.slug}/`;
  }
  return fallback;
}
