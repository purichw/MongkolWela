import { adminIcon as icon } from "./design.js";
import { collectAdminMedia, mediaProviderStatus } from "./data.js";
import { MEDIA_KINDS, filterMedia, mediaInventory, mediaMetadata, validateMediaAsset } from "../../lib/admin-media-library.js";
import { sitePlaceholderImage } from "../../lib/image-placeholder.js";

export function createMediaLibrary({ state, api, escapeHtml: e, setTitle, setTopActions, templeImageValue, uploadMedia }) {
  const filters = { kind: "image", search: "", format: "", category: "", sort: "newest", page: 1, pageSize: 20 };
  let assets = [], events = [], loaded = false, loading = false, error = "", eventError = "", mode = "grid", expanded = false;
  let busy = false, dialogDirty = false, queue = [], returnFocus = null;
  const selected = new Set(), dimensions = new Map();
  const $ = (selector, root = document) => root.querySelector(selector);
  const active = () => state.section === "media";
  const all = () => mediaInventory(collectAdminMedia(state.content, state.templeCatalog, templeImageValue), assets, events);
  const button = (label, glyph, attrs = "", primary = false) => `<button type="button" class="mw-admin-btn${primary ? " mw-admin-btn-primary" : ""}" ${attrs}>${icon(glyph)}${label}</button>`;
  const iconButton = (label, glyph, attrs = "") => `<button type="button" class="mw-admin-btn mw-admin-btn-icon" aria-label="${e(label)}" title="${e(label)}" ${attrs}>${icon(glyph)}</button>`;
  const select = (label, field, options, value) => `<label>${label}<select aria-label="${label}" data-media-library-filter="${field}">${options.map(([key, text]) => `<option value="${e(key)}" ${String(value) === String(key) ? "selected" : ""}>${e(text)}</option>`).join("")}</select></label>`;
  const feedback = (message, failed = false) => { const target = $("[data-media-library-feedback]"); if (target) { target.textContent = message; target.classList.toggle("is-error", failed); } };

  async function load() {
    if (loading) return;
    loading = true; error = ""; eventError = "";
    if (active()) render();
    try {
      const payload = await api("/api/admin/media?view=library");
      if (!Array.isArray(payload.assets)) throw new Error("ข้อมูลทะเบียนคลังสื่อไม่ครบถ้วน");
      assets = payload.assets; loaded = true;
    } catch (cause) { error = cause.message; }
    try { const payload = await api("/api/admin/activities"); if (!Array.isArray(payload.events)) throw new Error(); events = payload.events; }
    catch { eventError = "ยังโหลดรูปกิจกรรมไม่สำเร็จ"; }
    loading = false;
    if (active()) render();
  }

  function render() {
    if (!active()) return;
    setTitle("คลังสื่อ", "คลังสื่อ");
    $(".mw-admin-main").classList.add("is-media-library");
    $("#adminDescription").textContent = "จัดการรูปภาพ วิดีโอ และเอกสารสำหรับเว็บไซต์";
    setTopActions("");
    $(".mw-admin-header-actions").insertAdjacentHTML("beforeend", `<div class="mw-media-header-actions" data-media-header>${iconButton("โหลดข้อมูลล่าสุด", "rotate-ccw", "data-media-library-reload")}${button("นำเข้าจากลิงก์", "link", "data-media-library-import")}${button("อัปโหลดไฟล์", "upload", "data-media-library-upload", true)}</div>`);
    $("[data-media-library-reload]").onclick = load;
    $("[data-media-library-import]").onclick = () => openDetails();
    $("[data-media-library-upload]").onclick = openUpload;
    const root = $("#adminContent");
    const items = all();
    const formats = [...new Set(items.filter(item => item.kind === filters.kind).map(item => item.format))].sort();
    const categories = [...new Set(items.filter(item => item.kind === filters.kind).map(item => item.category))].sort((a, b) => a.localeCompare(b, "th"));
    root.innerHTML = `<div class="mw-media-tabs" role="group" aria-label="ประเภทคลังสื่อ">${Object.entries(MEDIA_KINDS).map(([kind, label]) => `<button type="button" data-media-library-kind="${kind}" aria-pressed="${filters.kind === kind}">${label}<span>${items.filter(item => item.kind === kind).length}</span></button>`).join("")}</div>
      <div class="mw-media-filters"><label class="mw-media-search">${icon("search")}<input type="search" aria-label="ค้นหาสื่อ" placeholder="ค้นหาชื่อไฟล์ ชื่อวัด หรือคำอธิบาย..." value="${e(filters.search)}" data-media-library-search></label>${iconButton("ตัวกรองคลังสื่อ", "list-filter", `data-media-library-toggle aria-expanded="${expanded}" aria-controls="media-filter-options"`)}
        <div class="mw-media-filter-options ${expanded ? "is-expanded" : ""}" id="media-filter-options">${select("รูปแบบไฟล์", "format", [["", "ทั้งหมด"], ...formats.map(value => [value, value])], filters.format)}${select("หมวดหมู่", "category", [["", "ทั้งหมด"], ...categories.map(value => [value, value])], filters.category)}${select("เรียงตาม", "sort", [["newest", "เพิ่มล่าสุด"], ["name", "ชื่อไฟล์ ก–ฮ"], ["usage", "จำนวนอ้างอิง"]], filters.sort)}<div class="mw-media-views" role="group" aria-label="มุมมองคลังสื่อ">${iconButton("กริด", "layout-grid", `data-media-library-view="grid" aria-pressed="${mode === "grid"}"`)}${iconButton("รายการ", "list-ordered", `data-media-library-view="list" aria-pressed="${mode === "list"}"`)}</div></div></div>
      <div class="mw-media-notices">${loading ? '<p role="status">กำลังโหลดทะเบียนคลังสื่อ...</p>' : ""}${error ? `<p class="is-error" role="alert">${e(error)} · แสดงเฉพาะข้อมูลที่อ่านได้ ${button("ลองอีกครั้ง", "rotate-ccw", "data-media-library-retry")}</p>` : ""}${eventError ? `<p class="is-error">${eventError}</p>` : ""}${state.templeLoadError ? '<p class="is-error">ยังโหลดรูปวัดและสถานที่ไม่สำเร็จ</p>' : state.secondaryLoading ? '<p role="status">กำลังโหลดรูปวัดและสถานที่...</p>' : ""}</div>
      <p class="mw-media-feedback" data-media-library-feedback role="status" aria-live="polite"></p><div data-media-library-results></div>
      <div class="mw-media-mobile-bar">${button("เลือกหน้านี้", "check", 'data-media-library-select-mode aria-pressed="false"')}${button("อัปโหลดไฟล์", "upload", "data-media-library-upload-mobile", true)}</div>`;
    $("[data-media-library-search]", root).oninput = event => { filters.search = event.target.value; filters.page = 1; selected.clear(); renderResults(); };
    root.onchange = event => {
      if (event.target.matches("[data-media-library-filter]")) { filters[event.target.dataset.mediaLibraryFilter] = event.target.value; filters.page = 1; selected.clear(); renderResults(); }
      if (event.target.matches("[data-media-library-page-size]")) { filters.pageSize = Number(event.target.value); filters.page = 1; renderResults(); }
      if (event.target.matches("[data-media-library-select]")) { const src = event.target.dataset.mediaLibrarySelect; event.target.checked ? selected.add(src) : selected.delete(src); updateSelection(); }
      if (event.target.matches("[data-media-library-select-all]")) { filterMedia(all(), filters).rows.forEach(row => event.target.checked ? selected.add(row.src) : selected.delete(row.src)); renderResults(); }
    };
    root.onclick = event => {
      const target = event.target.closest("button"); if (!target) return;
      if (target.hasAttribute("data-media-library-kind")) { Object.assign(filters, { kind: target.dataset.mediaLibraryKind, page: 1, format: "", category: "" }); selected.clear(); render(); $(`[data-media-library-kind="${filters.kind}"]`)?.focus(); }
      if (target.hasAttribute("data-media-library-view")) { mode = target.dataset.mediaLibraryView; render(); $(`[data-media-library-view="${mode}"]`)?.focus(); }
      if (target.hasAttribute("data-media-library-toggle")) { expanded = !expanded; $("#media-filter-options").classList.toggle("is-expanded", expanded); target.setAttribute("aria-expanded", String(expanded)); }
      if (target.hasAttribute("data-media-library-page")) { filters.page = Number(target.dataset.mediaLibraryPage); renderResults(); $(".mw-media-tabs").scrollIntoView({ block: "start" }); }
      if (target.hasAttribute("data-media-library-open")) openDetails(all().find(item => item.src === target.dataset.mediaLibraryOpen));
      if (target.hasAttribute("data-media-library-copy")) void copy([target.dataset.mediaLibraryCopy]);
      if (target.hasAttribute("data-media-library-copy-selected")) void copy([...selected]);
      if (target.hasAttribute("data-media-library-clear-selection")) { selected.clear(); renderResults(); }
      if (target.hasAttribute("data-media-library-reset")) { Object.assign(filters, { search: "", format: "", category: "", page: 1 }); render(); }
      if (target.hasAttribute("data-media-library-retry")) void load();
      if (target.hasAttribute("data-media-library-upload-mobile")) openUpload();
      if (target.hasAttribute("data-media-library-select-mode")) {
        const rows = filterMedia(all(), filters).rows, clear = rows.every(row => selected.has(row.src));
        rows.forEach(row => clear ? selected.delete(row.src) : selected.add(row.src)); renderResults();
      }
    };
    renderResults();
    if (!loaded && !loading && !error) void load();
  }

  function renderResults() {
    if (!active()) return;
    const result = filterMedia(all(), filters); filters.page = result.page;
    const pages = [...new Set([1, filters.page - 1, filters.page, filters.page + 1, result.pages])].filter(page => page >= 1 && page <= result.pages).sort((a, b) => a - b);
    $("[data-media-library-results]").innerHTML = `<div class="mw-media-results-head"><label data-media-library-selection><input type="checkbox" data-media-library-select-all aria-label="เลือกทั้งหมดในหน้านี้"> <span>ทั้งหมด ${result.total} รายการ</span></label>${filters.search || filters.format || filters.category ? button("ล้างตัวกรอง", "rotate-ccw", "data-media-library-reset") : ""}<div class="mw-media-selection" data-media-library-selection-actions></div></div>
      <div class="mw-media-items ${mode === "list" ? "is-list" : ""}">${result.rows.map(item => `<article class="mw-media-item" data-media-library-card="${e(item.src)}">
        <button type="button" class="mw-media-preview" data-media-library-open="${e(item.src)}" aria-label="ดูรายละเอียด ${e(item.name)}">${item.kind === "image" ? `<img src="${e(item.src)}" alt="" loading="lazy" decoding="async" data-media-library-image data-admin-temple-image data-fallback-src="${sitePlaceholderImage}">` : `<span class="mw-media-file-icon">${icon("file-text")}<b>${e(item.format === "ไม่ระบุ" ? MEDIA_KINDS[item.kind] : item.format)}</b></span>`}</button>
        <label class="mw-media-select-hit"><input type="checkbox" class="mw-media-checkbox" data-media-library-select="${e(item.src)}" aria-label="เลือก ${e(item.name)}" ${selected.has(item.src) ? "checked" : ""}></label>
        <details class="mw-media-menu"><summary aria-label="เมนู ${e(item.name)}" title="เมนูไฟล์">${icon("ellipsis")}</summary><div>${button("รายละเอียดและแก้ไข", "file-text", `data-media-library-open="${e(item.src)}"`)}${button("คัดลอกลิงก์", "copy", `data-media-library-copy="${e(item.src)}"`)}</div></details>
        <div class="mw-media-item-copy"><button type="button" class="mw-media-filename" data-media-library-open="${e(item.src)}" title="${e(item.name)}">${e(item.name)}</button><p data-media-library-metadata>${e(mediaMetadata({ ...item, ...dimensions.get(item.src) }))}</p><span class="mw-media-category">${e(item.category)}</span></div>
      </article>`).join("")}</div>
      ${!result.total && !loading ? `<div class="mw-media-empty">${icon("media")}<h2>${filters.search || filters.format || filters.category ? "ไม่พบไฟล์ที่ตรงกับตัวกรอง" : `ยังไม่มี${MEDIA_KINDS[filters.kind]}ในคลัง`}</h2>${filters.search || filters.format || filters.category ? button("ล้างตัวกรอง", "rotate-ccw", "data-media-library-reset") : '<p>ไฟล์ที่เพิ่มในคลังจะแสดงที่นี่</p>'}</div>` : ""}
      <footer class="mw-media-pagination"><nav aria-label="หน้าคลังสื่อ">${iconButton("หน้าก่อนหน้า", "chevron-left", `data-media-library-page="${result.page - 1}" ${result.page === 1 ? "disabled" : ""}`)}${pages.map((page, index) => `${index && page - pages[index - 1] > 1 ? '<span aria-hidden="true">...</span>' : ""}<button type="button" class="mw-admin-btn" aria-label="หน้า ${page}" ${page === result.page ? 'aria-current="page"' : ""} data-media-library-page="${page}">${page}</button>`).join("")}${iconButton("หน้าถัดไป", "chevron-right", `data-media-library-page="${result.page + 1}" ${result.page === result.pages ? "disabled" : ""}`)}</nav><span data-media-library-count>แสดง ${result.total ? (result.page - 1) * filters.pageSize + 1 : 0}–${Math.min(result.page * filters.pageSize, result.total)} จาก ${result.total} รายการ</span><label><span class="mw-media-sr">จำนวนไฟล์ต่อหน้า</span><select aria-label="จำนวนไฟล์ต่อหน้า" data-media-library-page-size>${[20, 40, 80].map(size => `<option ${size === filters.pageSize ? "selected" : ""} value="${size}">${size} / หน้า</option>`).join("")}</select></label></footer>`;
    updateSelection();
    document.querySelectorAll("[data-media-library-image]").forEach(image => {
      const update = () => {
        if (image.dataset.fallbackApplied || !image.naturalWidth) return;
        const card = image.closest("[data-media-library-card]"); const item = result.rows.find(row => row.src === card.dataset.mediaLibraryCard);
        dimensions.set(item.src, { width: image.naturalWidth, height: image.naturalHeight });
        $("[data-media-library-metadata]", card).textContent = mediaMetadata({ ...item, ...dimensions.get(item.src) });
      };
      image.onload = update;
      if (image.complete) update();
    });
  }

  function updateSelection() {
    $("[data-media-library-selection-actions]").innerHTML = selected.size ? `<span>เลือก ${selected.size} ไฟล์</span>${button("คัดลอกลิงก์", "copy", "data-media-library-copy-selected")}${iconButton("ยกเลิกการเลือก", "x", "data-media-library-clear-selection")}` : "";
    const rows = filterMedia(all(), filters).rows, count = rows.filter(row => selected.has(row.src)).length;
    const check = $("[data-media-library-select-all]"); check.checked = count > 0 && count === rows.length; check.indeterminate = count > 0 && count < rows.length; check.disabled = !rows.length;
    $("[data-media-library-select-mode]")?.setAttribute("aria-pressed", String(check.checked));
    document.querySelectorAll("[data-media-library-card]").forEach(node => node.classList.toggle("is-selected", selected.has(node.dataset.mediaLibraryCard)));
  }

  async function copy(values) {
    try { await navigator.clipboard.writeText(values.map(src => new URL(src, location.origin).href).join("\n")); feedback(`คัดลอกลิงก์ ${values.length} ไฟล์แล้ว`); }
    catch { feedback("คัดลอกไม่สำเร็จ เปิดรายละเอียดไฟล์เพื่อเลือกลิงก์โดยตรง", true); }
    closeMenus();
  }
  function closeMenus() { document.querySelectorAll(".mw-media-menu[open]").forEach(node => node.removeAttribute("open")); }
  document.addEventListener("click", event => { if (!event.target.closest(".mw-media-menu")) closeMenus(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { const open = $(".mw-media-menu[open]"); if (open) { event.preventDefault(); closeMenus(); $("summary", open).focus(); } } });

  function modal(title, body) {
    if ($("#mediaLibraryDialog")) return null;
    closeMenus(); returnFocus = document.activeElement; dialogDirty = false;
    const dialog = document.createElement("dialog"); dialog.id = "mediaLibraryDialog"; dialog.className = "mw-media-dialog";
    dialog.innerHTML = `<header><h2 id="media-dialog-title">${title}</h2>${iconButton("ปิด", "x", "data-media-library-close")}</header>${body}`;
    dialog.setAttribute("aria-labelledby", "media-dialog-title"); $(".mw-admin-main").append(dialog);
    dialog.addEventListener("cancel", event => { event.preventDefault(); closeDialog(); });
    $("[data-media-library-close]", dialog).onclick = closeDialog;
    dialog.addEventListener("input", () => { dialogDirty = true; });
    dialog.showModal(); return dialog;
  }
  function closeDialog() {
    if (busy || (dialogDirty && !confirm("ปิดโดยไม่บันทึกการแก้ไขนี้?"))) return false;
    const dialog = $("#mediaLibraryDialog"); dialog?.close(); dialog?.remove(); dialogDirty = false;
    if (returnFocus?.isConnected) returnFocus.focus(); else $("[data-media-library-upload]")?.focus();
    return true;
  }

  function openDetails(item) {
    const canEdit = loaded && !error;
    if (!canEdit && !item) { feedback(error || "รอโหลดทะเบียนคลังสื่อก่อนเพิ่มหรือแก้ไขไฟล์", true); return; }
    const existing = item || { src: "", name: "", category: "", description: "", kind: filters.kind, references: [] };
    const dialog = modal(item ? "รายละเอียดไฟล์" : "นำเข้าสื่อจากลิงก์", `<form id="media-asset-form"><div class="mw-media-detail-body">${item?.kind === "image" ? `<div class="mw-media-detail-preview"><img src="${e(item.src)}" alt="" data-admin-temple-image data-fallback-src="${sitePlaceholderImage}"></div>` : ""}
      <div class="mw-media-fields"><label>ชื่อไฟล์<input name="name" value="${e(existing.name)}" maxlength="240" required></label><label>URL<input name="src" value="${e(existing.src)}" required ${item ? "readonly" : 'placeholder="https://..."'}></label>${select("ประเภทสื่อ", "asset-kind", Object.entries(MEDIA_KINDS), existing.kind)}<label>หมวดหมู่<input name="category" value="${e(existing.category)}" maxlength="80" list="media-categories"></label><datalist id="media-categories">${[...new Set(all().map(row => row.category))].map(value => `<option value="${e(value)}"></option>`).join("")}</datalist><label>คำอธิบายภายในคลัง<textarea name="description" rows="3" maxlength="1000">${e(existing.description || "")}</textarea></label>
      ${item ? `<p class="mw-media-detail-meta">${e(mediaMetadata({ ...item, ...dimensions.get(item.src) }))}</p>` : ""}
      ${item?.references.length ? `<details class="mw-admin-media-references" open><summary>ตำแหน่งที่ใช้ไฟล์ · อ้างอิง ${item.references.length} ตำแหน่ง</summary>${item.references.map(ref => `<button type="button" class="mw-admin-text-link" ${ref.templeKey ? `data-edit-temple="${e(ref.templeKey)}"` : ref.section ? `data-section="${e(ref.section)}"` : `data-section="pages" data-page-jump="${e(ref.pageId)}"`}>${e(ref.label)} · ${e(ref.slot)}${ref.enabled ? "" : " (ปิดไว้)"}${icon("arrow-right")}</button>`).join("")}</details>` : ""}</div></div><p class="mw-media-dialog-feedback" role="status" aria-live="polite"></p><footer>${button("ยกเลิก", "x", "data-media-library-cancel")}<button class="mw-admin-btn mw-admin-btn-primary" type="submit">${icon("save")}บันทึก</button></footer></form>`);
    if (!dialog) return;
    $("[data-media-library-cancel]", dialog).onclick = closeDialog;
    dialog.addEventListener("click", event => { if (event.target.closest("[data-edit-temple], [data-section]")) { if (!closeDialog()) event.stopPropagation(); } });
    const form = $("form", dialog); const kind = $("[data-media-library-filter]", form); kind.name = "kind"; kind.removeAttribute("data-media-library-filter");
    if (item?.references.length) kind.disabled = true;
    if (!canEdit) {
      form.querySelectorAll("input,textarea").forEach(field => { field.readOnly = true; });
      kind.disabled = true; form.querySelector('[type="submit"]').disabled = true;
      $(".mw-media-dialog-feedback", dialog).textContent = "แสดงข้อมูลได้อย่างเดียว กรุณาโหลดทะเบียนคลังสื่ออีกครั้งก่อนแก้ไข";
    }
    form.onsubmit = async event => {
      event.preventDefault(); if (busy || !canEdit) return;
      const output = $(".mw-media-dialog-feedback", dialog);
      const raw = { ...existing, ...dimensions.get(existing.src), ...Object.fromEntries(new FormData(form)) };
      try {
        const asset = validateMediaAsset(raw);
        busy = true; form.inert = true; form.setAttribute("aria-busy", "true"); form.querySelector('[type="submit"]').disabled = true; output.textContent = "กำลังบันทึก...";
        const payload = await api("/api/admin/media", { method: "POST", body: JSON.stringify({ action: "save-asset", asset, expectedVersion: existing.version }) });
        assets = [...assets.filter(row => row.src !== payload.asset.src), payload.asset]; dialogDirty = false;
        busy = false; closeDialog(); filters.kind = payload.asset.kind; render(); feedback("บันทึกไฟล์ในคลังแล้ว");
      } catch (cause) { output.textContent = cause.message + (cause.status === 409 ? " · ข้อความที่กรอกยังอยู่ กรุณาปิดและโหลดข้อมูลล่าสุดก่อนแก้ไขอีกครั้ง" : ""); output.classList.add("is-error"); }
      finally { busy = false; if (form.isConnected) { form.inert = false; form.setAttribute("aria-busy", "false"); form.querySelector('[type="submit"]').disabled = false; } }
    };
  }

  function openUpload() {
    const ready = !state.mediaLoadError && state.media?.provider && state.media[state.media.provider]?.enabled;
    const dialog = modal("อัปโหลดรูปภาพ", `<div class="mw-media-upload-body"><p>${e(mediaProviderStatus(state.media, state.mediaLoadError))}</p>${ready && loaded && !error ? `<label class="mw-media-drop">${icon("upload")}<strong>เลือกไฟล์รูปภาพ</strong><span>JPG, PNG, WEBP, GIF, AVIF · สูงสุด 8 MB ต่อไฟล์</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple aria-label="เลือกไฟล์รูปภาพ" data-media-library-files></label><ul class="mw-media-upload-queue"></ul><p class="mw-media-dialog-feedback" role="status" aria-live="polite"></p>${button("อัปโหลด", "upload", "data-media-library-start", true)}` : '<p>ยังอัปโหลดไฟล์ไม่ได้ กรุณาตรวจการตั้งค่าผู้ให้บริการและการเชื่อมต่อคลังสื่อ</p>'}</div>`);
    if (!dialog || !ready || !loaded || error) return;
    const drawQueue = () => { $(".mw-media-upload-queue", dialog).innerHTML = queue.map(entry => `<li><strong>${e(entry.file.name)}</strong><span class="${entry.error ? "is-error" : ""}">${e(entry.error || entry.status || "รออัปโหลด")}</span></li>`).join(""); $("[data-media-library-start]", dialog).disabled = busy || !queue.some(entry => !entry.done); };
    $("[data-media-library-files]", dialog).onchange = event => {
      if (busy) return;
      if (queue.some(entry => entry.src && !entry.done)) { $(".mw-media-dialog-feedback", dialog).textContent = "กรุณาบันทึกไฟล์ที่อัปโหลดค้างอยู่ให้สำเร็จก่อนเลือกชุดใหม่"; return; }
      const files = [...event.target.files];
      if (files.length > 20) { $(".mw-media-dialog-feedback", dialog).textContent = "เลือกได้ครั้งละไม่เกิน 20 ไฟล์"; return; }
      queue = files.map(file => ({ file })); dialogDirty = false; drawQueue();
    };
    $("[data-media-library-start]", dialog).onclick = async () => {
      if (busy) return; busy = true; dialogDirty = false; $("[data-media-library-files]", dialog).disabled = true;
      for (const entry of queue.filter(value => !value.done)) {
        entry.error = ""; entry.status = entry.src ? "กำลังบันทึกทะเบียนไฟล์..." : "กำลังอัปโหลด..."; drawQueue();
        try {
          if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(entry.file.type) || !entry.file.size || entry.file.size > 8 * 1024 ** 2) throw new Error("รองรับรูป JPG, PNG, WEBP, GIF, AVIF ไม่เกิน 8 MB");
          if (!entry.src) {
            const bitmap = await createImageBitmap(entry.file);
            entry.width = bitmap.width; entry.height = bitmap.height; bitmap.close();
            entry.src = await uploadMedia(entry.file, entry.file.name, { library: true });
          }
          const payload = await api("/api/admin/media", { method: "POST", body: JSON.stringify({ action: "save-asset", asset: { src: entry.src, name: entry.file.name, kind: "image", bytes: entry.file.size, width: entry.width, height: entry.height, category: "" } }) });
          assets = [...assets.filter(row => row.src !== payload.asset.src), payload.asset]; entry.done = true; entry.status = "บันทึกในคลังแล้ว";
        } catch (cause) {
          // A lost response may hide a successful registration; reconcile before retrying.
          if (cause.status === 409 && entry.src) {
            try {
              const latest = await api("/api/admin/media?view=library");
              const found = latest.assets?.find(row => row.src === entry.src);
              if (found) { assets = latest.assets; entry.done = true; entry.status = "มีไฟล์นี้ในคลังแล้ว"; }
            } catch { /* Keep the upload URL for a later registration retry. */ }
          }
          if (!entry.done) entry.error = `${entry.src ? "อัปโหลดแล้ว แต่ยังบันทึกคลังไม่สำเร็จ: " : ""}${cause.message}`;
        }
        drawQueue();
      }
      busy = false; $("[data-media-library-files]", dialog).disabled = false; drawQueue();
      $(".mw-media-dialog-feedback", dialog).textContent = `สำเร็จ ${queue.filter(entry => entry.done).length} จาก ${queue.length} ไฟล์${queue.some(entry => !entry.done) ? " · กดอัปโหลดเพื่อลองรายการที่ยังไม่สำเร็จอีกครั้ง" : ""}`;
      render();
    };
    drawQueue();
  }
  return { render, isBusy: () => busy, isDirty: () => dialogDirty || queue.some(entry => entry.src && !entry.done) };
}
