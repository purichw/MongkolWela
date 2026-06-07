import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

const repoRoot = new URL("../", import.meta.url);
const dataDir = new URL("src/data/", repoRoot);
const outputDir = new URL("outputs/9-temples-research/", repoRoot);
const globalRankingWorkbook = new URL("temple-global-ranking-dataset.xlsx", outputDir);

const INPUTS = {
  popular: {
    workbook: new URL("make-merit-9-temples-dataset.xlsx", outputDir),
    output: new URL("popular-temples.json", dataDir),
    previous: new URL("popular-temples.json", dataDir),
  },
  mu: {
    workbook: new URL("mu-temples-dataset.xlsx", outputDir),
    output: new URL("mu-temples.json", dataDir),
    previous: new URL("mu-temples.json", dataDir),
  },
  sacred: {
    workbook: new URL("sacred-temples-dataset.xlsx", outputDir),
    output: new URL("sacred-temples.json", dataDir),
    previous: new URL("sacred-temples.json", dataDir),
  },
};

const args = new Set(process.argv.slice(2));
const shouldWrite = !args.has("--dry-run");
const shouldGeocode = args.has("--geocode");
const shouldFetchImages = args.has("--images");

const PLACEHOLDER_IMAGE = "/assets/images/temple-placeholder-auspicious.png";
const GENERATED_AT = new Date().toISOString().slice(0, 10);
const IMAGE_OVERRIDES = await readJson(new URL("temple-image-overrides.json", dataDir), {});
const IMAGE_OVERRIDES_BY_KEY = buildImageOverrideMap(IMAGE_OVERRIDES);
const globalRankingByKey = readGlobalRankingMap(globalRankingWorkbook);

const REGION_MAP = new Map([
  ["กรุงเทพฯ", "ภาคกลาง"],
  ["ภาคอีสาน", "ภาคตะวันออกเฉียงเหนือ"],
]);

const IMAGE_HINTS = new Map([
  [
    "วัดโสธรวราราม|ฉะเชิงเทรา",
    {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Wat_Sothon_Wararam_Worawihan.jpg/960px-Wat_Sothon_Wararam_Worawihan.jpg",
      imageSourceLabel: "Wikimedia Commons",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Wat_Sothon_Wararam_Worawihan.jpg",
      imageMatchScore: 98,
    },
  ],
  [
    "วัดร่องขุ่น|เชียงราย",
    {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Wat_Rong_Khun_-_panoramio.jpg/960px-Wat_Rong_Khun_-_panoramio.jpg",
      imageSourceLabel: "Wikimedia Commons",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Wat_Rong_Khun_-_panoramio.jpg",
      imageMatchScore: 98,
    },
  ],
  [
    "วัดพระธาตุผาซ่อนแก้ว|เพชรบูรณ์",
    {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Wat_Pha_Sorn_Kaew.jpg/960px-Wat_Pha_Sorn_Kaew.jpg",
      imageSourceLabel: "Wikimedia Commons",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Wat_Pha_Sorn_Kaew.jpg",
      imageMatchScore: 96,
    },
  ],
  [
    "วัดศรีชุม|สุโขทัย",
    {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Wat_Si_Chum_01.jpg/960px-Wat_Si_Chum_01.jpg",
      imageSourceLabel: "Wikimedia Commons",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Wat_Si_Chum_01.jpg",
      imageMatchScore: 98,
    },
  ],
  [
    "วัดป่าภูก้อน|อุดรธานี",
    {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Wat_Pa_Phu_Kon_Udon_Thani.jpg/960px-Wat_Pa_Phu_Kon_Udon_Thani.jpg",
      imageSourceLabel: "Wikimedia Commons",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Wat_Pa_Phu_Kon_Udon_Thani.jpg",
      imageMatchScore: 98,
    },
  ],
  [
    "วัดเบญจมบพิตรดุสิตวนาราม|กรุงเทพมหานคร",
    {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Wat_Benchamabophit_Dusitvanaram_Bangkok_2019_02.jpg/960px-Wat_Benchamabophit_Dusitvanaram_Bangkok_2019_02.jpg",
      imageSourceLabel: "Wikimedia Commons",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Wat_Benchamabophit_Dusitvanaram_Bangkok_2019_02.jpg",
      imageMatchScore: 98,
    },
  ],
  [
    "วัดไตรมิตรวิทยาราม|กรุงเทพมหานคร",
    {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Wat_Traimit_2023.jpg/960px-Wat_Traimit_2023.jpg",
      imageSourceLabel: "Wikimedia Commons",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Wat_Traimit_2023.jpg",
      imageMatchScore: 96,
    },
  ],
  [
    "วัดร่องเสือเต้น|เชียงราย",
    {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Wat_Rong_Suea_Ten_Chiang_Rai.jpg/960px-Wat_Rong_Suea_Ten_Chiang_Rai.jpg",
      imageSourceLabel: "Wikimedia Commons",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Wat_Rong_Suea_Ten_Chiang_Rai.jpg",
      imageMatchScore: 96,
    },
  ],
  [
    "อุทยานธรรมเขานาในหลวง|สุราษฎร์ธานี",
    {
      imageUrl: "https://www.gplace.com/include/img_gal/5/95/gp5e328bc3519d3.jpg",
      imageSourceLabel: "Gplace place page",
      imageSourceUrl: "https://www.gplace.com/953515",
      imageMatchScore: 100,
    },
  ],
]);

