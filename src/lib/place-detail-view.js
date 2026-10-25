// Shared by static rendering and the published-CMS patcher. No dataset imports.
import { renderIcon, renderIconMedallion } from "./ui-markup.js";
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const list = (value) => Array.isArray(value) ? value.filter(Boolean).map(String) : String(value || "").split(";").map(v => v.trim()).filter(Boolean);
export function safeLink(value, contact = false) {
  const text = String(value || "").trim();
  if (contact && /^(tel:[+\d ()-]+|mailto:[^\s<>]+)$/i.test(text)) return text;
  try { const url = new URL(text); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
export const icon = (name, extra = "") => renderIcon(name, `pd-icon ${extra}`.trim());
const link = (label, href, className = "") => safeLink(href, true) ? `<a class="${className}" href="${esc(safeLink(href, true))}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(label)}</a>` : esc(label);
const known = section => ["verified", "listed"].includes(section?.status);
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
export function coordinates(record) {
  const valid = (v, limit) => ["number", "string"].includes(typeof v) && String(v).trim() !== "" && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= limit;
  return valid(record.latitude, 90) && valid(record.longitude, 180) ? [Number(record.latitude), Number(record.longitude)] : null;
}
export function mapUrl(record) {
  const code = String(record.plusCode || "").trim();
  const validCode = /^(?:[23456789CFGHJMPQRVWX]{2,8})\+[23456789CFGHJMPQRVWX]{2,}(?:\s+.*)?$/i.test(code);
  const coords = coordinates(record);
  const query = validCode ? code : coords?.join(",");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}
export function normalizeVisitSection(section, kind) {
  if (!section || !known(section)) return { kind, status: "unknown", details: [], timetable: [], summary: "" };
  const details = Array.isArray(section.details) ? section.details.map(item => ({ term: String(item.term || ""), value: String(item.value ?? ""), href: safeLink(item.href, true) })) : [];
  const add = (term, value, href = "") => { if (value !== null && value !== undefined && String(value).trim()) details.push({ term, value: String(value), href: safeLink(href, true) }); };
  if (!Array.isArray(section.details)) {
    if (kind === "hours") { add("เวลาปกติ", section.regular); add("จำหน่ายบัตร", section.ticketOffice); add("วันหยุด", section.closed); add("หมายเหตุ", section.holidayNotes || section.notes); }
    if (kind === "admission") { for (const [key, term] of [["thai", "คนไทย"], ["foreign", "ชาวต่างชาติ"], ["adult", "ผู้ใหญ่"], ["child", "เด็ก"], ["notes", "หมายเหตุ"]]) add(term, section[key]); }
    if (kind === "contact") {
      add("โทรศัพท์", section.phone, `tel:${String(section.phone || "").replace(/[^\d+]/g, "")}`);
      add("อีเมล", section.email, `mailto:${section.email || ""}`);
      add("Facebook", section.facebook, section.facebook);
      add("เว็บไซต์", section.website, section.website);
      add("LINE", section.line);
    }
  }
  return { ...section, kind, details: details.filter(d => d.value), timetable: (section.timetable || section.hoursRows || []).filter(r => r?.day && r?.time) };
}
export function normalizeVisit(base = {}, override = {}) {
  const result = { ...base, ...override };
  for (const kind of ["hours", "admission", "contact"]) result[kind] = normalizeVisitSection(has(override, kind) ? override[kind] : base[kind], kind);
  result.sources = (result.sources || []).filter(s => s?.label || s?.url);
  return result;
}
export function createPlaceModel(seed, override = {}) {
  const fields = { ...seed.record, ...(override.fields || {}) };
  if (!String(fields.name || "").trim()) fields.name = seed.record.name;
  // Travel and related are build-owned; a detail content refresh is not a routing rebuild.
  fields.travelDetail = seed.record.travelDetail;
  return { ...seed, record: fields, visit: normalizeVisit(seed.visit, override.visitInfo || {}), coords: coordinates(fields), mapHref: mapUrl(fields) };
}
export function dateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
  const date = new Date(`${value}T12:00:00+07:00`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date) : "";
}
function detailList(details) { return `<dl class="pd-facts">${details.map(d => `<div><dt>${esc(d.term)}</dt><dd>${link(d.value, d.href)}</dd></div>`).join("")}</dl>`; }
function expandable(items, count, key, render) {
  return `${items.slice(0, count).map(render).join("")}${items.length > count ? `<details class="pd-more" data-pd-disclosure="${key}"><summary>ดูทั้งหมด (${items.length}) ${icon("chevron-down")}</summary><div>${items.slice(count).map(render).join("")}</div></details>` : ""}`;
}
export function renderIdentity(vm) {
  const r = vm.record, rank = Number(r.rank);
  const summary = list(r.blessings).length ? `${r.name} นิยมสักการะเพื่อ${list(r.blessings).slice(0, 3).join(" · ")}` : `${r.name} ใน${r.province || vm.collectionLabel}`;
  return `<p class="pd-kicker">${esc(vm.collectionLabel)}${Number.isFinite(rank) && rank > 0 ? ` · ลำดับ ${String(rank).padStart(2, "0")}` : ""}</p><h1 id="temple-detail-title">${esc(r.name)}</h1><p class="pd-intro">${esc(r.summary ?? summary)}</p><p class="pd-area">${icon("map-pin")}${esc([r.district, r.province].filter(Boolean).join(" · "))}</p><div class="pd-tags">${[r.placeType, r.region, r.province].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("")}</div>`;
}
export function renderImageCredit(vm) {
  const { imageSourceLabel, imageSourceUrl } = vm.record;
  if (!imageSourceLabel || imageSourceLabel === "Placeholder") return "";
  return link(`ภาพ: ${imageSourceLabel}`, imageSourceUrl);
}
export function renderHighlights(vm) {
  const r = vm.record;
  const objects = list(r.objectHero), topics = list(r.blessings);
  const description = String(r.description ?? "").trim();
  return `${description ? `<p>${esc(description)}</p>` : ""}${topics.length ? `<div class="pd-topics">${expandable(topics, 6, "topics", t => `<span>${icon("sparkles")}${esc(t)}</span>`)}</div>` : ""}${objects.length ? `<div class="pd-worship"><h3>สิ่งที่นิยมสักการะ</h3><div class="pd-objects">${expandable(objects, 5, "objects", t => `<span>${esc(t)}</span>`)}</div></div>` : ""}`;
}
export function renderLocation(vm) {
  const r = vm.record;
  const secondary = [["จังหวัด", r.province], ["เขต / อำเภอ", r.district], ["ประเภท", r.placeType], ["การเดินทาง", list(r.travelModes).join(" · ")]].filter(([, value]) => value).map(([term, value]) => ({ term, value }));
  return `<div class="pd-map-meta"><div><h3>พิกัดและที่อยู่</h3><p>${vm.coords ? esc(vm.coords.map(v => v.toFixed(6)).join(", ")) : "ยังไม่มีพิกัดสำหรับแผนที่ภายใน"}</p></div></div>${r.coordinateAddress ? `<p class="pd-address">${icon("map-pin")}<span>${esc(r.coordinateAddress)}</span></p>` : ""}${secondary.length ? `<div class="pd-location-details"><h3>ข้อมูลสถานที่เพิ่มเติม</h3>${detailList(secondary)}</div>` : ""}`;
}
export function hoursSummary(section) {
  if (!known(section)) return "ยังไม่มีข้อมูลเวลาเปิด–ปิดที่ยืนยัน";
  const rows = section.timetable;
  const days = rows.map(r => String(r.day).replace(/^วัน/, "").trim());
  const week = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
  if (rows.length === 7 && new Set(days).size === 7 && week.every(d => days.includes(d)) && rows.every(r => r.time === rows[0].time) && /\d/.test(rows[0].time)) return `ทุกวัน ${rows[0].time}`;
  return rows.length ? "ตรวจสอบเวลารายวัน" : section.details.find(d => d.term === "เวลาปกติ")?.value || "ยังไม่มีข้อมูลเวลาเปิด–ปิดที่ยืนยัน";
}
export function renderVisit(vm) {
  const { hours, admission, contact, notice, reviewedAt } = vm.visit;
  const closure = hours.details.find(d => d.term === "วันหยุด")?.value;
  const closureText = !closure || /ไม่ได้?ระบุ|ไม่ระบุ/.test(closure) ? "ข้อมูลไม่ระบุวันหยุดประจำ" : closure;
  const fee = known(admission) ? admission.details.filter(d => d.term !== "หมายเหตุ") : [];
  const freeForAll = ["คนไทย", "ชาวต่างชาติ"].every(term => fee.some(d => d.term === term && /^(?:ไม่มีค่าเข้าชม|ไม่เสียค่าเข้าชม|ฟรี|0(?:\s*บาท)?)$/.test(d.value.trim()))) && fee.every(d => /^(?:ไม่มีค่าเข้าชม|ไม่เสียค่าเข้าชม|ฟรี|0(?:\s*บาท)?)$/.test(d.value.trim()));
  const fees = freeForAll ? `<p>ไม่เสียค่าเข้าชม</p><details class="pd-disclosure" data-pd-disclosure="fees"><summary>เงื่อนไขและรายละเอียด ${icon("chevron-down")}</summary>${detailList(admission.details)}</details>` : `${fee.length ? detailList(fee) : `<p>ยังไม่มีข้อมูลค่าเข้าชมที่ยืนยัน</p>`}${detailList(admission.details.filter(d => d.term === "หมายเหตุ"))}`;
  const contactItem = d => `<p><span class="pd-contact-label">${esc(d.term)}</span> ${link(d.value, d.href)}</p>`;
  const moreHours = hours.details.filter(d => d.term !== "วันหยุด" && (hours.timetable.length || d.term !== "เวลาปกติ"));
  const summary = section => known(section) && section.summary && !section.details.some(d => d.value === section.summary) && (section.kind !== "hours" || section.summary !== hoursSummary(section)) ? `<p class="pd-visit-summary">${esc(section.summary)}</p>` : "";
  return `${reviewedAt ? `<p class="pd-reviewed">ข้อมูลเข้าชมตรวจทานเมื่อ ${esc(dateLabel(reviewedAt))}</p>` : ""}<div class="pd-visit-rows">
    <div class="pd-info-row">${icon("clock")}<div><h3>เวลาเปิด–ปิด</h3><p>${esc(hoursSummary(hours))}</p>${summary(hours)}${hours.timetable.length || moreHours.length ? `<details class="pd-disclosure" data-pd-disclosure="hours"><summary>ดูเวลารายวัน ${icon("chevron-down")}</summary>${hours.timetable.length ? `<table><tbody>${hours.timetable.map(r => `<tr><th scope="row">${esc(r.day)}</th><td>${esc(r.time)}</td></tr>`).join("")}</tbody></table>` : ""}${detailList(moreHours)}</details>` : ""}</div></div>
    <div class="pd-info-row">${icon("ticket")}<div><h3>ค่าเข้าชม</h3>${summary(admission)}${fees}</div></div>
    <div class="pd-info-row pd-contacts">${icon("phone")}<div><h3>ช่องทางติดต่อ</h3>${summary(contact)}${contact.details.length ? contactItem(contact.details[0]) : `<p>ยังไม่มีช่องทางติดต่อที่ยืนยัน</p>`}${contact.details.length > 1 ? `<details class="pd-disclosure" data-pd-disclosure="contacts"><summary>ช่องทางทั้งหมด ${icon("chevron-down")}</summary>${contact.details.slice(1).map(contactItem).join("")}</details>` : ""}</div></div>
    <div class="pd-info-row">${icon("calendar-days")}<div><h3>วันหยุด</h3><p>${esc(closureText)}</p></div></div>
  </div>${notice ? `<p class="pd-visit-notice">${esc(notice)}</p>` : ""}`;
}
export const modeIcon = mode => ({ boat: "ship", rail: "tram-front", bus: "bus-front", van: "bus-front", walk: "map-pin" })[mode] || "route";
export function distanceLabel(route) {
  return Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0 ? `ประมาณ ${route.distanceMeters >= 1000 ? `${Number((route.distanceMeters / 1000).toFixed(2))} กม.` : `${Math.round(route.distanceMeters)} ม.`}` : "ไม่ระบุระยะ";
}
export function renderTravel(view, record) {
  const levels = { high: ["สูง", "high", 100], "medium-high": ["ค่อนข้างสูง", "high", 82], accepted_province_match: ["ตรงระดับจังหวัด", "medium", 68], medium: ["ปานกลาง", "medium", 58], low: ["ควรตรวจซ้ำ", "low", 34], unknown: ["รอตรวจซ้ำ", "low", 28] };
  const travel = record.travelDetail || {}, level = levels[travel.confidence];
  return `<div class="pd-confidence" data-level="${level?.[1] || "unknown"}"><div class="pd-confidence-copy"><strong>ความมั่นใจข้อมูล: ${level ? level[0] : "ยังไม่ระบุ"}</strong>${travel.updatedAt ? `<small>ข้อมูลการเดินทางอัปเดตเมื่อ ${esc(dateLabel(travel.updatedAt))}</small>` : ""}</div><div class="pd-confidence-meter">${level ? `<span class="pd-confidence-bar" aria-hidden="true"><i style="width:${level[2]}%"></i></span>` : `<span>ยังไม่มีระดับความมั่นใจ</span>`}<details class="pd-confidence-help" data-pd-disclosure="confidence"><summary aria-label="ความหมายระดับความมั่นใจ">${icon("info")}</summary><div><strong>ระดับตามเกณฑ์ของชุดข้อมูล</strong><p>สีเขียว: ข้อมูลยืนยันได้ดี<br>สีทอง: ใช้เป็นแนวทาง<br>สีน้ำตาลอ่อน: ควรตรวจสอบซ้ำ</p><p>ไม่ใช่เปอร์เซ็นต์ความถูกต้อง ควรตรวจสอบเส้นทางก่อนเดินทาง</p></div></details></div></div>
    <header class="pd-section-heading">${renderIconMedallion(icon("route"), "pd-medallion")}<div><h2>วิธีเดินทาง</h2><p>ระยะประมาณจากชุดข้อมูล ไม่ใช่ระยะเดินตามเส้นทางจริง</p></div><a class="pd-all-link" data-place-map-link ${mapUrl(record) ? `href="${esc(mapUrl(record))}"` : "hidden"} target="_blank" rel="noopener">ดูเส้นทางบนแผนที่ ${icon("arrow-right")}</a></header>
    ${!view.routes.length ? `<p class="pd-empty">ยังไม่มีข้อมูลจุดขนส่งสำหรับสถานที่นี้</p>${travel.summary ? `<p>${esc(travel.summary)}</p>` : ""}` : `<div class="pd-travel-toolbar" data-pd-enhanced hidden><div class="pd-filters" role="group" aria-label="วิธีเดินทาง"><button type="button" data-pd-mode="all" aria-pressed="true">${icon("bus-front")}ทั้งหมด</button>${view.sections.map(s => `<button type="button" data-pd-mode="${esc(s.mode)}" aria-pressed="false">${icon(modeIcon(s.mode))}${esc(s.label)}</button>`).join("")}</div><button class="pd-show-all" type="button" data-pd-stops-more hidden aria-expanded="false" aria-controls="pd-stops">ดูทั้งหมด</button></div><h3 id="pd-results-heading" class="pd-sr-only" tabindex="-1">จุดขึ้น–ลงและเส้นทาง</h3><p class="pd-sr-only" data-pd-travel-status role="status"></p><div class="pd-stops" id="pd-stops">${view.routes.map((r, i) => {
    const chips = String(r.routeText || "").split(/[·,]/).map(s => s.trim()).filter(Boolean);
    const groupedMode = r.mode === "bus" || r.mode === "van";
    const title = r.mode === "bus" ? "รถประจำทาง" : r.mode === "van" ? "รถตู้" : r.mode === "boat" ? `เรือ · ${r.stop}` : r.stop;
    const preview = [r.mode === "van" ? r.stop : "", r.routeText || r.operatorText || r.shortLabel].filter(Boolean).join(" · ");
    return `<article class="pd-stop pd-mode-${esc(r.mode)}" data-pd-stop="${esc(r.id || `stop-${i}`)}" data-mode="${esc(r.mode)}" data-distance="${Number.isFinite(r.distanceMeters) ? r.distanceMeters : Number.MAX_SAFE_INTEGER}"><div class="pd-stop-heading">${icon(modeIcon(r.mode))}<div><h3>${esc(title)}</h3><p class="pd-distance">${esc(distanceLabel(r))}</p></div></div><p class="pd-stop-preview">${esc(preview)}</p><details class="pd-stop-details pd-disclosure" data-pd-disclosure="stop-${esc(r.id || i)}"><summary>ดูรายละเอียดเส้นทาง ${icon("arrow-right")}</summary><div>${groupedMode ? `<p class="pd-stop-name">${esc(r.stop)}</p>` : ""}<p class="pd-stop-meta">${esc([r.operatorText, r.typeText, r.direction, r.isTransfer ? "มีเรือข้ามฟาก" : ""].filter(Boolean).join(" · "))}</p><div class="pd-route-chips">${chips.map(c => `<span>${esc(c)}</span>`).join("")}</div>${safeLink(r.locationUrl) ? `<p>${link("เปิดพิกัดจุดขึ้น–ลง", r.locationUrl)}</p>` : ""}</div></details></article>`;
  }).join("")}</div>`}`;
}
