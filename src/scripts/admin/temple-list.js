import { adminIcon as icon } from "./design.js";
import { sitePlaceholderImage } from "../../lib/image-placeholder.js";
import { escapeHtml as e } from "../../lib/ui-markup.js";
import { normalizeTempleList, projectTempleList, templeListCsv } from "../../lib/admin-temple-list.js";

const storageKey = "mongkolwela.admin.temple-list-filters";
const labels = { all: "ทั้งหมด", published: "เผยแพร่", draft: "ฉบับร่าง" };

export function createTempleList({ state, collections, imageValue, rerender, setStatus }) {
  const selected = new Set();
  let options = normalizeTempleList();
  let collection = "";
  let searchDraft = "";
  let filtersOpen = false;
  let notice = "";
  let model;

  function resetCollection() {
    collection = state.templeCollectionFilter;
    let saved;
    try { saved = JSON.parse(localStorage.getItem(storageKey) || "{}")[collection]; } catch { /* Optional local preferences. */ }
    options = normalizeTempleList(saved);
    state.templeSearch = options.query;
    searchDraft = options.query;
    selected.clear();
    notice = "";
    filtersOpen = false;
  }

  function refresh() {
    if (collection !== state.templeCollectionFilter) resetCollection();
    if (state.templeSearch !== options.query) searchDraft = state.templeSearch;
    options.query = state.templeSearch;
    model = projectTempleList(state.templeCatalog, collection, options, state.content.temples?.records, state.publishedTempleRecords, state.publishedTempleKeys);
    options.page = model.page;
    const keys = new Set(model.all.map(record => record.key));
    for (const key of selected) if (!keys.has(key)) selected.delete(key);
    return model;
  }

  function select(label, field, values, extra = "") {
    return `<label class="mw-temples-field ${extra}"><span>${label}</span><select aria-label="${label}" data-temple-list-field="${field}">${values.map(([value, name]) => `<option value="${e(value)}" ${String(options[field]) === String(value) ? "selected" : ""}>${e(name)}</option>`).join("")}</select></label>`;
  }

  function renderCard(record) {
    const temple = record.temple;
    const image = imageValue(record, state.content.temples?.records?.[record.key], "card", "desktop") || sitePlaceholderImage;
    const canMove = !options.query && !options.province && !options.type && options.status === "all" && options.sort === "rank";
    const index = model.all.findIndex(item => item.key === record.key);
    const publicLink = record.isPublished ? `<a class="mw-admin-btn" href="${e(record.detailUrl)}" target="_blank" rel="noopener">${icon("external-link")}ดูในเว็บ</a>` : `<button class="mw-admin-btn" disabled title="เผยแพร่ข้อมูลก่อนเปิดหน้าเว็บไซต์">${icon("external-link")}ยังไม่เผยแพร่</button>`;
    return `<article class="mw-temple-admin-card ${selected.has(record.key) ? "is-selected" : ""}" data-temple-row="${e(record.key)}">
      <div class="mw-temple-admin-photo"><img src="${e(image)}" alt="" loading="lazy" decoding="async" data-admin-temple-image data-fallback-src="${sitePlaceholderImage}"></div>
      <label class="mw-temple-admin-check"><input type="checkbox" data-temple-select="${e(record.key)}" aria-label="เลือก ${e(temple.name)}" ${selected.has(record.key) ? "checked" : ""}></label>
      <details class="mw-temple-admin-menu"><summary title="เพิ่มเติม" aria-label="เพิ่มเติม ${e(temple.name)}">${icon("ellipsis")}</summary><div>
        ${publicLink}
        <button class="mw-admin-btn" type="button" data-temple-move-key="${e(record.key)}" data-temple-move-offset="-1" ${!canMove || index === 0 ? "disabled" : ""} title="${canMove ? "เลื่อนขึ้นหนึ่งอันดับ" : "ล้างตัวกรองและเรียงตามอันดับก่อนจัดลำดับ"}">${icon("chevron-up")}เลื่อนอันดับขึ้น</button>
        <button class="mw-admin-btn" type="button" data-temple-move-key="${e(record.key)}" data-temple-move-offset="1" ${!canMove || index === model.all.length - 1 ? "disabled" : ""}>${icon("chevron-down")}เลื่อนอันดับลง</button>
        <button class="mw-admin-btn mw-admin-btn-danger" type="button" data-action="delete-temple" data-delete-temple-key="${e(record.key)}">${icon("trash")}นำออกจากหมวด</button>
      </div></details>
      <div class="mw-temple-admin-copy">
        <span class="mw-temple-publication is-${record.listStatus}" title="${record.listStatus === "draft" ? "มีข้อมูลในฉบับร่างที่ยังไม่ได้เผยแพร่" : "ข้อมูลตรงกับฉบับเผยแพร่"}">${record.listStatus === "draft" && record.isPublished ? "มีฉบับร่าง" : labels[record.listStatus]}</span>
        <h2 data-temple-table-title>${e(temple.name || "ยังไม่มีชื่อ")}</h2><p>${e(temple.province || "ยังไม่ระบุจังหวัด")}</p>
        <p class="mw-temple-admin-description">${e(temple.summary || temple.description || temple.objectHero || temple.blessings || temple.placeType || "")}</p>
      </div>
      <div class="mw-temple-admin-actions"><button class="mw-admin-btn" type="button" data-edit-temple="${e(record.key)}" title="แก้ไข" aria-label="แก้ไข ${e(temple.name || "สถานที่")}">${icon("pencil-line")}<span>แก้ไข</span></button>${publicLink}</div>
    </article>`;
  }

  function pagination() {
    if (model.pages < 2) return "";
    const numbers = [...new Set([1, model.page - 1, model.page, model.page + 1, model.pages])].filter(page => page >= 1 && page <= model.pages).sort((a, b) => a - b);
    return `<nav class="mw-temples-pagination" aria-label="หน้ารายการวัด">
      <button class="mw-admin-btn" type="button" data-temple-page="${model.page - 1}" aria-label="หน้าก่อนหน้า" ${model.page === 1 ? "disabled" : ""}>${icon("chevron-left")}</button>
      ${numbers.map((page, index) => `${index && page - numbers[index - 1] > 1 ? '<span aria-hidden="true">…</span>' : ""}<button class="mw-admin-btn" type="button" data-temple-page="${page}" aria-label="หน้าที่ ${page}" ${page === model.page ? 'aria-current="page"' : ""}>${page}</button>`).join("")}
      <button class="mw-admin-btn" type="button" data-temple-page="${model.page + 1}" aria-label="หน้าถัดไป" ${model.page === model.pages ? "disabled" : ""}>${icon("chevron-right")}</button>
    </nav>`;
  }

  function render() {
    refresh();
    const current = collections.find(item => item.key === collection);
    const total = model.filtered.length;
    const resultLabel = `แสดง ${total ? model.start + 1 : 0}–${Math.min(model.start + options.pageSize, total)} จาก ${total.toLocaleString("th-TH")} รายการ`;
    return `<div class="mw-temples-workspace">
      <div class="mw-temples-collection-tabs" role="tablist" aria-label="หมวดสถานที่">${collections.map(item => `<button type="button" role="tab" aria-selected="${item.key === collection}" data-temple-collection="${item.key}">${e(item.label)} <span>${state.templeCatalog.filter(record => record.collection === item.key).length}</span></button>`).join("")}</div>
      <div class="mw-temples-status-tabs" role="group" aria-label="สถานะการเผยแพร่">${Object.entries(labels).map(([value, label]) => `<button type="button" aria-pressed="${options.status === value}" data-temple-status="${value}">${label}<span>${model.counts[value]}</span></button>`).join("")}</div>
      <form class="mw-temples-filters ${filtersOpen ? "is-expanded" : ""}" data-temple-list-search>
        <div class="mw-temples-search-row"><label class="mw-temples-search">${icon("search")}<input type="search" value="${e(searchDraft)}" placeholder="ค้นหาชื่อวัด สถานที่ หรือคำอธิบาย..." aria-label="ค้นหาวัดและสถานที่" data-temple-search></label>
          <button class="mw-admin-btn mw-admin-btn-primary mw-temples-search-submit" type="submit">ค้นหา</button>
          <button class="mw-admin-btn mw-temples-save-filter" type="button" data-temple-list-action="save-filters">${icon("save")}บันทึกตัวกรอง</button>
          <button class="mw-admin-btn mw-temples-reset" type="button" data-temple-list-action="reset">${icon("rotate-ccw")}รีเซ็ตตัวกรอง</button>
          <button class="mw-admin-btn mw-temples-filter-toggle" type="button" data-temple-list-action="toggle-filters" aria-label="ตัวกรองเพิ่มเติม" aria-expanded="${filtersOpen}" aria-controls="temple-list-facets">${icon("list-filter")}</button></div>
        <div class="mw-temples-facets" id="temple-list-facets">
          ${select("จังหวัด", "province", [["", "ทั้งหมด"], ...model.provinces.map(value => [value, value])])}
          ${select("ประเภท", "type", [["", "ทั้งหมด"], ...model.types.map(value => [value, value])], "mw-temples-secondary-filter")}
          ${select("สถานะ", "status", Object.entries(labels), "mw-temples-secondary-filter")}
          ${select("เรียงตาม", "sort", [["rank", "อันดับบนเว็บไซต์"], ["name", "ชื่อ ก–ฮ"], ["province", "จังหวัด ก–ฮ"]])}
          <div class="mw-temples-view" role="group" aria-label="มุมมองรายการ"><button class="mw-admin-btn" type="button" data-temple-view="grid" aria-label="มุมมองการ์ด" aria-pressed="${options.view === "grid"}">${icon("layout-grid")}</button><button class="mw-admin-btn" type="button" data-temple-view="list" aria-label="มุมมองรายการ" aria-pressed="${options.view === "list"}">${icon("list-ordered")}</button></div>
        </div>
      </form>
      <p class="mw-temples-notice" role="status" ${notice ? "" : "hidden"}>${e(notice)}</p>
      ${state.templeLoadError ? `<div class="mw-temples-empty" role="alert">${icon("info")}<h2>ยังไม่สามารถโหลดรายการสถานที่ได้</h2><button class="mw-admin-btn" type="button" data-action="refresh-admin-data">${icon("rotate-ccw")}ลองอีกครั้ง</button></div>` : `
      <div class="mw-temples-result-bar"><label><input type="checkbox" data-temple-select-page aria-label="เลือกทั้งหมดในหน้านี้" ${model.visible.length && model.visible.every(record => selected.has(record.key)) ? "checked" : ""} ${!total ? "disabled" : ""}>เลือกในหน้านี้ <span data-temple-selection-count>${selected.size ? `· เลือกแล้ว ${selected.size} รายการ` : ""}</span></label>
        <div><p role="status" data-temple-result-count>${resultLabel}</p>${select("จำนวนต่อหน้า", "pageSize", [[20, "20 / หน้า"], [40, "40 / หน้า"], [80, "80 / หน้า"]])}</div></div>
      <div class="mw-temples-selection" ${selected.size ? "" : "hidden"}><strong data-temple-selected-summary>เลือก ${selected.size} รายการ</strong><button class="mw-admin-btn" type="button" data-temple-list-action="export">${icon("file-text")}ส่งออก CSV</button><button class="mw-admin-btn" type="button" data-temple-list-action="clear-selection">${icon("x")}ยกเลิกการเลือก</button></div>
      <div class="mw-temples-results" data-temple-list-view="${options.view}">${model.visible.map(renderCard).join("") || `<div class="mw-temples-empty" role="status">${icon("search")}<h2>${model.all.length ? "ไม่พบสถานที่ที่ตรงกับตัวกรอง" : "ยังไม่มีสถานที่ในหมวดนี้"}</h2><button class="mw-admin-btn" type="button" ${model.all.length ? 'data-temple-list-action="reset"' : 'data-action="add-temple"'}>${model.all.length ? "ล้างตัวกรอง" : "เพิ่มสถานที่"}</button></div>`}</div>
      <div class="mw-temples-bottom"><p>${resultLabel}</p>${pagination()}</div>`}
      <a class="mw-temples-visitor-banner" href="/temples/${collection}/" target="_blank" rel="noopener"><span class="mw-temples-banner-symbol">${icon("landmark")}</span><span><strong>${e(current?.label || "วัดและสถานที่")}</strong><small>สถานที่และเส้นทางท่องเที่ยวบนเว็บไซต์มงคลเวลา</small></span><b>ดูหน้าเว็บ ${icon("arrow-right")}</b></a>
    </div>`;
  }

  function refreshView(focus) {
    rerender();
    if (focus) requestAnimationFrame(() => document.querySelector(focus)?.focus({ preventScroll: true }));
  }

  function click(event) {
    const target = event.target;
    document.querySelectorAll(".mw-temple-admin-menu[open]").forEach(menu => { if (!menu.contains(target)) menu.open = false; });
    if (state.section !== "temples") return false;
    const page = target.closest("[data-temple-page]");
    const status = target.closest("[data-temple-status]");
    const view = target.closest("[data-temple-view]");
    const action = target.closest("[data-temple-list-action]")?.dataset.templeListAction;
    if (page) { options.page = Number(page.dataset.templePage); refreshView(`[data-temple-page="${options.page}"]`); document.querySelector(".mw-temples-result-bar")?.scrollIntoView({ block: "start" }); return true; }
    if (status) { options.status = status.dataset.templeStatus; options.page = 1; selected.clear(); refreshView(`[data-temple-status="${options.status}"]`); return true; }
    if (view) { options.view = view.dataset.templeView; refreshView(`[data-temple-view="${options.view}"]`); return true; }
    if (!action) return false;
    if (action === "toggle-filters") { filtersOpen = !filtersOpen; refreshView('[data-temple-list-action="toggle-filters"]'); }
    if (action === "reset") { options = normalizeTempleList({ view: options.view, pageSize: options.pageSize }); state.templeSearch = ""; searchDraft = ""; selected.clear(); notice = ""; refreshView("[data-temple-search]"); }
    if (action === "save-filters") {
      try { const saved = JSON.parse(localStorage.getItem(storageKey) || "{}"); saved[collection] = { ...options, page: 1 }; localStorage.setItem(storageKey, JSON.stringify(saved)); notice = "บันทึกตัวกรองในเบราว์เซอร์นี้แล้ว"; }
      catch { notice = "บันทึกตัวกรองไม่ได้ เบราว์เซอร์ไม่อนุญาตให้จัดเก็บข้อมูล"; }
      refreshView('[data-temple-list-action="save-filters"]');
    }
    if (action === "clear-selection") { selected.clear(); refreshView("[data-temple-select-page]"); }
    if (action === "export") {
      const blob = new Blob([templeListCsv(model.all.filter(record => selected.has(record.key)))], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `mongkolwela-${collection}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`ส่งออก ${selected.size} รายการแล้ว`, "ok");
    }
    return true;
  }

  function input(event) {
    if (state.section !== "temples") return false;
    const target = event.target;
    if (target.matches("[data-temple-search]")) {
      if (event.type === "input") searchDraft = target.value;
      return true;
    }
    if (target.matches("[data-temple-select], [data-temple-select-page]")) {
      if (event.type !== "change") return true;
      const keys = target.hasAttribute("data-temple-select-page") ? model.visible.map(record => record.key) : [target.dataset.templeSelect];
      keys.forEach(key => target.checked ? selected.add(key) : selected.delete(key));
      document.querySelectorAll("[data-temple-select]").forEach(input => { input.checked = selected.has(input.dataset.templeSelect); input.closest("[data-temple-row]").classList.toggle("is-selected", input.checked); });
      const all = document.querySelector("[data-temple-select-page]");
      const count = model.visible.filter(record => selected.has(record.key)).length;
      all.checked = count === model.visible.length && count > 0; all.indeterminate = count > 0 && count < model.visible.length;
      document.querySelector("[data-temple-selection-count]").textContent = selected.size ? `· เลือกแล้ว ${selected.size} รายการ` : "";
      document.querySelector(".mw-temples-selection").hidden = !selected.size;
      document.querySelector("[data-temple-selected-summary]").textContent = `เลือก ${selected.size} รายการ`;
      return true;
    }
    if (!target.matches("[data-temple-list-field]")) return false;
    if (event.type !== "change") return true;
    options = normalizeTempleList({ ...options, [target.dataset.templeListField]: target.value, page: 1 });
    selected.clear(); refreshView();
    requestAnimationFrame(() => document.querySelector(`[data-temple-list-field="${target.dataset.templeListField}"]`)?.closest(".mw-select")?.focus({ preventScroll: true }));
    return true;
  }

  function submit(event) {
    if (!event.target.matches("[data-temple-list-search]")) return;
    event.preventDefault(); state.templeSearch = searchDraft; options.page = 1; selected.clear(); refreshView("[data-temple-search]");
  }

  function keydown(event) {
    if (event.key !== "Escape") return false;
    const open = document.querySelector(".mw-temple-admin-menu[open]");
    if (!open) return false;
    open.open = false; open.querySelector("summary").focus(); return true;
  }

  return { render, click, input, submit, keydown, resetCollection };
}
