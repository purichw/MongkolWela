import { normalizeVisitSection } from "../../lib/place-detail-view.js";
import { adminIcon } from "./design.js";

export const visitFields = {
  hours: [["เวลาปกติ", "regular"], ["จำหน่ายบัตร", "ticketOffice"], ["วันหยุด", "closed"], ["หมายเหตุ", "notes"]],
  admission: [["คนไทย", "thai"], ["ชาวต่างชาติ", "foreign"], ["ผู้ใหญ่", "adult"], ["เด็ก", "child"], ["หมายเหตุ", "notes"]],
  contact: [["โทรศัพท์", "phone"], ["อีเมล", "email"], ["Facebook", "facebook"], ["เว็บไซต์", "website"], ["LINE", "line"]],
};

export function editableVisitSection(value, kind) {
  const normalized = Array.isArray(value?.details) ? structuredClone(value) : normalizeVisitSection({ ...value, status: "listed" }, kind);
  for (const [term] of visitFields[kind]) {
    if (!normalized.details.some(detail => detail.term === term)) normalized.details.push({ term, value: "", href: "" });
  }
  return { ...normalized, status: value?.status || "unknown" };
}

export function renderVisitSummary(record, edit, e) {
  const visit = { ...record.visitInfo, ...edit?.visitInfo };
  return `<div class="mw-place-visit-summary">${[["hours", "clock", "เวลาเปิด–ปิด"], ["admission", "ticket", "ค่าเข้าชม"], ["contact", "phone", "ช่องทางติดต่อ"]].map(([kind, icon, label]) => {
    const section = editableVisitSection(visit[kind], kind);
    const details = section.details.filter(item => String(item.value || "").trim());
    const status = section.status === "verified" ? "ตรวจสอบแล้ว" : section.status === "listed" && details.length ? "มีข้อมูล" : "ยังไม่ยืนยัน";
    return `<button type="button" data-editor-visit-kind="${kind}">${adminIcon(icon)}<span><strong>${label}<b class="${status === "ยังไม่ยืนยัน" ? "is-unknown" : ""}">${status}</b></strong><small>${e(section.summary || details.map(item => item.value).slice(0, 2).join(" · ") || "ยังไม่มีข้อมูล")}</small></span></button>`;
  }).join("")}</div>`;
}

export function renderVisitEditor(record, edit, e, isOpen = () => false) {
  const visit = { ...record.visitInfo, ...edit?.visitInfo };
  const statusOptions = value => [["unknown", "ยังไม่ยืนยัน"], ["listed", "มีข้อมูลอ้างอิง"], ["verified", "ตรวจสอบแล้ว"]].map(([id, label]) => `<option value="${id}" ${value === id ? "selected" : ""}>${label}</option>`).join("");
  return `<div class="mw-admin-form-grid"><label>วันที่ตรวจทาน<input type="date" data-temple-visit="reviewedAt" value="${e(visit.reviewedAt || "")}"></label><label>หมายเหตุเข้าชม<input data-temple-visit="notice" value="${e(visit.notice || "")}"></label></div>${Object.entries(visitFields).map(([kind]) => {
    const section = editableVisitSection(visit[kind], kind);
    return `<details class="mw-admin-visit-editor" data-visit-kind="${kind}" data-editor-panel="visit-${kind}" ${isOpen(`visit-${kind}`) ? "open" : ""}><summary>${adminIcon({ hours: "clock", admission: "ticket", contact: "phone" }[kind])}${{ hours: "เวลาเปิด–ปิด", admission: "ค่าเข้าชม", contact: "ช่องทางติดต่อ" }[kind]}${adminIcon("chevron-down")}</summary><div class="mw-admin-form-grid"><label>สถานะข้อมูล<select data-temple-visit="${kind}/status">${statusOptions(section.status)}</select></label><label>ข้อความสรุป<input data-temple-visit="${kind}/summary" value="${e(section.summary || "")}"></label>${section.details.map((detail, index) => `<label>${e(detail.term)}<input data-temple-visit="${kind}/details/${index}" value="${e(detail.value)}"></label>`).join("")}</div></details>`;
  }).join("")}<div class="mw-admin-form-grid"><label>ชื่อแหล่งอ้างอิงเพิ่มเติม<input data-temple-visit="sourceLabel" value="${e(visit.sources?.find(source => source.id === "cms-editor")?.label || "")}"></label><label>ลิงก์อ้างอิงเพิ่มเติม<input type="url" data-temple-visit="sourceUrl" value="${e(visit.sources?.find(source => source.id === "cms-editor")?.url || "")}"></label></div>`;
}

export function updateVisitContent(edit, record, path, value) {
  edit.visitInfo ||= {};
  if (["sourceLabel", "sourceUrl"].includes(path)) {
    edit.visitInfo.sources ||= structuredClone(record.visitInfo?.sources || []);
    let source = edit.visitInfo.sources.find(item => item.id === "cms-editor");
    if (!source) { source = { id: "cms-editor", type: "admin-reference", label: "", url: "" }; edit.visitInfo.sources.push(source); }
    source[path === "sourceLabel" ? "label" : "url"] = value;
    return;
  }
  const [kind, field, index] = path.split("/");
  if (["reviewedAt", "notice"].includes(kind)) { edit.visitInfo[kind] = value; return; }
  if (!visitFields[kind]) return;
  edit.visitInfo[kind] = editableVisitSection(edit.visitInfo[kind] || record.visitInfo?.[kind], kind);
  const section = edit.visitInfo[kind];
  if (["status", "summary"].includes(field)) section[field] = value;
  else if (field === "details" && section.details[index]) {
    const detail = section.details[index];
    detail.value = value;
    if (detail.term === "โทรศัพท์") detail.href = `tel:${value.replace(/[^\d+]/g, "")}`;
    else if (detail.term === "อีเมล") detail.href = value ? `mailto:${value}` : "";
    else if (["Facebook", "เว็บไซต์"].includes(detail.term)) detail.href = value;
  }
}
