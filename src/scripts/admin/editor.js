import { sitePlaceholderImage } from "../../lib/image-placeholder.js";
import { adminIcon } from "./design.js";
import { mediaProviderStatus } from "./data.js";
import { renderVisitEditor, renderVisitSummary } from "./visit-content.js";
import { createTempleList } from "./temple-list.js";
import { createTempleEditorControls } from "./temple-editor-controls.js";
import { dateLabel } from "../../lib/place-detail-view.js";

export function createTempleEditor({ state, rememberTempleListScroll, setTitle, setTopActions, setStatus, closeTempleEditor, escapeHtml, $, TEMPLE_COLLECTIONS, empty, restoreTempleListScroll, collectionTemples, TEMPLE_IMAGE_FIELDS }) {
const templeList = createTempleList({ state, collections: TEMPLE_COLLECTIONS, imageValue: templeImageValue, rerender: renderTemples, setStatus });
const templeEditorControls = createTempleEditorControls({ state, getRecord: currentTempleRecord, getEdit: currentTempleEdit, render: renderTemples, setStatus, cancel: closeTempleEditor });
function templeRecords() {
  state.content.temples ||= {};
  state.content.temples.records ||= {};
  return state.content.temples.records;
}

function templeOrders() {
  state.content.temples ||= {};
  state.content.temples.order ||= {};
  return state.content.temples.order;
}

function currentTempleRecord() {
  const visibleCatalog = filteredTempleCatalog();
  if (!state.selectedTempleKey) state.selectedTempleKey = visibleCatalog[0]?.key || "";
  return (
    state.templeCatalog.find((item) => item.key === state.selectedTempleKey) ||
    visibleCatalog[0] ||
    null
  );
}

function currentTempleEdit({ create = true } = {}) {
  const record = currentTempleRecord();
  if (!record) return null;
  const records = templeRecords();
  if (!create) return records[record.key] || null;
  records[record.key] ||= {
    key: record.key,
    collection: record.collection,
    slug: record.slug,
    source: record.source || "dataset",
    status: "active",
    fields: {},
    images: {},
  };
  return records[record.key];
}

function templeValue(record, edit, field) {
  return edit?.fields?.[field] ?? record?.temple?.[field] ?? "";
}

function filteredTempleCatalog() {
  const query = normalizeAdminSearch(state.templeSearch);
  return state.templeCatalog.filter((item) => {
    if (item.collection !== state.templeCollectionFilter) return false;
    if (!query) return true;
    return normalizeAdminSearch(`${item.temple.name} ${item.temple.province} ${item.temple.district}`).includes(query);
  });
}

function normalizeAdminSearch(value = "") {
  return String(value).trim().toLocaleLowerCase("th").normalize("NFC");
}

function renderTemples({ rememberScroll = true } = {}) {
  templeEditorControls.capture();
  if (rememberScroll) rememberTempleListScroll();
  const collection = TEMPLE_COLLECTIONS.find(item => item.key === state.templeCollectionFilter);
  setTitle(collection?.label || "วัดและสถานที่", "จัดการเนื้อหา");
  $(".mw-admin-main").classList.add("is-temple-list");
  $(".mw-admin-main").classList.toggle("has-temple-draft", state.dirty);
  $("#adminDescription").textContent = "จัดการรายการวัด สถานที่ และข้อมูลที่แสดงบนเว็บไซต์";
  const record = currentTempleRecord();
  const edit = currentTempleEdit({ create: false });
  setTopActions(`<a class="mw-admin-btn mw-temples-open-public" href="/temples/${state.templeCollectionFilter}/" target="_blank" rel="noopener">${adminIcon("external-link")}ดูหน้าเว็บ</a><button class="mw-admin-btn mw-admin-btn-primary mw-temples-add" type="button" data-action="add-temple" aria-label="เพิ่มวัด" title="เพิ่มวัด">${adminIcon("plus")}<span>เพิ่มวัด</span></button>`);

  $("#adminContent").innerHTML = `${templeList.render()}${state.templeEditorOpen && record ? renderTempleDrawer(record, edit) : ""}`;
  templeEditorControls.mount();
  restoreTempleListScroll();
}

function renderTempleTableRow(record) {
  const image = templeImageValue(record, templeRecords()[record.key], "card", "desktop");
  const confidence = templeConfidence(record);
  const status = record.source === "admin" ? "เพิ่มผ่าน CMS" : "ฐานข้อมูลวัด";
  return `<div class="mw-admin-temple-table-row" role="row" data-temple-row="${escapeHtml(record.key)}">
    <div class="mw-admin-temple-name-cell">
      <span class="mw-admin-table-thumb"><img src="${escapeHtml(image || sitePlaceholderImage)}" alt="" data-admin-temple-image data-fallback-src="${sitePlaceholderImage}"></span>
      <div><strong data-temple-table-title>${escapeHtml(record.temple.name || "ยังไม่มีชื่อ")}</strong><small><i style="--dot:${escapeHtml(confidence.color)}"></i>${escapeHtml(confidence.label)}</small></div>
    </div>
    <div><strong>${escapeHtml(record.temple.region || "ไม่ระบุภูมิภาค")}</strong><small>${escapeHtml([record.temple.province, record.temple.district].filter(Boolean).join(" / ") || "ยังไม่มีที่ตั้ง")}</small></div>
    <div>${escapeHtml(record.temple.placeType || "ยังไม่ระบุ")}</div>
    <div><mark class="${record.source === "admin" ? "is-draft" : ""}"><i></i>${escapeHtml(status)}</mark></div>
    <div class="mw-admin-table-actions">
      <button class="mw-admin-btn mw-admin-btn-icon" type="button" data-edit-temple="${escapeHtml(record.key)}" title="แก้ไข" aria-label="แก้ไข ${escapeHtml(record.temple.name || "สถานที่")}">${adminIcon("pencil-line")}</button>
      <button class="mw-admin-btn mw-admin-btn-icon mw-admin-btn-danger" type="button" data-action="delete-temple" data-delete-temple-key="${escapeHtml(record.key)}" title="ลบ" aria-label="ลบ ${escapeHtml(record.temple.name || "สถานที่")}">${adminIcon("trash")}</button>
    </div>
  </div>`;
}

function templeConfidence(record) {
  const status = record.visitInfo?.status || "";
  if (status === "verified") return { label: "มั่นใจสูง", color: "#276a52" };
  if (status === "listed") return { label: "ปานกลาง", color: "#c28d35" };
  return { label: "ควรตรวจสอบ", color: "#9b8578" };
}

function renderTempleDrawer(record, edit) {
  const confidence = templeConfidence(record);
  const reviewed = dateLabel(edit?.visitInfo?.reviewedAt ?? record.visitInfo?.reviewedAt);
  const steps = [["place", "ข้อมูลสถานที่", "ข้อมูลพื้นฐานของวัด/สถานที่"], ["visit", "ข้อมูลเข้าชม", "เวลา ค่าเข้าชม และการติดต่อ"], ["images", "รูปภาพ", "รูปภาพและสื่อประกอบ"]];
  return `<div class="mw-admin-drawer-overlay mw-place-editor-overlay is-open" data-drawer-overlay>
    <aside class="mw-admin-drawer mw-place-editor" role="dialog" aria-modal="true" aria-labelledby="templeDrawerTitle">
      <header>
        <div class="mw-place-editor-heading"><div><h2 id="templeDrawerTitle" tabindex="-1">แก้ไขข้อมูลวัด/สถานที่</h2><p data-temple-editor-name>${escapeHtml(templeValue(record, edit, "name") || "สถานที่ใหม่")}</p></div><span class="mw-place-editor-confidence"><i style="background:${confidence.color}"></i>${escapeHtml(confidence.label)}</span></div>
        ${reviewed ? `<p class="mw-place-editor-reviewed">ตรวจทานข้อมูลเข้าชม<br><time>${escapeHtml(reviewed)}</time></p>` : ""}
        <button type="button" data-action="close-temple-editor" aria-label="ปิด" title="ปิด">${adminIcon("x")}</button>
      </header>
      <nav class="mw-place-editor-steps" aria-label="ส่วนแก้ไขสถานที่">${steps.map(([id, title, detail], index) => `<button type="button" data-editor-jump="${id}" ${templeEditorControls.active() === id ? 'aria-current="step"' : ""} aria-controls="temple-editor-${id}"><b>0${index + 1}</b><span><strong>${title}</strong><small>${detail}</small></span></button>`).join("")}</nav>
      <div class="mw-admin-drawer-body">${renderTempleEditor(record, edit)}</div>
      <footer>
        <button class="mw-admin-btn" type="button" data-action="close-temple-editor">ยกเลิก</button>
        <p role="status" data-temple-editor-status>${state.dirty ? "มีการแก้ไขที่ยังไม่ได้เผยแพร่" : ""}</p>
        <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="save-temple-editor">บันทึก</button>
      </footer>
    </aside>
  </div>`;
}

function renderTempleListItem(record) {
  const image = templeImageValue(record, templeRecords()[record.key], "card", "desktop");
  const reorderDisabled = Boolean(state.templeSearch);
  const collectionItems = collectionTemples(record.collection);
  const collectionIndex = collectionItems.findIndex((item) => item.key === record.key);
  const isActive = record.key === state.selectedTempleKey;
  const disableMoveUp = reorderDisabled || collectionIndex <= 0;
  const disableMoveDown = reorderDisabled || collectionIndex < 0 || collectionIndex >= collectionItems.length - 1;
  return `<div class="mw-admin-temple-list-item ${record.key === state.selectedTempleKey ? "is-active" : ""}" data-temple-row="${escapeHtml(record.key)}">
    ${isActive ? `<span class="mw-admin-temple-move-controls" aria-label="เลื่อนอันดับ ${escapeHtml(record.temple.name || "สถานที่")}">
      <button type="button" data-temple-move-key="${escapeHtml(record.key)}" data-temple-move-offset="-1" aria-label="เลื่อนขึ้นหนึ่งอันดับ" title="${reorderDisabled ? "ล้างคำค้นหาเพื่อจัดลำดับ" : "เลื่อนขึ้นหนึ่งอันดับ"}" ${disableMoveUp ? "disabled" : ""}>↑</button>
      <button type="button" data-temple-move-key="${escapeHtml(record.key)}" data-temple-move-offset="1" aria-label="เลื่อนลงหนึ่งอันดับ" title="${reorderDisabled ? "ล้างคำค้นหาเพื่อจัดลำดับ" : "เลื่อนลงหนึ่งอันดับ"}" ${disableMoveDown ? "disabled" : ""}>↓</button>
    </span>` : ""}
    <button type="button" class="mw-admin-temple-list-select" data-select-temple="${escapeHtml(record.key)}">
      <span class="mw-admin-temple-list-thumb"><img src="${escapeHtml(image || sitePlaceholderImage)}" alt="" data-admin-temple-image data-fallback-src="${sitePlaceholderImage}"></span>
      <span><strong data-temple-list-title>#${escapeHtml(record.temple.rank || "-")} ${escapeHtml(record.temple.name || "ยังไม่มีชื่อ")}</strong><small>${escapeHtml([record.temple.province, record.temple.district].filter(Boolean).join(" / ") || "ยังไม่มีที่ตั้ง")}</small></span>
      ${record.source === "admin" ? '<b>CMS</b>' : ""}
    </button>
    <button type="button" class="mw-admin-temple-drag-handle" draggable="${reorderDisabled ? "false" : "true"}" data-temple-drag-key="${escapeHtml(record.key)}" aria-label="จัดลำดับ ${escapeHtml(record.temple.name || "สถานที่")}" title="${reorderDisabled ? "ล้างคำค้นหาเพื่อจัดลำดับ" : "ลากเพื่อจัดลำดับ ใช้ปุ่มลูกศรขึ้นลงบนคีย์บอร์ดได้"}" ${reorderDisabled ? "disabled" : ""}>⋮⋮</button>
  </div>`;
}

function renderTempleEmptyState() {
  return `<div class="mw-admin-temple-empty">
    <strong>ยังไม่มีสถานที่ในหมวดนี้</strong>
    <p>เริ่มสร้างสถานที่แรก แล้วเพิ่มรูปสำหรับหน้ารายการ แบนเนอร์ และแผนที่ได้ทันที</p>
    <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="add-temple">+ เพิ่มสถานที่</button>
  </div>`;
}

function renderTempleEditor(record, edit) {
  const provider = mediaProviderStatus(state.media, state.mediaLoadError);
  const field = (key, label, classes = "", attrs = "") => `<label class="${classes}"><span>${label}${key === "name" ? '<i class="mw-place-required" aria-hidden="true">*</i>' : ""}</span><input aria-label="${label}" data-temple-field="${key}" value="${escapeHtml(templeValue(record, edit, key))}" ${attrs}></label>`;
  const area = (key, label) => `<label class="mw-place-field-${key}"><span>${label}<button type="button" data-editor-manual="${key}" aria-label="กรอก${label}เอง" title="กรอก${label}เอง">${adminIcon("pencil-line")}</button></span><span class="mw-place-location-control"><select data-temple-field="${key}" aria-label="${label}"><option value="">ยังไม่ระบุ</option>${templeEditorControls.choices(key).map(value => `<option value="${escapeHtml(value)}" ${templeValue(record, edit, key) === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></span></label>`;
  const text = (key, label, classes = "", rows = 3) => `<label class="${classes}"><span>${label}</span><textarea aria-label="${label}" data-temple-field="${key}" rows="${rows}">${escapeHtml(templeValue(record, edit, key))}</textarea></label>`;
  const heading = (number, name, title, detail) => `<summary class="mw-place-editor-section-heading"><span class="mw-place-editor-section-icon">${adminIcon(name)}</span><span><strong><b>${number}</b>${title}</strong><small>${detail}</small></span>${adminIcon("chevron-down")}</summary>`;
  return `<section class="mw-place-editor-section"><details id="temple-editor-place" data-editor-panel="place" ${templeEditorControls.isOpen("place") ? "open" : ""}>
    ${heading("01", "file-text", "ข้อมูลสถานที่", "ข้อมูลพื้นฐานของวัด/สถานที่")}
    <div class="mw-place-editor-fields">
      ${field("name", "ชื่อสถานที่", "mw-place-field-name", "required maxlength=200")}
      ${area("region", "ภูมิภาค")}${area("province", "จังหวัด / เขต")}${area("district", "อำเภอ / เขต")}
      ${text("coordinateAddress", "ที่อยู่", "mw-place-field-address", 2)}
      <div class="mw-place-coordinates">${field("plusCode", "Plus Code")}${field("latitude", "พิกัด LAT", "", 'type="number" step="any" min="-90" max="90" inputmode="decimal"')}${field("longitude", "พิกัด LNG", "", 'type="number" step="any" min="-180" max="180" inputmode="decimal"')}</div>
      ${text("summary", "คำแนะนำสถานที่", "mw-place-field-summary", 3)}${text("description", "รายละเอียดสถานที่", "mw-place-field-description", 3)}
    </div>
    <details class="mw-place-editor-extra" data-editor-panel="extra" ${templeEditorControls.isOpen("extra") ? "open" : ""}><summary>${adminIcon("chevron-down")}<strong>ข้อมูลเพิ่มเติม</strong><small>ประเภท การเดินทาง และข้อมูลประกอบ</small></summary><div class="mw-admin-form-grid">
      ${field("placeType", "ประเภท")}${field("travelModes", "รูปแบบการเดินทาง")}${field("blessings", "พรที่นิยมขอ")}${field("objectHero", "สิ่งที่นิยมสักการะ")}${text("imageAlt", "คำอธิบาย", "mw-admin-form-grid--span")}${field("imageSourceLabel", "เครดิตภาพ")}${field("imageSourceUrl", "ลิงก์แหล่งที่มาของภาพ", "", 'type="url"')}
    </div><div class="mw-place-editor-record-actions">${state.publishedTempleKeys.has(record.key) ? `<a class="mw-admin-btn" target="_blank" rel="noopener" href="${escapeHtml(record.detailUrl)}">${adminIcon("external-link")}เปิดหน้าจริง</a>` : '<span>ฉบับร่างใหม่ · ยังไม่เผยแพร่</span>'}<button class="mw-admin-btn mw-admin-btn-danger" type="button" data-action="delete-temple">${adminIcon("trash")}นำออกจากหมวด</button></div></details>
  </details></section>
  <section class="mw-place-editor-section mw-place-editor-visit"><details id="temple-editor-visit" data-editor-panel="visit" ${templeEditorControls.isOpen("visit") ? "open" : ""}>
    ${heading("02", "clock", "ข้อมูลเข้าชม", "เวลาเปิด–ปิด ค่าเข้าชม และช่องทางติดต่อ")}
    <div class="mw-place-editor-visit-fields">${renderVisitEditor(record, edit, escapeHtml, templeEditorControls.isOpen)}</div>
  </details>${renderVisitSummary(record, edit, escapeHtml)}</section>
  <section class="mw-place-editor-section mw-place-editor-images"><details id="temple-editor-images" data-editor-panel="images" ${templeEditorControls.isOpen("images") ? "open" : ""}>
    ${heading("03", "image", "รูปภาพ", "ภาพหน้ารายการ หน้ารายละเอียด และแผนที่")}
    <div class="mw-place-media-toolbar" title="${escapeHtml(provider)}"><div role="group" aria-label="รูปภาพตามอุปกรณ์">${[["desktop", "monitor", "เดสก์ท็อป"], ["mobile", "smartphone", "มือถือ"]].map(([view, icon, label]) => `<button type="button" data-editor-viewport="${view}" aria-pressed="${templeEditorControls.variant() === view}">${adminIcon(icon)}${label}</button>`).join("")}</div><span>${escapeHtml(provider)}</span></div>
    <div class="mw-admin-temple-image-groups">${TEMPLE_IMAGE_FIELDS.map((field) => renderTempleImageGroup(record, edit, field)).join("")}</div>
  </details></section>`;
}

function renderTempleImageGroup(record, edit, field) {
  return `<section class="mw-admin-temple-image-group">
    <header><h4>${escapeHtml(field.label)}</h4><span>${escapeHtml(field.ratioLabel)}</span></header>
    <div class="mw-admin-temple-image-variants">
      ${renderTempleImageField(record, edit, field, "desktop", "เดสก์ท็อปและแท็บเล็ต")}
      ${renderTempleImageField(record, edit, field, "mobile", "มือถือ")}
    </div>
  </section>`;
}

function renderTempleImageField(record, edit, field, viewport, label) {
  const url = templeImageValue(record, edit, field.role, viewport);
  const inputId = `temple-image-${field.role}-${viewport}`;
  return `<div class="mw-admin-image-field" data-image-role="${field.role}" data-image-viewport="${viewport}" data-image-ratio="${field.ratio}" ${templeEditorControls.variant() === viewport ? "" : "hidden"}>
    <div class="mw-admin-image-preview" style="aspect-ratio:${field.ratio}">
      ${url ? `<img src="${escapeHtml(url)}" alt="" data-admin-temple-image>` : `<span>ยังไม่มีรูป</span>`}
    </div>
    <div class="mw-admin-image-url-row">
      <input id="${inputId}" type="url" value="${escapeHtml(url)}" placeholder="วางลิงก์รูปภาพ HTTPS" aria-label="URL ${escapeHtml(field.label)} ${escapeHtml(label)}" data-image-url>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="use-temple-image-url" aria-label="ใช้ลิงก์" title="ใช้ลิงก์">${adminIcon("check")}</button>
    </div>
    <div class="mw-admin-image-actions">
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-editor-upload title="อัปโหลด">${adminIcon("upload")}<span>อัปโหลด</span></button><input type="file" accept="image/*" data-temple-image-upload aria-label="อัปโหลด ${escapeHtml(field.label)} ${escapeHtml(label)}" hidden>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="crop-temple-image" title="ครอปรูป" aria-label="ครอปรูป" ${url ? "" : "disabled"}>${adminIcon("crop")}</button>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="reuse-temple-image" title="ใช้รูปเดิม" aria-label="ใช้รูปเดิม">${adminIcon("copy")}</button>
      <button class="mw-admin-btn mw-admin-btn-sm mw-admin-btn-danger" type="button" data-action="clear-temple-image" title="ลบรูป" aria-label="ลบรูป" ${url ? "" : "disabled"}>${adminIcon("trash")}</button>
    </div>
  </div>`;
}

function templeImageValue(record, edit, role, viewport) {
  const url = value => typeof value === "string" ? value : value?.url;
  return (
    url(edit?.images?.[role]?.[viewport]) ??
    url(record?.temple?.images?.[role]?.[viewport]) ??
    (viewport === "mobile"
      ? url(edit?.images?.[role]?.desktop) ?? url(record?.temple?.images?.[role]?.desktop)
      : undefined) ??
    edit?.fields?.imageUrl ??
    record?.temple?.imageUrl ??
    ""
  );
}

return { templeRecords, templeOrders, currentTempleRecord, currentTempleEdit, templeValue, filteredTempleCatalog, normalizeAdminSearch, renderTemples, renderTempleTableRow, templeConfidence, renderTempleDrawer, renderTempleListItem, renderTempleEmptyState, renderTempleEditor, renderTempleImageGroup, renderTempleImageField, templeImageValue, templeList, templeEditorControls };
}
