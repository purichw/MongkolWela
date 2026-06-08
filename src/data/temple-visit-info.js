import visitInfoData from "./temple-visit-info.json";

const fallbackNotice = visitInfoData.fallbackNotice;
const entries = visitInfoData.entries || {};

export function getTempleVisitInfo(temple) {
  const key = createVisitInfoKey(temple);
  const entry = entries[key];

  if (!entry) {
    return createFallbackVisitInfo(key);
  }

  return withCoverage({
    key,
    status: entry.status || "partial",
    reviewedAt: entry.reviewedAt || "",
    notice: entry.notice || fallbackNotice,
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    admission: normalizeSection(entry.admission, "ค่าเข้าชม"),
    hours: normalizeSection(entry.hours, "เวลาเปิด-ปิดและวันหยุด"),
    contact: normalizeSection(entry.contact, "ช่องทางติดต่อ"),
  });
}

export function createVisitInfoKey(temple) {
  return `${cleanText(temple?.name)}|${cleanText(temple?.province)}`;
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
  return withCoverage({
    key,
    status: "needs-direct-check",
    reviewedAt: "",
    notice: fallbackNotice,
    sources: [],
    admission: normalizeSection(null, "ค่าเข้าชม"),
    hours: normalizeSection(null, "เวลาเปิด-ปิดและวันหยุด"),
    contact: normalizeSection(null, "ช่องทางติดต่อ"),
  });
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
