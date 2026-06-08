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
    admission: normalizeSection(entry.admission, "ค่าเข้าชม"),
    hours: normalizeSection(entry.hours, "เวลาเปิด-ปิดและวันหยุด"),
    contact: normalizeSection(entry.contact, "ช่องทางติดต่อ"),
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
      closed: "ไม่ได้ระบุวันหยุดประจำใน Wat Portal",
      holidayNotes: "Wat Portal เป็นแหล่งข้อมูลทะเบียน/คลังข้อมูลวัดที่มงคลเวลาจัดเป็น official source; หากมีประกาศเฉพาะกิจควรตรวจสอบกับสถานที่ก่อนเดินทาง",
      sourceIds: [entry.sourceId],
    },
    "เวลาเปิด-ปิดและวันหยุด"
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

function normalizeSection(section, label) {
  if (!section || !["verified", "listed"].includes(section.status)) {
    return {
      status: "needs-direct-check",
      label,
      summary: fallbackNotice,
      sourceIds: [],
      details: [],
    };
  }

  return {
    ...section,
    label,
    summary: cleanText(section.summary) || fallbackNotice,
    sourceIds: Array.isArray(section.sourceIds) ? section.sourceIds : [],
    details: sectionDetails(section),
  };
}

function sectionDetails(section) {
  return [
    ["คนไทย", section.thai],
    ["ชาวต่างชาติ", section.foreign],
    ["ผู้ใหญ่", section.adult],
    ["เด็ก", section.child],
    ["เวลาปกติ", section.regular],
    ["จำหน่ายบัตร", section.ticketOffice],
    ["วันหยุด", section.closed],
    ["หมายเหตุ", section.holidayNotes || section.notes],
    ["โทรศัพท์", section.phone],
    ["LINE", section.line],
    ["Facebook", section.facebook],
    ["อีเมล", section.email],
  ]
    .map(([term, value]) => ({ term, value: cleanText(value) }))
    .filter((item) => item.value);
}

function createFallbackVisitInfo(key) {
  return {
    key,
    status: "needs-direct-check",
    reviewedAt: "",
    notice: fallbackNotice,
    sources: [],
    admission: normalizeSection(null, "ค่าเข้าชม"),
    hours: normalizeSection(null, "เวลาเปิด-ปิดและวันหยุด"),
    contact: normalizeSection(null, "ช่องทางติดต่อ"),
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
