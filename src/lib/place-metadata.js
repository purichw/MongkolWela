// Keep source statements separate: a tourism mention is not a legal category,
// and a label inferred from a name must never become a confirmed classification.
export function placeMetadata(sources = []) {
  const assertions = [];
  const reviewFlags = [];
  const add = (source, facet, value, field) => {
    if (value === undefined || value === null || ["", "-", "ไม่ระบุ"].includes(String(value).trim())) return;
    assertions.push({ facet, value: String(value).trim(), field, source: source.provider,
      sourceUrl: source.url, retrievedAt: source.retrievedAt || null, evidence: source.evidence || "structured" });
  };
  for (const source of sources) {
    const fields = source.fields || {};
    const mappings = source.provider === "curated" ? {
      placeType: "placeType", blessings: "blessing", collection: "curatedCollection",
    } : source.provider === "osm" ? {
      religion: "religion", tourism: "visitorCategory", historic: "heritageType",
      heritage: "heritageDesignation", "building:architecture": "architecture", "architectural_style": "architecture",
      wheelchair: "wheelchairAccess", access: "access", opening_hours: "openingHours", website: "website",
      "contact:website": "website", "contact:phone": "phone", phone: "phone", wikidata: "wikidata", wikipedia: "wikipedia",
      service_times: "serviceTimes", fee: "admission", charge: "admissionCharge", start_date: "establishedDate",
      "toilets:wheelchair": "wheelchairToilets", "diet:vegetarian": "vegetarianFood", operator: "operator",
    } : {
      "นิกาย": "sect", "ชนิด": "registrationStatus", "ประเภทวัด": "templeType",
      "ประเภทการขึ้นทะเบียน": "registrationStatus", "วันที่ตั้งวัด": "establishedDate",
      "ได้รับวิสุงคามสีมา": "ordinationBoundaryStatus", "วันที่ได้รับวิสุงคามสีมา": "ordinationBoundaryDate",
      "วัน - เวลาเปิด": "openingHours", "แนวปฏิบัติ": "practice", "ลักษณะสถานที่": "setting",
      "สถาปัตยกรรม": "architecture", "สิ่งสำคัญ": "landmark", "กิจกรรม": "activity",
      "โทรศัพท์": "phone", "เว็บไซต์": "website", "สายปฏิบัติ": "lineage",
    };
    if (source.provider === "osm" && fields.denomination) {
      const denominations = { thai_mahanikaya: ["sect", "มหานิกาย"], thai_thammayut: ["sect", "ธรรมยุติกนิกาย"],
        thai_thummayut: ["sect", "ธรรมยุติกนิกาย"], theravada: ["tradition", "เถรวาท"], "เถรวาท": ["tradition", "เถรวาท"],
        mahayana: ["tradition", "มหายาน"], thai_mahayanikaya: ["tradition", "มหายาน"], pure_land: ["tradition", "สุขาวดี"] };
      const known = denominations[fields.denomination];
      if (known) add(source, ...known, "denomination");
      else reviewFlags.push({ sourceUrl: source.url, field: "denomination", value: fields.denomination, reason: "unrecognized-denomination" });
    }
    for (const [field, facet] of Object.entries(mappings)) {
      const values = facet === "templeType" ? String(fields[field] || "").split(/[,;]/) : [fields[field]];
      for (const value of values) add(source, facet, value, field);
    }
    // Source categories mix legal status, practice and visitor use. Retain the
    // original values above while exposing separate facets for future search.
    const categoryFacets = {
      "วัดราษฎร์": "legalStatus", "พระอารามหลวง": "legalStatus",
      "วิปัสนากรรมฐาน": "practice", "วัดป่า": "practice",
      "วัดเพื่อการท่องเที่ยว": "visitorCategory", "วัดร้าง": "operatingStatus",
    };
    for (const value of String(fields["ประเภทวัด"] || "").split(/[,;]/).map(value => value.trim())) {
      if (categoryFacets[value]) add(source, categoryFacets[value], value, "ประเภทวัด");
    }
    for (const assertion of source.assertions || []) add(source, assertion.facet, assertion.value, assertion.field || "editorial");
  }
  return { schemaVersion: 1, assertions, sources, ...(reviewFlags.length ? { reviewFlags } : {}) };
}

export function mergePlaceMetadata(...values) {
  const sources = new Map(values.flatMap(value => value?.sources || []).map(source => [
    `${source.provider}|${source.id || source.url}|${JSON.stringify({ fields: source.fields, assertions: source.assertions })}`, source,
  ]));
  return placeMetadata([...sources.values()]);
}
