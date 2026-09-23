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
  if (kind === "contact" && section.website && !details.some(d => d.term === "เว็บไซต์")) add("เว็บไซต์", section.website, section.website);
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
  return `<p>${esc(r.description ?? `${r.name} อยู่ใน${r.province || "ประเทศไทย"}${r.district ? ` เขต/อำเภอ ${r.district}` : ""} เป็นหนึ่งในสถานที่ใน${vm.collectionLabel} สำหรับเลือกเส้นทางไหว้พระและวางแผนการเดินทาง`)}</p>${topics.length ? `<div class="pd-topics">${expandable(topics, 6, "topics", t => `<span>${icon("sparkles")}${esc(t)}</span>`)}</div>` : ""}${objects.length ? `<div class="pd-worship"><h3>สิ่งที่นิยมสักการะ</h3><div class="pd-objects">${expandable(objects, 5, "objects", t => `<span>${esc(t)}</span>`)}</div></div>` : ""}`;
}
export function renderLocation(vm) {
  const r = vm.record;
  return `<div class="pd-map-meta"><div><h2>พิกัดและที่อยู่</h2><p>${vm.coords ? esc(vm.coords.map(v => v.toFixed(6)).join(", ")) : "ยังไม่มีพิกัดสำหรับแผนที่ภายใน"}</p></div><a class="pd-button pd-button--jade" data-place-map-link href="${esc(vm.mapHref)}" ${!vm.mapHref ? "hidden" : ""} target="_blank" rel="noopener">เปิดใน Google Maps ${icon("arrow-right")}</a></div>${detailList([["ที่อยู่", r.coordinateAddress], ["จังหวัด", r.province], ["เขต / อำเภอ", r.district], ["ประเภท", r.placeType], ["การเดินทาง", list(r.travelModes).join(" · ")]].filter(([, v]) => v).map(([term, value]) => ({ term, value })))}`;
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
  return `${reviewedAt ? `<p class="pd-reviewed">ข้อมูลเข้าชมตรวจทานเมื่อ ${esc(dateLabel(reviewedAt))}</p>` : ""}<div class="pd-visit-columns"><div class="pd-visit-summary"><div class="pd-info-row">${icon("clock")}<div><h3>เวลาเปิด–ปิด</h3><p>${esc(hoursSummary(hours))}</p>${hours.timetable.length ? `<details class="pd-disclosure" data-pd-disclosure="hours"><summary>ดูเวลารายวัน ${icon("chevron-down")}</summary><table><tbody>${hours.timetable.map(r => `<tr><th scope="row">${esc(r.day)}</th><td>${esc(r.time)}</td></tr>`).join("")}</tbody></table></details>` : ""}${detailList(hours.details.filter(d => !["วันหยุด", "เวลาปกติ"].includes(d.term)))}</div></div><div class="pd-info-row">${icon("ticket")}<div><h3>ค่าเข้าชม</h3>${fees}</div></div><div class="pd-info-row">${icon("calendar-days")}<div><h3>วันหยุด</h3><p>${esc(closureText)}</p></div></div></div><div class="pd-contacts"><h3>ช่องทางติดต่อ</h3>${contact.details.length ? contact.details.map(d => `<div class="pd-info-row">${icon(d.term === "โทรศัพท์" ? "phone" : d.term === "อีเมล" ? "mail" : "globe")}<div><h4>${esc(d.term)}</h4><p>${link(d.value, d.href)}</p></div></div>`).join("") : `<p>ยังไม่มีช่องทางติดต่อที่ยืนยัน</p>`}</div></div>${notice ? `<p class="pd-visit-notice">${esc(notice)}</p>` : ""}`;
}
export const modeIcon = mode => ({ boat: "ship", rail: "train-front", bus: "bus-front", van: "bus", walk: "map-pin" })[mode] || "route";
export function distanceLabel(route) {
  return Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0 ? `ประมาณ ${route.distanceMeters >= 1000 ? `${Number((route.distanceMeters / 1000).toFixed(2))} กม.` : `${Math.round(route.distanceMeters)} ม.`}` : "ไม่ระบุระยะ";
}
export function renderTravel(view, record) {
  const levels = { high: ["สูง", "high", 100], "medium-high": ["ค่อนข้างสูง", "high", 82], accepted_province_match: ["ตรงระดับจังหวัด", "medium", 68], medium: ["ปานกลาง", "medium", 58], low: ["ควรตรวจซ้ำ", "low", 34], unknown: ["รอตรวจซ้ำ", "low", 28] };
  const travel = record.travelDetail || {}, level = levels[travel.confidence];
  const quick = ["boat", "rail", "bus", "van"].map(mode => view.recommendations.find(r => r.route.mode === mode)?.route || view.routes.find(r => r.mode === mode)).filter(Boolean);
  return `<div class="pd-confidence" data-level="${level?.[1] || "unknown"}"><div><strong>ความมั่นใจข้อมูลการเดินทาง: ${level ? level[0] : "ยังไม่มีระดับความมั่นใจ"}</strong>${level ? `<span class="pd-confidence-bar" aria-hidden="true"><i style="width:${level[2]}%"></i></span>` : ""}<details class="pd-confidence-help" data-pd-disclosure="confidence"><summary aria-label="ความหมายระดับความมั่นใจ">${icon("info")}</summary><div><strong>ระดับตามเกณฑ์ของชุดข้อมูล</strong><p>สีเขียว: ข้อมูลยืนยันได้ดี<br>สีทอง: ใช้เป็นแนวทาง<br>สีน้ำตาลอ่อน: ควรตรวจสอบซ้ำ</p><p>ไม่ใช่เปอร์เซ็นต์ความถูกต้อง ควรตรวจสอบเส้นทางก่อนเดินทาง</p></div></details></div>${travel.updatedAt ? `<small>ข้อมูลการเดินทางอัปเดตเมื่อ ${esc(dateLabel(travel.updatedAt))}</small>` : ""}</div><header class="pd-section-heading">${renderIconMedallion(icon("route"), "pd-medallion")}<div><h2>วิธีเดินทาง</h2><p>ระยะประมาณจากชุดข้อมูล ไม่ใช่ระยะเดินตามเส้นทางจริง</p></div></header>${!view.routes.length ? `<p class="pd-empty">ยังไม่มีข้อมูลจุดขนส่งสำหรับสถานที่นี้</p>${travel.summary ? `<p>${esc(travel.summary)}</p>` : ""}` : `<div class="pd-quick-modes">${quick.map(r => `<button type="button" data-pd-enhanced hidden data-pd-quick="${esc(r.mode)}" data-stop-key="${esc(r.id)}" class="pd-quick pd-mode-${esc(r.mode)}">${icon(modeIcon(r.mode))}<span><small>${esc(r.shortLabel)}${view.recommendations.some(item => item.label === "ใกล้สุด" && item.route.id === r.id) ? " · ใกล้สุดในข้อมูล" : ""}</small><strong>${esc(r.stop)}</strong><span>${esc(distanceLabel(r))}</span></span></button>`).join("")}</div><div class="pd-filters" role="group" aria-label="วิธีเดินทาง" data-pd-enhanced hidden><button type="button" data-pd-mode="all" aria-pressed="true">ทั้งหมด</button>${view.sections.map(s => `<button type="button" data-pd-mode="${esc(s.mode)}" aria-pressed="false">${esc(s.label)}</button>`).join("")}</div><h3 id="pd-results-heading" class="pd-sr-only" tabindex="-1">จุดขึ้น–ลงและเส้นทาง</h3><p class="pd-sr-only" data-pd-travel-status role="status"></p><div class="pd-stops">${view.routes.map((r, i) => {
    const chips = String(r.routeText || "").split(/[·,]/).map(s => s.trim()).filter(Boolean);
    return `<article class="pd-stop pd-mode-${esc(r.mode)}" data-pd-stop="${esc(r.id || `stop-${i}`)}" data-mode="${esc(r.mode)}">${icon(modeIcon(r.mode))}<div><h3>${esc(r.stop)}</h3><p class="pd-distance">${esc(distanceLabel(r))}</p><p class="pd-stop-meta">${esc([r.operatorText, r.typeText, r.direction, r.isTransfer ? "มีเรือข้ามฟาก" : ""].filter(Boolean).join(" · "))}</p><div class="pd-route-chips">${chips.slice(0, 5).map(c => `<span>${esc(c)}</span>`).join("")}</div>${chips.length > 5 ? `<details class="pd-disclosure" data-pd-disclosure="routes-${esc(r.id || i)}"><summary>ดูสายเพิ่มเติม (+${chips.length - 5}) ${icon("chevron-down")}</summary><div class="pd-route-chips">${chips.slice(5).map(c => `<span>${esc(c)}</span>`).join("")}</div></details>` : ""}${safeLink(r.locationUrl) ? `<p>${link("เปิดพิกัดจุดขึ้น–ลง", r.locationUrl)}</p>` : ""}</div></article>`;
  }).join("")}</div><button class="pd-show-all" type="button" data-pd-stops-more hidden aria-expanded="false">ดูจุดเดินทางทั้งหมด</button>`}`;
}
