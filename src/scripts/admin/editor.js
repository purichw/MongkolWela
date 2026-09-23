import { adminIcon } from "./design.js";
import { mediaProviderStatus } from "./data.js";

export function createTempleEditor({ state, rememberTempleListScroll, setTitle, setTopActions, escapeHtml, $, TEMPLE_COLLECTIONS, empty, restoreTempleListScroll, collectionTemples, TEMPLE_IMAGE_FIELDS }) {
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
    visibleCatalog.find((item) => item.key === state.selectedTempleKey) ||
    visibleCatalog[0] ||
    state.templeCatalog.find((item) => item.key === state.selectedTempleKey) ||
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
  if (rememberScroll) rememberTempleListScroll();
  setTitle("วัดและสถานที่", "จัดการเนื้อหา");
  const visible = filteredTempleCatalog();
  const record = currentTempleRecord();
  const edit = currentTempleEdit({ create: false });
  setTopActions(`<label class="mw-admin-search-control"><span>ค้นหา</span><input type="search" value="${escapeHtml(state.templeSearch)}" placeholder="ค้นหา..." aria-label="ค้นหา" data-temple-search></label><button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="add-temple">+ เพิ่มวัด</button>`);

  $("#adminContent").innerHTML = `
    <div class="mw-admin-temple-tabs" role="tablist" aria-label="หมวดสถานที่">
      ${TEMPLE_COLLECTIONS.map((item) => {
        const count = state.templeCatalog.filter((temple) => temple.collection === item.key).length;
        return `<button type="button" role="tab" aria-selected="${item.key === state.templeCollectionFilter}" class="${item.key === state.templeCollectionFilter ? "is-active" : ""}" data-temple-collection="${item.key}">
          <strong>${escapeHtml(item.label)}</strong><span>${count.toLocaleString("th-TH")}</span>
        </button>`;
      }).join("")}
    </div>
    <div class="mw-admin-table-card">
      <div class="mw-admin-temple-table" role="table" aria-label="วัดและสถานที่">
        <div class="mw-admin-temple-table-head" role="row">
          <span>ชื่อสถานที่</span><span>พื้นที่</span><span>ประเภท</span><span>ที่มาข้อมูล</span><span>จัดการ</span>
        </div>
        ${visible.map((item) => renderTempleTableRow(item)).join("") || (state.templeLoadError ? `${empty("ยังไม่สามารถโหลดรายการสถานที่ได้")}<button class="mw-admin-btn" type="button" data-action="refresh-admin-data">โหลดข้อมูลอีกครั้ง</button>` : empty("ไม่พบสถานที่"))}
      </div>
    </div>
    ${state.templeEditorOpen && record ? renderTempleDrawer(record, edit) : ""}`;
  restoreTempleListScroll();
}

