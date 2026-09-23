export const searchCollectionKeys = ["popular", "sacred", "mu"];
export const searchCollectionLabels = { popular: "วัดดังน่าไป", sacred: "วัดเด่นขอพร", mu: "พิกัดสายมู" };

export function normalizeSearch(value) {
  return String(value || "").normalize("NFC").toLocaleLowerCase("th")
    .replace(/กรุงเทพฯ|กรุงเทพ\s+|กทม\.?/g, "กรุงเทพมหานคร ").trim();
}

export function searchTemples(catalog, params) {
  const q = String(params.get("q") || "").trim().slice(0, 120);
  const collection = searchCollectionKeys.includes(params.get("collection")) ? params.get("collection") : "";
  const province = String(params.get("province") || "").slice(0, 100);
  const purpose = String(params.get("purpose") || "").slice(0, 100);
  const words = normalizeSearch(q).split(/\s+/).filter(Boolean);
  const ranked = catalog.items.map(item => {
    const name = normalizeSearch(item.name);
    const haystack = normalizeSearch([item.name, item.province, item.district, ...item.blessings, ...item.objects].join(" "));
    const matches = (!collection || item.collections.includes(collection)) && (!province || item.province === province)
      && (!purpose || item.blessings.includes(purpose)) && words.every(word => haystack.includes(word));
    const score = words.length ? words.reduce((sum, word) => sum + (name === word ? 100 : name.startsWith(word) ? 30 : name.includes(word) ? 10 : 1), 0) : 0;
    return { item, matches, score };
  }).filter(row => row.matches).sort((a, b) => b.score - a.score || a.item.order - b.item.order || a.item.name.localeCompare(b.item.name, "th"));
  const limit = params.get("suggest") === "1" ? 5 : 24;
  const pages = Math.max(1, Math.ceil(ranked.length / limit));
  const page = Math.max(1, Math.min(pages, Math.floor(Number(params.get("page")) || 1)));
  return {
    q, collection, province, purpose, page, pages, total: ranked.length,
    items: ranked.slice((page - 1) * limit, page * limit).map(({ item }) => ({
      id: item.id, name: item.name, province: item.province, district: item.district,
      blessings: item.blessings, collections: item.collections, imageUrl: item.imageUrl,
      detailUrl: item.routes[collection] || item.detailUrl,
    })),
    filters: catalog.filters,
  };
}
