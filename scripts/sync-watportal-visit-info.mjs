import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collectionFiles = [
  "src/data/popular-temples.json",
  "src/data/mu-temples.json",
  "src/data/sacred-temples.json",
];
const outputPath = path.join(rootDir, "src/data/watportal-temple-details.json");
const searchUrl = "https://www.watportal.com/th/wat/search/getwats";
const baseUrl = "https://www.watportal.com";
const reviewedAt = new Date().toISOString().slice(0, 10);

const places = buildUniquePlaces();
const entries = {};
const unmatched = [];

for (const [index, place] of places.entries()) {
  if (index > 0 && index % 25 === 0) {
    console.log(`Checked ${index}/${places.length}: matched ${Object.keys(entries).length}, unmatched ${unmatched.length}`);
  }

  const candidates = await searchWatPortal(place.name);
  const match = selectBestCandidate(place, candidates);

  if (!match) {
    unmatched.push({ key: place.key, name: place.name, province: place.province, reason: "no-high-confidence-match" });
    await sleep(90);
    continue;
  }

  try {
    const detail = await fetchWatPortalDetail(match);
    if (!detail?.hoursSummary && !detail?.address) {
      unmatched.push({ key: place.key, name: place.name, province: place.province, reason: "matched-detail-without-usable-fields", url: match.url });
      await sleep(90);
      continue;
    }

    entries[place.key] = {
      sourceId: `watportal-${match.iid}`,
      sourceLabel: `Wat Portal: ${detail.officialName || match.title}`,
      url: match.url,
      iid: match.iid,
      matchedTitle: match.title,
      matchedAddress: match.address,
      matchScore: match.score,
      officialName: detail.officialName || match.title,
      address: detail.address,
      postalCode: detail.postalCode,
      sect: detail.sect,
      legalStatus: detail.legalStatus,
      templeTypes: detail.templeTypes,
      hoursSummary: detail.hoursSummary,
      hoursRegular: detail.hoursRegular,
      hoursRows: detail.hoursRows,
      latitude: detail.latitude,
      longitude: detail.longitude,
      imageUrl: detail.imageUrl,
      description: detail.description,
      reviewedAt,
    };
  } catch (error) {
    unmatched.push({ key: place.key, name: place.name, province: place.province, reason: error.message, url: match.url });
  }

  await sleep(90);
}