function renderTempleTableRow(record) {
  const image = templeImageValue(record, templeRecords()[record.key], "card", "desktop");
  const confidence = templeConfidence(record);
  const status = record.source === "admin" ? "เพิ่มผ่าน CMS" : "ฐานข้อมูลวัด";
  return `<div class="mw-admin-temple-table-row" role="row" data-temple-row="${escapeHtml(record.key)}">
    <div class="mw-admin-temple-name-cell">
      <span class="mw-admin-table-thumb">${image ? `<img src="${escapeHtml(image)}" alt="" data-admin-temple-image>` : "<i>ไม่มีรูป</i>"}</span>
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
  return `<div class="mw-admin-drawer-overlay is-open" data-drawer-overlay>
    <aside class="mw-admin-drawer" role="dialog" aria-modal="true" aria-labelledby="templeDrawerTitle">
      <header>
        <div><p>แก้ไขรายการ</p><h2 id="templeDrawerTitle">ข้อมูลวัด/สถานที่</h2></div>
        <button type="button" data-action="close-temple-editor" aria-label="ปิด" title="ปิด">${adminIcon("x")}</button>
      </header>
      <div class="mw-admin-drawer-body">${renderTempleEditor(record, edit)}</div>
      <footer>
        <button class="mw-admin-btn" type="button" data-action="close-temple-editor">ยกเลิก</button>
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
      <span class="mw-admin-temple-list-thumb">${image ? `<img src="${escapeHtml(image)}" alt="" data-admin-temple-image>` : "<i>ไม่มีรูป</i>"}</span>
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
  const templeLocation = [record.temple.province, record.temple.district].filter(Boolean).join(" / ") || "ยังไม่มีที่ตั้ง";
  const confidence = templeConfidence(record);
  return `<div class="mw-admin-temple-editor-head">
    <div>
      <p data-temple-editor-rank>${escapeHtml(record.collectionLabel)} · #${escapeHtml(record.temple.rank || "-")}</p>
      <h2 data-temple-editor-name>${escapeHtml(templeValue(record, edit, "name") || "สถานที่ใหม่")}</h2>
      <small>${escapeHtml(templeLocation)}</small>
    </div>
    <div>
      <a class="mw-admin-btn" target="_blank" rel="noopener" href="${escapeHtml(record.detailUrl)}">เปิดหน้าจริง</a>
      ${record.source === "admin"
        ? '<button class="mw-admin-btn mw-admin-btn-danger" type="button" data-action="delete-temple">ลบสถานที่</button>'
        : '<button class="mw-admin-btn mw-admin-btn-danger" type="button" data-action="delete-temple">นำออกจากหมวด</button>'}
    </div>
  </div>
  <div class="mw-admin-temple-section">
    <div class="mw-admin-temple-section-head"><div><span>01</span><h3>ข้อมูลสถานที่</h3></div><p><i style="--dot:${escapeHtml(confidence.color)}"></i>${escapeHtml(confidence.label)}</p></div>
    <div class="mw-admin-form-grid">
      <label>ชื่อสถานที่<input data-temple-field="name" value="${escapeHtml(templeValue(record, edit, "name"))}" required></label>
      <label>ภูมิภาค<input data-temple-field="region" value="${escapeHtml(templeValue(record, edit, "region"))}" placeholder="ภาคกลาง"></label>
      <label>จังหวัด / เขต<input data-temple-field="province" value="${escapeHtml(templeValue(record, edit, "province"))}" placeholder="กรุงเทพฯ / บางกอกน้อย"></label>
      <label>ประเภท<input data-temple-field="placeType" value="${escapeHtml(templeValue(record, edit, "placeType"))}" placeholder="ยังไม่ระบุ"></label>
      <label class="mw-admin-form-grid--span">รูปแบบการเดินทาง<input data-temple-field="travelModes" value="${escapeHtml(templeValue(record, edit, "travelModes"))}" placeholder="คั่นแต่ละรูปแบบด้วย ;"></label>
      <label>พิกัด LAT<input type="number" step="0.0001" data-temple-field="latitude" value="${escapeHtml(templeValue(record, edit, "latitude"))}"></label>
      <label>พิกัด LNG<input type="number" step="0.0001" data-temple-field="longitude" value="${escapeHtml(templeValue(record, edit, "longitude"))}"></label>
      <label class="mw-admin-form-grid--span">พรที่นิยมขอ<input data-temple-field="blessings" value="${escapeHtml(templeValue(record, edit, "blessings"))}" placeholder="เมตตามหานิยม, ชื่อเสียง"></label>
      <label class="mw-admin-form-grid--span">สิ่งที่นิยมสักการะ<input data-temple-field="objectHero" value="${escapeHtml(templeValue(record, edit, "objectHero"))}" placeholder="พระประธาน, ระฆังมงคล"></label>
      <label class="mw-admin-form-grid--span">คำอธิบาย<textarea data-temple-field="imageAlt" placeholder="วัดริมแม่น้ำเจ้าพระยา">${escapeHtml(templeValue(record, edit, "imageAlt"))}</textarea></label>
    </div>
  </div>
  <div class="mw-admin-temple-section">
    <div class="mw-admin-temple-section-head"><div><span>02</span><h3>ข้อมูลเข้าชม</h3></div><p>${escapeHtml(record.visitInfo?.status || "needs-direct-check")}</p></div>
    <div class="mw-admin-info-grid">
      <div><span>ตำแหน่ง</span><strong>${escapeHtml(templeLocation)}</strong></div>
      <div><span>การตรวจข้อมูล</span><strong>${escapeHtml(record.visitInfo?.notice || "กรุณาตรวจสอบกับสถานที่โดยตรง")}</strong></div>
      <div><span>แหล่งข้อมูล</span><strong>${escapeHtml((record.visitInfo?.sources || []).length ? `${record.visitInfo.sources.length} แหล่ง` : "ยังไม่มีแหล่งอ้างอิง")}</strong></div>
    </div>
  </div>
  <div class="mw-admin-temple-section">
    <div class="mw-admin-temple-section-head">
      <div><span>03</span><h3>รูปภาพ</h3></div>
      <p class="${state.media.provider ? "is-ready" : "is-warning"}">${escapeHtml(provider)}</p>
    </div>
    <p class="mw-admin-temple-media-note">แต่ละตำแหน่งแยกเดสก์ท็อปและมือถือ เพื่อเลือกจุดครอปที่เหมาะกับหน้าจอจริง รูปแผนที่จะใช้รูปหน้ารายการเป็นค่าเริ่มต้นถ้ายังไม่ได้กำหนด</p>
    <div class="mw-admin-temple-image-groups">
      ${TEMPLE_IMAGE_FIELDS.map((field) => renderTempleImageGroup(record, edit, field)).join("")}
    </div>
  </div>`;
}