const COORDINATE_HINTS = new Map([
  ["วัดร่องขุ่น|เชียงราย", [19.824169, 99.763084]],
  ["วัดพระธาตุผาซ่อนแก้ว|เพชรบูรณ์", [16.78908, 101.05048]],
  ["วัดศรีชุม|สุโขทัย", [17.024579, 99.694985]],
  ["วัดโสธรวราราม|ฉะเชิงเทรา", [13.67372, 101.071389]],
  ["วัดเบญจมบพิตรดุสิตวนาราม|กรุงเทพมหานคร", [13.766465, 100.514748]],
  ["วัดไตรมิตรวิทยาราม|กรุงเทพมหานคร", [13.737807, 100.51389]],
  ["วัดร่องเสือเต้น|เชียงราย", [19.922729, 99.840576]],
  ["วัดอุดมมงคล|ฉะเชิงเทรา", [13.7496802, 101.040931392]],
  ["ศาลท้าวอัมรินทราธิราช อัมรินทร์พลาซ่า|กรุงเทพมหานคร", [13.744154323, 100.541827824]],
  ["ศาลพระนารายณ์ทรงสุบรรณ ราชประสงค์|กรุงเทพมหานคร", [13.744676168, 100.541478875]],
  ["ศาลพระแม่อุมาเทวี ราชประสงค์|กรุงเทพมหานคร", [13.74655, 100.5411]],
  ["อุทยานธรรมเขานาในหลวง|สุราษฎร์ธานี", [8.778146, 98.955121]],
  ["พระแม่ลักษมี ข้างเซ็นทรัลลาดพร้าว|กรุงเทพมหานคร", [13.8168385, 100.5613613]],
  ["ถ้ำนาคา|บึงกาฬ", [17.95212, 104.10445]],
]);

const previousPopular = await readJson(INPUTS.popular.previous, []);
const previousMu = await readJson(INPUTS.mu.previous, []);
const previousSacred = await readJson(INPUTS.sacred.previous, []);
const enrichmentRows = [...previousPopular, ...previousMu, ...previousSacred];
const enrichmentByKey = buildEnrichmentMap(enrichmentRows);

const results = {};

for (const [collection, config] of Object.entries(INPUTS)) {
  const masterRows = readWorkbookSheet(config.workbook, "Temple_Master");
  let runtimeRows = masterRows.map((row) => buildRuntimeRow(collection, row, enrichmentByKey));
  runtimeRows = await enrichMissingRuntimeRows(runtimeRows);
  runtimeRows = runtimeRows
    .sort((a, b) =>
      (Number(a.rank) || 999999) - (Number(b.rank) || 999999) ||
      Number(b.categoryMentions || 0) - Number(a.categoryMentions || 0) ||
      a.province.localeCompare(b.province, "th") ||
      a.name.localeCompare(b.name, "th")
    )
    .map((row, index) => ({ ...row, categoryRank: index + 1 }));
  results[collection] = summarizeRuntimeRows(runtimeRows);

  if (shouldWrite) {
    await fs.writeFile(config.output, `${JSON.stringify(runtimeRows, null, 2)}\n`);
  }
}

console.log(JSON.stringify(results, null, 2));

