const DISTANCE_PATTERN = /~\s*\d+(?:\.\d+)?\s*(?:กม\.|ม\.)/u;

export const TRAVEL_SECTION_DEFINITIONS = [
  {
    key: "railAccess",
    mode: "rail",
    label: "รถไฟ / รถไฟฟ้า",
    shortLabel: "รถไฟ",
    highlightLabel: "รถไฟฟ้า",
  },
  {
    key: "boatAccess",
    mode: "boat",
    label: "เรือ / ท่าเรือ",
    shortLabel: "เรือ",
    highlightLabel: "ทางเรือ",
  },
  {
    key: "busAccess",
    mode: "bus",
    label: "รถประจำทาง",
    shortLabel: "รถเมล์",
    highlightLabel: "รถเมล์",
  },
  {
    key: "vanAccess",
    mode: "van",
    label: "รถตู้ / รถรับส่ง",
    shortLabel: "รถตู้",
    highlightLabel: "รถตู้",
  },
  {
    key: "walkAccess",
    mode: "walk",
    label: "จุดจอดใกล้สุด",
    shortLabel: "ใกล้สุด",
    highlightLabel: "ใกล้สุด",
  },
];

const SECTION_BY_MODE = Object.fromEntries(TRAVEL_SECTION_DEFINITIONS.map((section) => [section.mode, section]));

export function getTempleTravel(travelDetail = {}) {
  const routes = normalizeTravelRoutes(travelDetail);
  const sections = TRAVEL_SECTION_DEFINITIONS.map((section) => ({
    ...section,
    routes: routes.filter((route) => route.mode === section.mode),
  })).filter((section) => section.routes.length);

  const recommendations = getRecommendedTravelRoutes(routes);

  return {
    routes,
    sections,
    recommendations,
    hasTravelDetail: Boolean(routes.length || travelDetail.summary),
  };
}

function normalizeTravelRoutes(travelDetail) {
  if (Array.isArray(travelDetail.routes) && travelDetail.routes.length) {
    return travelDetail.routes.map(normalizeStructuredRoute).filter(Boolean);
  }

  const accessRoutes = TRAVEL_SECTION_DEFINITIONS.flatMap((section) => parseAccessRoutes(travelDetail[section.key], section));
  return accessRoutes.length ? accessRoutes : parseSummaryRoutes(travelDetail.summary);
}

function normalizeStructuredRoute(route) {
  const section = SECTION_BY_MODE[route.mode] || TRAVEL_SECTION_DEFINITIONS.find((item) => item.key === route.sourceKey);
  if (!section) return null;

  const stop = cleanText(route.stop || route.name || route.title);
  if (!stop) return null;

  const distanceText = cleanText(route.distanceText || route.distance);
  const routeText = cleanText(route.route || route.routeText || route.line);
  const operatorText = cleanText(route.operator || route.operatorText);
  const typeText = cleanText(route.type || route.typeText);

  return {
    mode: section.mode,
    sourceKey: section.key,
    sectionLabel: section.label,
    shortLabel: section.shortLabel,
    stop,
    distanceText,
    distanceMeters: distanceToMeters(distanceText),
    routeText,
    operatorText,
    typeText,
    isTransfer: route.isTransfer === true || hasTransferHint(`${stop} ${routeText}`),
  };
}

function parseAccessRoutes(value, section) {
  return splitRows(value)
    .map((row) => parseAccessRoute(row, section))
    .filter(Boolean);
}

function parseSummaryRoutes(value) {
  return splitRows(value)
    .map((row) => {
      const parsed = extractSummarySection(row);
      return parseAccessRoute(parsed.text, parsed.section);
    })
    .filter(Boolean);
}

