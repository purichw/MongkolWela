import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";

const DATASET_PATH = path.join(process.cwd(), "public/assets/data/temples-thailand.json");
const PREVIEW_ROW_COUNT = 20;
const SOURCE_LABEL = "ระบบทะเบียนวัด สำนักงานพระพุทธศาสนาแห่งชาติ";

const regionOrder = [
  "ภาคเหนือ",
  "ภาคกลาง",
  "ภาคตะวันออกเฉียงเหนือ",
  "ภาคตะวันออก",
  "ภาคตะวันตก",
  "ภาคใต้",
];

const regionProvinces: Record<string, string[]> = {
  "ภาคเหนือ": [
    "เชียงราย",
    "เชียงใหม่",
    "น่าน",
    "พะเยา",
    "แพร่",
    "แม่ฮ่องสอน",
    "ลำปาง",
    "ลำพูน",
    "อุตรดิตถ์",
  ],
  "ภาคกลาง": [
    "กรุงเทพมหานคร",
    "กำแพงเพชร",
    "ชัยนาท",
    "นครนายก",
    "นครปฐม",
    "นครสวรรค์",
    "นนทบุรี",
    "ปทุมธานี",
    "พระนครศรีอยุธยา",
    "พิจิตร",
    "พิษณุโลก",
    "เพชรบูรณ์",
    "ลพบุรี",
    "สมุทรปราการ",
    "สมุทรสงคราม",
    "สมุทรสาคร",
    "สระบุรี",
    "สิงห์บุรี",
    "สุโขทัย",
    "สุพรรณบุรี",
    "อ่างทอง",
    "อุทัยธานี",
  ],
  "ภาคตะวันออกเฉียงเหนือ": [
    "กาฬสินธุ์",
    "ขอนแก่น",
    "ชัยภูมิ",
    "นครพนม",
    "นครราชสีมา",
    "บึงกาฬ",
    "บุรีรัมย์",
    "มหาสารคาม",
    "มุกดาหาร",
    "ยโสธร",
    "ร้อยเอ็ด",
    "เลย",
    "ศรีสะเกษ",
    "สกลนคร",
    "สุรินทร์",
    "หนองคาย",
    "หนองบัวลำภู",
    "อำนาจเจริญ",
    "อุดรธานี",
    "อุบลราชธานี",
  ],
  "ภาคตะวันออก": [
    "จันทบุรี",
    "ฉะเชิงเทรา",
    "ชลบุรี",
    "ตราด",
    "ปราจีนบุรี",
    "ระยอง",
    "สระแก้ว",
  ],
  "ภาคตะวันตก": [
    "กาญจนบุรี",
    "ตาก",
    "ประจวบคีรีขันธ์",
    "เพชรบุรี",
    "ราชบุรี",
  ],
  "ภาคใต้": [
    "กระบี่",
    "ชุมพร",
    "ตรัง",
    "นครศรีธรรมราช",
    "นราธิวาส",
    "ปัตตานี",
    "พังงา",
    "พัทลุง",
    "ภูเก็ต",
    "ยะลา",
    "ระนอง",
    "สงขลา",
    "สตูล",
    "สุราษฎร์ธานี",
  ],
};

const provinceRegionMap = Object.fromEntries(
  Object.entries(regionProvinces).flatMap(([region, provinces]) => provinces.map((province) => [province, region])),
);

export const GET: APIRoute = async () => {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  const payload = buildIndex(dataset);

  return new Response(JSON.stringify(payload).replace(/</g, "\\u003c"), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};

function buildIndex(dataset: { meta?: Record<string, unknown>; rows?: string[][] }) {
  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  const areas = createAreaMap();
  const types = new Set<string>();
  const sects = new Set<string>();

  rows.forEach((row) => {
    addClean(types, row[3]);
    addClean(sects, row[4]);

    const province = clean(row[11]);
    const district = clean(row[10]);
    const subdistrict = clean(row[9]);
    const region = provinceRegionMap[province];
    if (!region || !province) return;

    const provinceMap = areas.get(region);
    if (!provinceMap) return;
    if (!provinceMap.has(province)) provinceMap.set(province, new Map());

    const districtMap = provinceMap.get(province);
    if (!district || !districtMap) return;
    if (!districtMap.has(district)) districtMap.set(district, new Set());
    if (subdistrict) districtMap.get(district)?.add(subdistrict);
  });

  return {
    meta: {
      ...(dataset.meta || {}),
      rowCount: Number(dataset.meta?.rowCount) || rows.length,
      sourceLabel: SOURCE_LABEL,
      indexVersion: 1,
      previewRowCount: Math.min(PREVIEW_ROW_COUNT, rows.length),
    },
    columns: dataset.meta?.columns || [],
    facets: {
      types: sortThai([...types]),
      sects: sortThai([...sects]),
      regions: regionOrder
        .map((region) => ({
          name: region,
          provinces: sortThai([...((areas.get(region) || new Map()).keys())]).map((province) => {
            const districtMap = areas.get(region)?.get(province) || new Map<string, Set<string>>();
            return {
              name: province,
              districts: sortThai([...districtMap.keys()]).map((district) => ({
                name: district,
                subdistricts: sortThai([...(districtMap.get(district) || new Set<string>())]),
              })),
            };
          }),
        }))
        .filter((region) => region.provinces.length > 0),
    },
    previewRows: rows.slice(0, PREVIEW_ROW_COUNT),
  };
}

function createAreaMap() {
  return new Map(regionOrder.map((region) => [region, new Map<string, Map<string, Set<string>>>()]));
}

function addClean(set: Set<string>, value: unknown) {
  const text = clean(value);
  if (text) set.add(text);
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function sortThai(values: string[]) {
  return values.filter(Boolean).sort((a, b) => a.localeCompare(b, "th"));
}