function readWorkbookSheet(workbookUrl, sheetName) {
  const workbookPath = filePath(workbookUrl);
  const workbookXml = unzipText(workbookPath, "xl/workbook.xml");
  const relsXml = unzipText(workbookPath, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(safeUnzipText(workbookPath, "xl/sharedStrings.xml"));
  const sheetPath = getSheetPath(workbookXml, relsXml, sheetName);
  const sheetXml = unzipText(workbookPath, sheetPath);
  const rows = parseSheetRows(sheetXml, sharedStrings);
  const [headers, ...dataRows] = rows;

  return dataRows
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [String(header || "").trim(), row[index] ?? ""])));
}

function readGlobalRankingMap(workbookUrl) {
  try {
    return new Map(
      readWorkbookSheet(workbookUrl, "Global_Ranking")
        .map((row) => [
          cleanText(row.templeMasterKey),
          {
            globalRank: Number(row.globalRank) || 0,
            totalMentions: Number(row.totalMentions) || 0,
            popularMentions: Number(row.popularMentions) || 0,
            muMentions: Number(row.muMentions) || 0,
            sacredMentions: Number(row.sacredMentions) || 0,
            uniqueSourceCount: Number(row.uniqueSourceCount) || 0,
            categoryMembership: cleanText(row.categoryMembership),
          },
        ])
        .filter(([key]) => key),
    );
  } catch (error) {
    console.warn(`Global ranking workbook unavailable; falling back to category ranks. ${error.message}`);
    return new Map();
  }
}

function buildRuntimeRow(collection, row, enrichmentByKey) {
  const name = cleanText(row.templeName);
  const province = cleanText(row.province);
  const key = `${name}|${province}`;
  const enrichment = enrichmentByKey.get(key) || {};
  const globalRanking = globalRankingByKey.get(key) || {};
  const imageHint = IMAGE_HINTS.get(key);
  const imageOverride = IMAGE_OVERRIDES?.[collection]?.[key] || IMAGE_OVERRIDES_BY_KEY.get(key);
  const coordinateHint = COORDINATE_HINTS.get(key);
  const imageFields = imageOverride || imageHint || pickImageFields(enrichment);
  const coordinateFields = pickCoordinateFields(enrichment);
  const generatedTravelModes = normalizeList(row.travelModes, /[;+]/u);
  const travelModes = mergeLists(generatedTravelModes, normalizeList(enrichment.travelModes, /[;+]/u)).join("; ");
  const hasCoordinates = Number.isFinite(Number(coordinateFields.latitude)) && Number.isFinite(Number(coordinateFields.longitude));

  return stripEmpty({
    rank: Number(globalRanking.globalRank) || Number(row.no) || 0,
    globalRank: Number(globalRanking.globalRank) || undefined,
    name,
    region: normalizeRegion(row.region),
    province,
    district: normalizeDistrict(row.districtArea),
    mentions: Number(globalRanking.totalMentions) || Number(row.occurrenceCount) || 0,
    globalMentions: Number(globalRanking.totalMentions) || undefined,
    categoryMentions: Number(row.occurrenceCount) || 0,
    popularMentions: Number(globalRanking.popularMentions) || undefined,
    muMentions: Number(globalRanking.muMentions) || undefined,
    sacredMentions: Number(globalRanking.sacredMentions) || undefined,
    globalSourceCount: Number(globalRanking.uniqueSourceCount) || undefined,
    categoryMembership: globalRanking.categoryMembership || undefined,
    placeType: cleanText(row.placeType) || enrichment.placeType || undefined,
    blessings: normalizeList(row.blessingCategories, /;/u).join("; "),
    objectHero: normalizeList(row.objectHero, /[;/]/u).join("; "),
    objectHeroType: normalizeList(row.objectHeroType, /;/u).join("; "),
    routeNames: normalizeList(row.routeNames, /;/u).join("; "),
    tourCompanies: normalizeList(row.tourCompanies, /;/u).join("; "),
    sourceKeys: normalizeList(row.sourceKeys, /;/u).join("; "),
    sourceTypes: normalizeList(row.sourceTypes, /;/u).join("; "),
    travelModes,
    imageUrl: imageFields.imageUrl || PLACEHOLDER_IMAGE,
    imageAlt: imageFields.imageAlt || `${name} ${province}`,
    imageSourceLabel: imageFields.imageSourceLabel || "Placeholder",
    imageSourceUrl: imageFields.imageSourceUrl || PLACEHOLDER_IMAGE,
    imageSearchQuery: imageFields.imageSearchQuery || "",
    imageMatchScore: Number(imageFields.imageMatchScore) || 0,
    adminEditable: true,
    latitude: hasCoordinates ? Number(coordinateFields.latitude) : coordinateHint?.[0],
    longitude: hasCoordinates ? Number(coordinateFields.longitude) : coordinateHint?.[1],
    coordinateStatus: hasCoordinates ? coordinateFields.coordinateStatus : coordinateHint ? "verified" : "missing",
    coordinateConfidence: hasCoordinates ? coordinateFields.coordinateConfidence : coordinateHint ? "manual_hint" : "missing",
    coordinateSource: hasCoordinates ? coordinateFields.coordinateSource : coordinateHint ? "Manual verified hint" : "",
    coordinateAddress: hasCoordinates ? coordinateFields.coordinateAddress : "",
    coordinateQuery: hasCoordinates ? coordinateFields.coordinateQuery : `${name} ${normalizeDistrict(row.districtArea)} ${province} ประเทศไทย`,
    plusCode: enrichment.plusCode || "",
    travelDetail: enrichment.travelDetail || fallbackTravelDetail(travelModes, collection),
  });
}

