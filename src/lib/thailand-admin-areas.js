import regionProvinces from "../data/thailand-regions.json" with { type: "json" };

// Address choices are independent of which temple records remain published.
export function buildThailandAdminAreas(rows) {
  const provinces = new Map(Object.values(regionProvinces).flat().map(name => [name, new Map()]));
  for (const row of rows) {
    const [subdistrict, district, province] = row.slice(9, 12).map(value => String(value || "").trim());
    const districts = provinces.get(province);
    if (!districts || !district) continue;
    if (!districts.has(district)) districts.set(district, new Set());
    if (subdistrict) districts.get(district).add(subdistrict);
  }
  const sort = values => [...values].sort((a, b) => a.localeCompare(b, "th"));
  return Object.entries(regionProvinces).map(([name, names]) => ({
    name,
    provinces: sort(names).map(province => ({
      name: province,
      districts: sort(provinces.get(province).keys()).map(district => ({
        name: district,
        subdistricts: sort(provinces.get(province).get(district)),
      })),
    })),
  }));
}
