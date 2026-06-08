import visitInfoData from "./temple-visit-info.json";
import watportalData from "./watportal-temple-details.json";

const fallbackNotice = visitInfoData.fallbackNotice;
const entries = visitInfoData.entries || {};
const watportalEntries = watportalData.entries || {};

export function getTempleVisitInfo(temple) {
  const key = createVisitInfoKey(temple);
  const entry = entries[key];
  const watportalEntry = watportalEntries[key];

  const visitInfo = entry ? createVisitInfoFromEntry(key, entry) : createFallbackVisitInfo(key);
  return withCoverage(applyWatPortalVisitInfo(visitInfo, watportalEntry));
}

export function createVisitInfoKey(temple) {
  return `${cleanText(temple?.name)}|${cleanText(temple?.province)}`;
}

function createVisitInfoFromEntry(key, entry) {
  return {
    key,
    status: entry.status || "partial",
    reviewedAt: entry.reviewedAt || "",
    notice: entry.notice || fallbackNotice,
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    admission: normalizeSection(entry.admission, "ค่าเข้าชม", "admission"),
    hours: normalizeSection(entry.hours, "เวลาเปิด-ปิดและวันหยุด", "hours"),
    contact: normalizeSection(entry.contact, "ช่องทางติดต่อ", "contact"),
  };
}

function applyWatPortalVisitInfo(visitInfo, watportalEntry) {
  if (!watportalEntry) return visitInfo;

  const source = {
    id: watportalEntry.sourceId,
    label: watportalEntry.sourceLabel,
    url: watportalEntry.url,
    type: "official",
  };
  const sources = appendSource(visitInfo.sources, source);
  const shouldUseWatPortalHours = Boolean(watportalEntry.hoursSummary) && shouldPreferWatPortalHours(visitInfo.hours, visitInfo.sources);

  return {
    ...visitInfo,
    status: visitInfo.status === "needs-direct-check" ? "partial" : visitInfo.status,
    reviewedAt: maxDate(visitInfo.reviewedAt, watportalEntry.reviewedAt),
    sources,
    hours: shouldUseWatPortalHours ? createWatPortalHoursSection(watportalEntry) : visitInfo.hours,
    officialRegistry: createWatPortalRegistry(watportalEntry),
  };
}

function shouldPreferWatPortalHours(hours, sources) {
  if (!["verified", "listed"].includes(hours.status)) return true;
  const sectionSources = new Set(hours.sourceIds || []);
  const directOfficial = sources.some((source) => sectionSources.has(source.id) && source.type === "official" && !source.id.startsWith("watportal-"));
  return !directOfficial;
}

function createWatPortalHoursSection(entry) {
  return normalizeSection(
    {
      status: "verified",
      summary: entry.hoursSummary,
      regular: entry.hoursRegular || entry.hoursSummary,
      timetable: Array.isArray(entry.hoursRows) ? entry.hoursRows : [],
      closed: "ไม่ได้ระบุวันหยุดประจำ",
      sourceIds: [entry.sourceId],
    },
    "เวลาเปิด-ปิดและวันหยุด",
    "hours"
  );
}

function createWatPortalRegistry(entry) {
  const details = [
    ["ชื่อใน Wat Portal", entry.officialName],
    ["ที่ตั้ง", entry.address],
    ["รหัสไปรษณีย์", entry.postalCode],
    ["นิกาย", entry.sect],
    ["ชนิด", entry.legalStatus],
    ["ประเภทวัด", entry.templeTypes],
  ]
    .map(([term, value]) => ({ term, value: cleanText(value) }))
    .filter((item) => item.value);

  if (details.length === 0) return null;

  return {
    sourceId: entry.sourceId,
    sourceLabel: entry.sourceLabel,
    url: entry.url,
    details,
    latitude: entry.latitude,
    longitude: entry.longitude,
  };
}

function normalizeSection(section, label, kind) {
  if (!section || !["verified", "listed"].includes(section.status)) {
    return {
      kind,
      status: "needs-direct-check",
      label,
      summary: fallbackNotice,
      sourceIds: [],
      details: [],
      timetable: [],
    };
  }

  return {
    ...section,
    kind,
    label,
    summary: cleanText(section.summary) || fallbackNotice,
    sourceIds: Array.isArray(section.sourceIds) ? section.sourceIds : [],
    timetable: normalizeTimetable(section.timetable),
    details: sectionDetails(section, kind),
  };
}