async function enrichMissingRuntimeRows(rows) {
  for (const row of rows) {
    if (shouldFetchImages && row.imageAuditStatus !== "placeholder_required" && (!row.imageUrl || row.imageUrl === PLACEHOLDER_IMAGE)) {
      const image = await findWikipediaImage(row);
      if (image) Object.assign(row, image);
      await sleep(200);
    }

    const missingCoordinates = !Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude));
    if (shouldGeocode && missingCoordinates) {
      const geocode = await geocodePlace(row);
      if (geocode) {
        row.latitude = geocode.latitude;
        row.longitude = geocode.longitude;
        row.coordinateStatus = "verified";
        row.coordinateConfidence = geocode.confidence;
        row.coordinateSource = geocode.source;
        row.coordinateAddress = geocode.address;
        row.coordinateQuery = geocode.query;
      }
      await sleep(1100);
    }
  }
  return rows;
}

async function findWikipediaImage(row) {
  const query = `${row.name} ${row.province}`;
  const url = new URL("https://th.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "5");
  url.searchParams.set("prop", "pageimages|info");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("pithumbsize", "960");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MongkolWelaTempleData/1.0 point@local",
        "Accept-Language": "th,en",
      },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const pages = Object.values(payload.query?.pages || {});
    const page = pages.find((item) => item.thumbnail?.source && isLikelySamePlace(row, item.title));
    if (!page) return null;

    return {
      imageUrl: page.thumbnail.source,
      imageAlt: `${row.name} ${row.province}`,
      imageSourceLabel: "Wikipedia/Wikimedia",
      imageSourceUrl: page.fullurl || `https://th.wikipedia.org/?curid=${page.pageid}`,
      imageSearchQuery: query,
      imageMatchScore: 88,
    };
  } catch {
    return null;
  }
}

function isLikelySamePlace(row, title) {
  const normalizedTitle = normalizePlaceToken(title);
  const normalizedName = normalizePlaceToken(row.name);
  const coreTitle = normalizedTitle.replace(/^วัด/u, "");
  const coreName = normalizedName.replace(/^วัด/u, "");
  if (normalizedTitle === normalizedName) return true;
  if (normalizedTitle.includes(normalizedName) || normalizedName.includes(normalizedTitle)) return true;
  if (coreName.length >= 5 && coreTitle.includes(coreName)) return true;
  if (coreTitle.length >= 5 && coreName.includes(coreTitle)) return true;
  return false;
}

function normalizePlaceToken(value) {
  return cleanText(value)
    .replace(/\(.+?\)/gu, "")
    .replace(/ราชวรมหาวิหาร|วรมหาวิหาร|วรวิหาร|มหาวิหาร/gu, "")
    .replace(/\s+/gu, "");
}

async function geocodePlace(row) {
  const query = [row.name, row.district, row.province, "ประเทศไทย"].filter(Boolean).join(" ");
  const arcgis = await geocodePlaceWithArcgis(row, query);
  if (arcgis) return arcgis;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "th");
  url.searchParams.set("q", query);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MongkolWelaTempleData/1.0 point@local",
        "Accept-Language": "th,en",
      },
    });
    if (!response.ok) return null;
    const [hit] = await response.json();
    if (!hit) return null;
    const displayName = cleanText(hit.display_name);
    if (!displayName.includes(row.province)) return null;

    return {
      latitude: Number(hit.lat),
      longitude: Number(hit.lon),
      source: "Nominatim/OpenStreetMap",
      address: displayName,
      query,
      confidence: displayName.includes(row.name.replace(/^วัด/u, "")) ? "high" : "accepted_province_match",
    };
  } catch {
    return null;
  }
}

