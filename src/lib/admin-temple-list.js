export const templeListDefaults = { query: "", province: "", type: "", status: "all", sort: "rank", view: "grid", page: 1, pageSize: 20 };

export function normalizeTempleList(value = {}) {
  return {
    ...templeListDefaults,
    query: typeof value.query === "string" ? value.query : "",
    province: typeof value.province === "string" ? value.province : "",
    type: typeof value.type === "string" ? value.type : "",
    status: ["all", "published", "draft"].includes(value.status) ? value.status : "all",
    sort: ["rank", "name", "province"].includes(value.sort) ? value.sort : "rank",
    view: value.view === "list" ? "list" : "grid",
    page: Math.max(1, Math.floor(Number(value.page) || 1)),
    pageSize: [20, 40, 80].includes(Number(value.pageSize)) ? Number(value.pageSize) : 20,
  };
}

const stable = value => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const editable = record => ({
  // Collection order owns rank; migrating legacy ranks is not an editorial change.
  fields: Object.fromEntries(Object.entries(record?.fields || {}).filter(([key]) => key !== "rank")),
  images: record?.images || {}, visitInfo: record?.visitInfo || {},
  enabled: record?.enabled !== false, status: record?.status || "active",
});

export function templePublicationState(record, records, publishedRecords, publishedKeys) {
  if (!publishedKeys?.has(record.key)) return "draft";
  return stable(editable(records[record.key])) === stable(editable(publishedRecords[record.key])) ? "published" : "draft";
}

export function projectTempleList(catalog, collection, options, records = {}, publishedRecords = {}, publishedKeys = new Set()) {
  const settings = normalizeTempleList(options);
  const query = settings.query.trim().normalize("NFC").toLocaleLowerCase("th");
  const all = catalog.filter(record => record.collection === collection && records[record.key]?.status !== "deleted" && records[record.key]?.enabled !== false)
    .map(record => ({ ...record, temple: { ...record.temple, ...records[record.key]?.fields }, listStatus: templePublicationState(record, records, publishedRecords, publishedKeys), isPublished: publishedKeys.has(record.key) }));
  const counts = { all: all.length, published: all.filter(record => record.listStatus === "published").length, draft: all.filter(record => record.listStatus === "draft").length };
  const filtered = all.filter(record => {
    const temple = record.temple;
    return (!query || [temple.name, temple.province, temple.district, temple.summary, temple.description, temple.imageAlt].join(" ").normalize("NFC").toLocaleLowerCase("th").includes(query))
      && (!settings.province || temple.province === settings.province)
      && (!settings.type || temple.placeType === settings.type)
      && (settings.status === "all" || record.listStatus === settings.status);
  });
  filtered.sort((a, b) => settings.sort === "rank" ? (Number(a.temple.rank) || 0) - (Number(b.temple.rank) || 0)
    : String(a.temple[settings.sort] || "").localeCompare(String(b.temple[settings.sort] || ""), "th") || (Number(a.temple.rank) || 0) - (Number(b.temple.rank) || 0));
  const pages = Math.max(1, Math.ceil(filtered.length / settings.pageSize));
  const page = Math.min(settings.page, pages);
  const start = (page - 1) * settings.pageSize;
  const facet = key => [...new Set(all.map(record => record.temple[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  return { all, filtered, counts, pages, page, start, visible: filtered.slice(start, start + settings.pageSize), provinces: facet("province"), types: facet("placeType") };
}

export function templeListCsv(records) {
  const cell = value => {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [["ชื่อสถานที่", "จังหวัด", "อำเภอ / เขต", "ประเภท", "สถานะ", "หน้าเว็บไซต์"],
    ...records.map(record => [record.temple.name, record.temple.province, record.temple.district, record.temple.placeType, record.listStatus === "draft" ? "ฉบับร่าง" : "เผยแพร่", record.isPublished ? record.detailUrl : ""])]
    .map(row => row.map(cell).join(",")).join("\r\n");
}