function sectionDetails(section, kind) {
  if (kind === "admission") return admissionDetails(section);
  if (kind === "hours") return hoursDetails(section);
  if (kind === "contact") return contactDetails(section);
  return [];
}

function admissionDetails(section) {
  const details = [];
  pushDetail(details, "คนไทย", section.thai);
  pushDetail(details, "ชาวต่างชาติ", section.foreign);

  const adult = cleanDisplayText(section.adult);
  const child = cleanDisplayText(section.child);
  const hasAudiencePrice = cleanDisplayText(section.thai) || cleanDisplayText(section.foreign);
  if (adult && child && comparableText(adult) !== comparableText(child)) {
    details.push({ term: "ผู้ใหญ่", value: adult }, { term: "เด็ก", value: child });
  } else if (!hasAudiencePrice) {
    pushDetail(details, "ผู้ใหญ่", adult);
    pushDetail(details, "เด็ก", child);
  }

  pushDetail(details, "หมายเหตุ", section.notes);
  return details;
}

function hoursDetails(section) {
  const details = [];
  if (!normalizeTimetable(section.timetable).length) pushDetail(details, "เวลาปกติ", section.regular);
  pushDetail(details, "จำหน่ายบัตร", section.ticketOffice);
  pushDetail(details, "วันหยุด", section.closed, { allowUnspecified: true });
  pushDetail(details, "หมายเหตุ", section.holidayNotes || section.notes);
  return details;
}

function contactDetails(section) {
  const details = [];
  pushDetail(details, "โทรศัพท์", section.phone);
  pushDetail(details, "LINE", section.line);
  pushDetail(details, "Facebook", section.facebook);
  pushDetail(details, "อีเมล", section.email);
  return details;
}

function pushDetail(details, term, value, options = {}) {
  const displayValue = cleanDisplayText(value, options);
  if (displayValue) details.push({ term, value: displayValue });
}

function cleanDisplayText(value, options = {}) {
  const text = cleanText(value)
    .replace(/\s*ใน Wat Portal\s*/giu, "")
    .replace(/\s*ในแหล่งข้อมูล\s*/giu, "ในแหล่งข้อมูล")
    .trim();
  if (!text || (!options.allowUnspecified && isNonInformativeText(text)) || isInternalAnnotation(text)) return "";
  return text;
}

function isNonInformativeText(text) {
  return /^ไม่ได้ระบุ/u.test(text) || /^อ้างอิงลิงก์/u.test(text);
}

function isInternalAnnotation(text) {
  return /Wat Portal เป็นแหล่งข้อมูล/u.test(text);
}

function comparableText(value) {
  return cleanText(value)
    .replace(/\s+/gu, "")
    .replace(/สำหรับชาวต่างชาติ/gu, "")
    .replace(/เมื่อแสดงบัตรประชาชน/gu, "");
}

function normalizeTimetable(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      day: cleanText(row?.day),
      time: cleanText(row?.time),
    }))
    .filter((row) => row.day && row.time);
}

function createFallbackVisitInfo(key) {
  return {
    key,
    status: "needs-direct-check",
    reviewedAt: "",
    notice: fallbackNotice,
    sources: [],
    admission: normalizeSection(null, "ค่าเข้าชม", "admission"),
    hours: normalizeSection(null, "เวลาเปิด-ปิดและวันหยุด", "hours"),
    contact: normalizeSection(null, "ช่องทางติดต่อ", "contact"),
  };
}

function withCoverage(visitInfo) {
  const sections = [visitInfo.admission, visitInfo.hours, visitInfo.contact];
  const visibleSections = sections.filter((section) => ["verified", "listed"].includes(section.status));
  const verifiedSections = sections.filter((section) => section.status === "verified");
  const listedSections = sections.filter((section) => section.status === "listed");
  const missingSections = sections.filter((section) => !["verified", "listed"].includes(section.status));

  return {
    ...visitInfo,
    sections,
    visibleSections,
    verifiedSections,
    listedSections,
    missingSections,
    hasVisibleSections: visibleSections.length > 0,
    hasVerifiedSections: verifiedSections.length > 0,
    listedSectionCount: listedSections.length,
    verifiedSectionCount: verifiedSections.length,
  };
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function appendSource(sources, source) {
  const nextSources = Array.isArray(sources) ? [...sources] : [];
  if (!source?.id || nextSources.some((item) => item.id === source.id)) return nextSources;
  return [source, ...nextSources];
}

function maxDate(a, b) {
  if (!a) return b || "";
  if (!b) return a || "";
  return a > b ? a : b;
}