async function geocodePlaceWithArcgis(row, query) {
  const url = new URL("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
  url.searchParams.set("SingleLine", query);
  url.searchParams.set("f", "json");
  url.searchParams.set("maxLocations", "3");
  url.searchParams.set("countryCode", "THA");
  url.searchParams.set("outFields", "*");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MongkolWelaTempleData/1.0 point@local",
        "Accept-Language": "th,en",
      },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const candidate = (payload.candidates || []).find((item) => {
      const attrs = item.attributes || {};
      const label = cleanText(attrs.LongLabel || item.address);
      return Number(item.score) >= 85 && label.includes(row.province) && isLikelySamePlace(row, attrs.PlaceName || item.address || label);
    });
    if (!candidate) return null;
    const attrs = candidate.attributes || {};
    return {
      latitude: Number(candidate.location.y),
      longitude: Number(candidate.location.x),
      source: "ArcGIS World Geocoding Service",
      address: cleanText(attrs.LongLabel || candidate.address),
      query,
      confidence: Number(candidate.score) >= 95 ? "high" : "medium",
    };
  } catch {
    return null;
  }
}

function buildEnrichmentMap(rows) {
  const map = new Map();
  for (const row of rows) {
    for (const key of enrichmentKeys(row)) {
      if (!map.has(key)) map.set(key, row);
    }
  }
  return map;
}

function buildImageOverrideMap(overrides) {
  const map = new Map();
  for (const [collection, collectionOverrides] of Object.entries(overrides || {})) {
    if (collection.startsWith("_") || !collectionOverrides || typeof collectionOverrides !== "object") continue;
    for (const [key, override] of Object.entries(collectionOverrides)) {
      if (!map.has(key)) map.set(key, override);
    }
  }
  return map;
}

function enrichmentKeys(row) {
  const province = cleanText(row.province);
  const name = cleanText(row.name);
  const keys = new Set([`${name}|${province}`]);
  for (const alias of aliasNames(name)) keys.add(`${alias}|${province}`);
  return [...keys];
}

function aliasNames(name) {
  const aliases = new Set();
  const pairs = [
    ["วัดพระแก้ว", "วัดพระศรีรัตนศาสดาราม"],
    ["วัดโพธิ์", "วัดพระเชตุพนวิมลมังคลาราม"],
    ["วัดอรุณ", "วัดอรุณราชวราราม"],
    ["วัดกัลยาณมิตร", "วัดกัลยาณมิตรวรมหาวิหาร"],
    ["วัดโสธรวราราม", "วัดโสธรวรารามวรวิหาร"],
    ["วัดไชยธาราราม", "วัดฉลอง"],
  ];
  for (const [a, b] of pairs) {
    if (name === a) aliases.add(b);
    if (name === b) aliases.add(a);
  }
  return aliases;
}

function pickImageFields(row) {
  const imageUrl = cleanText(row.imageUrl);
  if (!imageUrl || imageUrl === PLACEHOLDER_IMAGE) return {};
  return {
    imageUrl,
    imageAlt: row.imageAlt,
    imageSourceLabel: row.imageSourceLabel,
    imageSourceUrl: row.imageSourceUrl,
    imageSearchQuery: row.imageSearchQuery,
    imageMatchScore: row.imageMatchScore,
  };
}

function pickCoordinateFields(row) {
  if (!Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))) return {};
  return {
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    coordinateStatus: row.coordinateStatus,
    coordinateConfidence: row.coordinateConfidence,
    coordinateSource: row.coordinateSource,
    coordinateAddress: row.coordinateAddress,
    coordinateQuery: row.coordinateQuery,
  };
}

function fallbackTravelDetail(travelModes, collection) {
  const summary = collection === "popular"
    ? "วางแผนเดินทางตาม route/source ที่ระบุในชุดข้อมูล และตรวจสอบเวลาเปิด-ปิดก่อนออกเดินทาง"
    : "เดินทางด้วยรถส่วนตัวหรือขนส่งสาธารณะตามพื้นที่จริงของสถานที่ และตรวจสอบเวลาเปิด-ปิดก่อนออกเดินทาง";

  return {
    summary: travelModes ? `${summary}; รูปแบบเดินทางในชุดข้อมูล: ${travelModes}` : summary,
    confidence: "medium",
    updatedAt: GENERATED_AT,
  };
}

