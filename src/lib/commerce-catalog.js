export const PRODUCT_CATEGORIES = [
  { id: "amulets", label: "พระเครื่อง", description: "พระเครื่องและวัตถุบูชา" },
  { id: "beads", label: "สายมูพกพา", description: "ไอเท็มศรัทธาในชีวิตประจำวัน" },
  { id: "talismans", label: "เครื่องราง", description: "เครื่องรางและวัตถุมงคล" },
  { id: "offerings", label: "ชุดร่วมบุญ", description: "ร่วมบุญกับวัดและสถานที่ศักดิ์สิทธิ์" },
  { id: "gifts", label: "ของฝากมงคล", description: "ของขวัญแทนความปรารถนาดี" },
];

export const productCategoryLabel = id => PRODUCT_CATEGORIES.find(category => category.id === id)?.label || "วัตถุมงคล";
export const catalogTemple = (catalog, row) => catalog.temples?.find(temple => temple.id === row.templeId);

export function filterCommerceRows(catalog, mode, { search = "", seller = "", category = "", province = "", kind = "", sort = "latest" } = {}) {
  const query = search.trim().toLocaleLowerCase("th");
  return (mode === "shop" ? catalog.products : catalog.campaigns).filter(row => {
    const temple = catalogTemple(catalog, row);
    const sellerName = catalog.organizations.find(org => org.id === row.orgId)?.name || "";
    return (!seller || row.orgId === seller) && (!category || row.category === category) &&
      (!province || temple?.province === province) && (!kind || row.kind === kind) &&
      `${row.title} ${sellerName} ${temple?.name || ""} ${temple?.province || ""} ${row.sku || ""}`.toLocaleLowerCase("th").includes(query);
  }).sort((a, b) => {
    if (sort === "price-asc") return a.priceSatang - b.priceSatang;
    if (sort === "price-desc") return b.priceSatang - a.priceSatang;
    if (sort === "event") return a.eventDate.localeCompare(b.eventDate);
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
}