function parseAccessRoute(row, section) {
  const segments = row
    .split("|")
    .map(cleanText)
    .filter(Boolean);

  if (!segments.length) return null;

  const firstSegment = segments.shift();
  const distanceText = firstSegment.match(DISTANCE_PATTERN)?.[0] || "";
  const stop = cleanText(
    firstSegment
      .replace(DISTANCE_PATTERN, "")
      .replace(/^จุดจอด\s*GTFS\s*ใกล้สุด\s*:\s*/u, "")
      .replace(/^จุดจอดใกล้สุด\s*:\s*/u, "")
  );

  if (!stop) return null;

  const details = Object.fromEntries(
    segments.map((segment) => {
      const separatorIndex = segment.indexOf(":");
      if (separatorIndex === -1) return ["note", segment];
      return [cleanText(segment.slice(0, separatorIndex)), cleanText(segment.slice(separatorIndex + 1))];
    })
  );

  const routeText = details["สาย/เส้นทาง"] || details.route || "";
  const operatorText = details["ผู้ให้บริการ"] || details.operator || "";
  const typeText = details["ประเภท"] || details.type || "";

  return {
    mode: section.mode,
    sourceKey: section.key,
    sectionLabel: section.label,
    shortLabel: section.shortLabel,
    stop,
    distanceText,
    distanceMeters: distanceToMeters(distanceText),
    routeText,
    operatorText,
    typeText,
    isTransfer: hasTransferHint(`${stop} ${routeText}`),
  };
}

function getRecommendedTravelRoutes(routes) {
  const items = [];
  const addRoute = (label, route) => {
    if (!route || items.some((item) => routeKey(item.route) === routeKey(route))) return;
    items.push({ label, route });
  };

  addRoute("ใกล้สุด", routes.filter((route) => Number.isFinite(route.distanceMeters)).sort((a, b) => a.distanceMeters - b.distanceMeters)[0]);
  addRoute("รถไฟฟ้า", routes.find((route) => route.mode === "rail" && /^MRT|^BTS|^ARL/u.test(route.stop)));
  addRoute("ทางเรือ", routes.find((route) => route.mode === "boat" && route.isTransfer) || routes.find((route) => route.mode === "boat"));
  addRoute("รถเมล์", routes.find((route) => route.mode === "bus"));
  addRoute("รถตู้", routes.find((route) => route.mode === "van"));

  return items.slice(0, 3);
}

function routeKey(route) {
  return [route.mode, route.stop, route.routeText].join("|");
}

function splitRows(value) {
  return String(value || "")
    .split(";")
    .map(cleanText)
    .filter((item) => item && item !== "0" && item.toLowerCase() !== "nan" && item.toLowerCase() !== "null");
}

function extractSummarySection(row) {
  const summaryPrefixes = [
    [/^รถไฟ\/รถไฟฟ้า\s*:\s*/u, "rail"],
    [/^เรือ\s*:\s*/u, "boat"],
    [/^รถประจำทาง\s*:\s*/u, "bus"],
    [/^รถตู้\/รถรับส่ง\s*:\s*/u, "van"],
    [/^จุดจอด\s*GTFS\s*ใกล้สุด\s*:\s*/u, "walk"],
    [/^จุดจอดใกล้สุด\s*:\s*/u, "walk"],
  ];
  const match = summaryPrefixes.find(([pattern]) => pattern.test(row));
  if (!match) {
    return { section: inferSectionFromText(row), text: row };
  }
  const [pattern, mode] = match;
  return { section: SECTION_BY_MODE[mode], text: row.replace(pattern, "") };
}

function inferSectionFromText(value) {
  if (/^MRT|^BTS|^SRT|รถไฟ/u.test(value)) return SECTION_BY_MODE.rail;
  if (/ท่าเรือ|เรือ/u.test(value)) return SECTION_BY_MODE.boat;
  if (/รถตู้|รถรับส่ง|ต\.\d+/u.test(value)) return SECTION_BY_MODE.van;
  if (/รถประจำทาง|รถเมล์|ขสมก\.|ไทย สมายล์ บัส/u.test(value)) return SECTION_BY_MODE.bus;
  return SECTION_BY_MODE.walk;
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTransferHint(value) {
  return /ข้ามฟาก/u.test(value);
}

function distanceToMeters(distanceText) {
  const match = cleanText(distanceText).match(/~\s*(\d+(?:\.\d+)?)\s*(กม\.|ม\.)/u);
  if (!match) return Number.POSITIVE_INFINITY;
  const amount = Number(match[1]);
  return match[2] === "กม." ? amount * 1000 : amount;
}