function renderTempleImageGroup(record, edit, field) {
  return `<section class="mw-admin-temple-image-group">
    <header><div><h4>${escapeHtml(field.label)}</h4><span>${escapeHtml(field.ratioLabel)}</span></div><small>${field.role === "card" ? "หน้ารายการ" : field.role === "hero" ? "หน้ารายละเอียด" : "เมื่อเลือกหมุดแผนที่"}</small></header>
    <div class="mw-admin-temple-image-variants">
      ${renderTempleImageField(record, edit, field, "desktop", "เดสก์ท็อปและแท็บเล็ต")}
      ${renderTempleImageField(record, edit, field, "mobile", "มือถือ")}
    </div>
  </section>`;
}

function renderTempleImageField(record, edit, field, viewport, label) {
  const url = templeImageValue(record, edit, field.role, viewport);
  const inputId = `temple-image-${field.role}-${viewport}`;
  return `<div class="mw-admin-image-field" data-image-role="${field.role}" data-image-viewport="${viewport}" data-image-ratio="${field.ratio}">
    <div class="mw-admin-image-field-head"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(field.ratioLabel)}</span></div>
    <div class="mw-admin-image-preview" style="aspect-ratio:${field.ratio}">
      ${url ? `<img src="${escapeHtml(url)}" alt="" data-admin-temple-image>` : `<span>ยังไม่มีรูป</span>`}
    </div>
    <div class="mw-admin-image-url-row">
      <input id="${inputId}" type="url" value="${escapeHtml(url)}" placeholder="วางลิงก์รูปภาพ HTTPS" data-image-url>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="use-temple-image-url">ใช้ลิงก์</button>
    </div>
    <div class="mw-admin-image-actions">
      <label class="mw-admin-btn mw-admin-btn-sm">อัปโหลด<input type="file" accept="image/*" data-temple-image-upload hidden></label>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="crop-temple-image" ${url ? "" : "disabled"}>ครอปรูป</button>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="reuse-temple-image">ใช้รูปเดิม</button>
      <button class="mw-admin-btn mw-admin-btn-sm mw-admin-btn-danger" type="button" data-action="clear-temple-image" ${url ? "" : "disabled"}>ลบรูป</button>
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

return { templeRecords, templeOrders, currentTempleRecord, currentTempleEdit, templeValue, filteredTempleCatalog, normalizeAdminSearch, renderTemples, renderTempleTableRow, templeConfidence, renderTempleDrawer, renderTempleListItem, renderTempleEmptyState, renderTempleEditor, renderTempleImageGroup, renderTempleImageField, templeImageValue };
}