const report = {
  generatedAt: new Date().toISOString(),
  source: {
    label: "Wat Portal",
    url: "https://www.watportal.com/th/page/item/index/id/1",
    policy: "Treat as official source. When Wat Portal conflicts with tourism-directory data, prefer Wat Portal.",
  },
  totals: {
    places: places.length,
    matched: Object.keys(entries).length,
    unmatched: unmatched.length,
  },
  entries: sortObject(entries),
  unmatched,
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wat Portal matches: ${report.totals.matched}/${report.totals.places}`);
console.log(`Wrote ${path.relative(rootDir, outputPath)}`);

function buildUniquePlaces() {
  const map = new Map();

  collectionFiles.forEach((file) => {
    const rows = readJson(path.join(rootDir, file), []);
    rows.forEach((row, index) => {
      const name = cleanText(row.name);
      const province = cleanText(row.province);
      if (!name || !province) return;

      const key = `${name}|${province}`;
      const current =
        map.get(key) ||
        {
          key,
          name,
          province,
          district: cleanText(row.district),
          minRank: Number.POSITIVE_INFINITY,
        };

      current.minRank = Math.min(current.minRank, Number(row.rank) || index + 1);
      map.set(key, current);
    });
  });

  return [...map.values()].sort((a, b) => a.minRank - b.minRank || a.name.localeCompare(b.name, "th"));
}

async function searchWatPortal(query) {
  const body = new URLSearchParams({
    pageIndex: "1",
    q: query,
    region: "0",
    province: "0",
    type: "0",
  });

  const response = await fetchWithTimeout(searchUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
    },
    body,
  });

  if (!response.ok) throw new Error(`Wat Portal search failed: ${response.status}`);
  const data = await response.json();
  return parseSearchHtml(data.html || "");
}

function parseSearchHtml(html) {
  const cards = [];
  const linkPattern = /<div class="detail-title">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/g;
  let match;

  while ((match = linkPattern.exec(html))) {
    const href = absolutize(match[1]);
    const iid = href.match(/\/iid\/(\d+)/)?.[1];
    if (!iid) continue;

    const after = html.slice(match.index, linkPattern.lastIndex + 900);
    const address = stripHtml(after.match(/<div class="detail-address"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "");
    cards.push({
      iid,
      url: href,
      title: stripHtml(match[2]),
      address,
      province: cleanText(address.split(",").pop()),
    });
  }

  return cards;
}

function selectBestCandidate(place, candidates) {
  const scored = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(place, candidate),
    }))
    .filter((candidate) => candidate.score >= 80)
    .sort((a, b) => b.score - a.score || Number(a.iid) - Number(b.iid));

  return scored[0] || null;
}

function scoreCandidate(place, candidate) {
  const name = normalizeName(place.name);
  const title = normalizeName(candidate.title);
  const provinceMatches = normalizeName(candidate.province) === normalizeName(place.province);
  const districtMatches = cleanText(place.district) && candidate.address.includes(place.district);

  if (provinceMatches && name.length <= 7 && title !== name && !districtMatches) return 0;

  let score = provinceMatches ? 45 : -30;

  if (title === name) score += 60;
  else if (title.includes(name) || name.includes(title)) score += 48;
  else if (sharedLongToken(name, title)) score += 36;

  if (districtMatches) score += 8;
  return score;
}

async function fetchWatPortalDetail(match) {
  const response = await fetchWithTimeout(match.url);
  if (!response.ok) throw new Error(`Wat Portal detail failed: ${response.status}`);
  const html = await response.text();

  const hoursRows = parseHoursRows(html);
  const hoursSummary = summarizeHours(hoursRows);
  const coordinates = html.match(/maps\/embed\/v1\/place\?q=([-0-9.]+),([-0-9.]+)/);
  const imageUrl = html.match(/<meta property="og:image"\s+content="([^"]+)"/)?.[1] || "";
  const description = cleanText(decodeEntities(html.match(/<meta name="description"\s+content="([^"]*)"/)?.[1] || ""));
  const address = extractTopic(html, "ที่ตั้ง :");

  return {
    officialName: extractTopic(html, "ชื่อ :"),
    address,
    postalCode: address.match(/(\d{5})$/)?.[1] || "",
    sect: extractTopic(html, "นิกาย :"),
    legalStatus: extractTopic(html, "ชนิด :"),
    templeTypes: extractTopic(html, "ประเภทวัด :"),
    hoursSummary,
    hoursRegular: hoursSummary ? hoursRows.map((row) => `${row.day} ${row.time}`).join("; ") : "",
    hoursRows,
    latitude: coordinates ? Number(coordinates[1]) : null,
    longitude: coordinates ? Number(coordinates[2]) : null,
    imageUrl,
    description,
  };
}

function extractTopic(html, topic) {
  const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<span class="topic">\\s*${escaped}\\s*<\\/span>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`);
  return stripHtml(html.match(pattern)?.[1] || "");
}

function parseHoursRows(html) {
  const rows = [];
  const pattern = /<div class="col-md-5[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="col-md-7[^"]*"[^>]*>\s*:?\s*([\s\S]*?)<\/div>/g;
  let match;

  while ((match = pattern.exec(html))) {
    const day = stripHtml(match[1]);
    const time = stripHtml(match[2]).replace(/\s+/g, " ");
    if (day && time) rows.push({ day, time });
  }

  return rows;
}

function summarizeHours(rows) {
  if (!rows.length) return "";
  const times = [...new Set(rows.map((row) => row.time))];
  if (rows.length >= 7 && times.length === 1) return `เปิดทุกวัน ${formatTimeRange(times[0])} น.`;
  return rows.map((row) => `${row.day} ${formatTimeRange(row.time)} น.`).join("; ");
}

function formatTimeRange(value) {
  return cleanText(value).replace(/\s*-\s*/g, "-");
}

function sharedLongToken(a, b) {
  const tokens = [...new Set(a.split(/(?=วัด)|[()\-–, ]+/).filter((token) => token.length >= 4))];
  return tokens.some((token) => b.includes(token));
}

function normalizeName(value) {
  return cleanText(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/ราชวรมหาวิหาร|วรมหาวิหาร|วรวิหาร|ราชวรวิหาร|มหาวิหาร/g, "")
    .replace(/\s+/g, "")
    .replace(/[ฯๆ.]/g, "");
}

function stripHtml(value) {
  return cleanText(
    decodeEntities(
      String(value || "")
        .replace(/<span class=['"]num['"]>([\s\S]*?)<\/span>/g, " $1")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    ).replace(/\s+/g, " ")
  );
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function absolutize(url) {
  if (url.startsWith("http")) return url;
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function sortObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, "th")));
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