function summarizeRuntimeRows(rows) {
  return {
    count: rows.length,
    withCoordinates: rows.filter((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))).length,
    withRealImages: rows.filter((row) => row.imageUrl && row.imageUrl !== PLACEHOLDER_IMAGE).length,
    placeholderImages: rows.filter((row) => !row.imageUrl || row.imageUrl === PLACEHOLDER_IMAGE).length,
    missingCoordinates: rows.filter((row) => !Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))).length,
    topRows: rows.slice(0, 5).map((row) => `${row.rank}. ${row.name}|${row.province}`),
  };
}

function normalizeRegion(value) {
  const region = cleanText(value);
  return REGION_MAP.get(region) || region;
}

function normalizeDistrict(value) {
  return normalizeList(value, /;/u).join("; ");
}

function normalizeList(value, separator) {
  const values = String(value || "")
    .split(separator)
    .flatMap((item) => String(item).split(/\s+\+\s+|\+/u))
    .map(cleanText)
    .filter((item) => item && item !== "0" && item.toLowerCase() !== "nan" && item.toLowerCase() !== "null");
  return [...new Set(values)];
}

function mergeLists(a, b) {
  return [...new Set([...a, ...b].filter(Boolean))];
}

function stripEmpty(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    }),
  );
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await fs.readFile(url, "utf8"));
  } catch {
    return fallback;
  }
}

function filePath(url) {
  return new URL(url).pathname;
}

function unzipText(file, entry) {
  return execFileSync("unzip", ["-p", file, entry], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function safeUnzipText(file, entry) {
  try {
    return unzipText(file, entry);
  } catch {
    return "";
  }
}

function getSheetPath(workbookXml, relsXml, sheetName) {
  const sheetMatch = [...workbookXml.matchAll(/<[\w:]*sheet\b([^>]*)>/gu)]
    .map((match) => parseAttrs(match[1]))
    .find((attrs) => attrs.name === sheetName);
  if (!sheetMatch) throw new Error(`Sheet not found: ${sheetName}`);

  const rels = Object.fromEntries(
    [...relsXml.matchAll(/<[\w:]*Relationship\b([^>]*)\/>/gu)].map((match) => {
      const attrs = parseAttrs(match[1]);
      return [attrs.Id, attrs.Target];
    }),
  );
  const target = rels[sheetMatch["r:id"]];
  if (!target) throw new Error(`Sheet relationship not found: ${sheetName}`);
  return `xl/${target.replace(/^\/?xl\//u, "")}`;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gu)].map((match) =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gu)]
      .map((item) => decodeXml(item[1]))
      .join(""),
  );
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<[\w:]*row\b[^>]*>([\s\S]*?)<\/[\w:]*row>/gu)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<[\w:]*c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/[\w:]*c>)/gu)) {
      const attrs = parseAttrs(cellMatch[1]);
      const colIndex = columnIndex(attrs.r);
      cells[colIndex] = parseCellValue(attrs, cellMatch[2] || "", sharedStrings);
    }
    rows.push(Array.from({ length: cells.length }, (_, index) => cells[index] ?? ""));
  }
  return rows;
}

function parseCellValue(attrs, xml, sharedStrings) {
  const valueMatch = xml.match(/<[\w:]*v>([\s\S]*?)<\/[\w:]*v>/u);
  if (attrs.t === "s") return sharedStrings[Number(valueMatch?.[1] ?? 0)] ?? "";
  if (attrs.t === "inlineStr") {
    return [...xml.matchAll(/<[\w:]*t\b[^>]*>([\s\S]*?)<\/[\w:]*t>/gu)].map((match) => decodeXml(match[1])).join("");
  }
  const raw = decodeXml(valueMatch?.[1] ?? "");
  if (raw === "") return "";
  const number = Number(raw);
  return Number.isFinite(number) && /^-?\d+(?:\.\d+)?$/u.test(raw) ? number : raw;
}

function parseAttrs(value) {
  return Object.fromEntries([...value.matchAll(/([:\w]+)="([^"]*)"/gu)].map((match) => [match[1], decodeXml(match[2])]));
}

function columnIndex(cellRef = "") {
  const letters = String(cellRef).match(/^[A-Z]+/u)?.[0] || "A";
  return [...letters].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0) - 1;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, "&");
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
