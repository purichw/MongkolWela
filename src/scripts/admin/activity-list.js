import { ACTIVITY_TYPES, ACTIVITY_STATUSES, activityDateLabel, safeActivityImageUrl } from "../../lib/temple-activities.js";
import { activityIsVisible, activityPhase, activityPhaseLabel, filterAdminActivities, activityDateRange } from "../../lib/admin-activity-list.js";
import { sitePlaceholderImage } from "../../lib/image-placeholder.js";
import { adminIcon as icon } from "./design.js";

export function createActivityList({ state, escapeHtml: e, open, archive, isBusy }) {
  let events = [];
  let search = "";
  let phase = "all";
  let type = "all";
  let status = "all";
  let from = "";
  let to = "";
  let pageNumber = 1;
  let pageSize = 5;
  let filtersOpen = false;
  let selected = new Set();
  let message = "";
  let messageError = false;
  let lastFocusId = "";
  let lastScroll = 0;
  const tabs = { all: "ทั้งหมด", upcoming: "กำลังจะมาถึง", ongoing: "กำลังจัดอยู่", past: "จัดแล้ว", cancelled: "ยกเลิก" };
  const options = (values, value) => Object.entries(values).map(([key, label]) => `<option value="${e(key)}" ${value === key ? "selected" : ""}>${e(label)}</option>`).join("");
  const roots = () => document.querySelector(".mw-activities-list");
  const records = () => filterAdminActivities(events, { search, phase, type, status, from, to, temples: state.templeCatalog || [] });
  const activeFilters = () => [type !== "all", status !== "all", Boolean(from || to)].filter(Boolean).length;

  function row(event) {
    const temple = state.templeCatalog?.find(item => item.key === event.templeId)?.temple;
    const visible = activityIsVisible(event);
    const image = safeActivityImageUrl(event.imageUrl) || sitePlaceholderImage;
    return `<tr class="mw-activity-row" data-activity-id="${e(event.id)}">
      <td class="mw-activity-selection"><input type="checkbox" data-activity-select="${e(event.id)}" ${selected.has(event.id) ? "checked" : ""} ${event.status === "archived" ? "disabled" : ""} aria-label="เลือก ${e(event.title)}"></td>
      <td class="mw-activity-thumbnail"><img src="${e(image)}" alt="" loading="lazy" data-admin-temple-image data-fallback-src="${sitePlaceholderImage}"></td>
      <td class="mw-activity-name"><button type="button" data-edit-activity="${e(event.id)}">${e(event.title)}</button><p>${e(event.description || "")}</p></td>
      <td class="mw-activity-place"><span>${e(temple?.name || "สถานที่ไม่เปิดใช้งาน")}</span><small>${e(temple?.province || "")}</small></td>
      <td class="mw-activity-type"><span data-type="${e(event.type)}">${e(ACTIVITY_TYPES[event.type] || event.type)}</span></td>
      <td class="mw-activity-date">${icon("calendar-days")}<time>${e(activityDateLabel(event))}</time></td>
      <td class="mw-activity-state"><span class="mw-activity-badge" data-status="${e(activityPhase(event))}">${e(activityPhaseLabel(event))}</span></td>
      <td class="mw-activity-visibility"><span class="${visible ? "is-visible" : ""}">${icon(visible ? "eye" : "minus")}${visible ? "แสดง" : "ซ่อน"}</span></td>
      <td class="mw-activity-row-actions"><div class="mw-activity-desktop-actions">
        <button class="mw-admin-btn mw-admin-btn-icon" type="button" data-edit-activity="${e(event.id)}" aria-label="แก้ไข ${e(event.title)}" title="แก้ไข">${icon("pencil-line")}</button>
        <button class="mw-admin-btn mw-admin-btn-icon" type="button" data-copy-activity="${e(event.id)}" aria-label="ทำสำเนา ${e(event.title)}" title="ทำสำเนา">${icon("copy")}</button>
        <button class="mw-admin-btn mw-admin-btn-icon" type="button" data-archive-activity="${e(event.id)}" ${event.status === "archived" ? "disabled" : ""} aria-label="เก็บเข้าคลัง ${e(event.title)}" title="เก็บเข้าคลัง">${icon("layers-2")}</button>
      </div><details class="mw-activity-mobile-actions"><summary aria-label="ตัวเลือก ${e(event.title)}" title="ตัวเลือก">${icon("ellipsis")}</summary><div>
        <button type="button" data-edit-activity="${e(event.id)}">${icon("pencil-line")}แก้ไข</button>
        <button type="button" data-copy-activity="${e(event.id)}">${icon("copy")}ทำสำเนา</button>
        <button type="button" data-archive-activity="${e(event.id)}" ${event.status === "archived" ? "disabled" : ""}>${icon("layers-2")}เก็บเข้าคลัง</button>
      </div></details></td>
    </tr>`;
  }

  function renderRows() {
    const root = roots();
    if (!root) return;
    const results = records();
    const pages = Math.max(1, Math.ceil(results.length / pageSize));
    pageNumber = Math.max(1, Math.min(pageNumber, pages));
    const start = (pageNumber - 1) * pageSize;
    const shown = results.slice(start, start + pageSize);
    root.querySelector("[data-activity-rows]").innerHTML = shown.map(row).join("");
    const empty = root.querySelector("[data-activity-empty]");
    empty.hidden = Boolean(results.length);
    empty.innerHTML = `${icon("calendar-days")}<h2>${events.length ? "ไม่พบกิจกรรมที่ตรงกับตัวกรอง" : "ยังไม่มีกิจกรรมและงานบุญ"}</h2>${events.length ? '<button class="mw-admin-btn" type="button" data-activity-reset>ล้างตัวกรอง</button>' : `<button class="mw-admin-btn mw-admin-btn-primary" type="button" data-activity-create ${!state.secondaryReady || !state.templeCatalog?.length ? "disabled" : ""}>สร้างกิจกรรมแรก</button>`}`;
    root.querySelector(".mw-activity-table").hidden = !results.length;
    const count = root.querySelector("[data-activity-count]");
    count.textContent = `แสดง ${results.length ? start + 1 : 0}${shown.length > 1 ? `–${start + shown.length}` : ""} จาก ${results.length} รายการ`;
    const center = Math.max(2, Math.min(pages - 1, pageNumber));
    const numbers = [...new Set([1, pages, center - 1, center, center + 1].filter(number => number >= 1 && number <= pages))].sort((a, b) => a - b);
    root.querySelector("[data-activity-pagination]").innerHTML = `<button class="mw-admin-btn mw-admin-btn-icon" type="button" data-activity-page="${pageNumber - 1}" ${pageNumber === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">${icon("chevron-left")}</button>${numbers.map((number, index) => `${index && number - numbers[index - 1] > 1 ? '<span aria-hidden="true">…</span>' : ""}<button class="mw-admin-btn mw-admin-btn-icon" type="button" data-activity-page="${number}" ${pageNumber === number ? 'aria-current="page"' : ""} aria-label="หน้า ${number}">${number}</button>`).join("")}<button class="mw-admin-btn mw-admin-btn-icon" type="button" data-activity-page="${pageNumber + 1}" ${pageNumber === pages ? "disabled" : ""} aria-label="หน้าถัดไป">${icon("chevron-right")}</button>`;
    root.querySelector("[data-activity-bulk]").hidden = selected.size === 0;
    root.querySelector("[data-activity-selected-count]").textContent = `เลือก ${selected.size} รายการ`;
    const all = root.querySelector("[data-activity-select-all]");
    const selectable = shown.filter(item => item.status !== "archived");
    all.checked = Boolean(selectable.length && selectable.every(item => selected.has(item.id)));
    all.indeterminate = !all.checked && shown.some(item => selected.has(item.id));
    all.disabled = !selectable.length;
    root.querySelector("[data-activity-list-feedback]").textContent = message;
    root.querySelector("[data-activity-list-feedback]").classList.toggle("is-error", messageError);
  }

  function render(items) {
    events = items;
    selected = new Set([...selected].filter(id => events.some(item => item.id === id && item.status !== "archived")));
    const counts = Object.fromEntries(Object.keys(tabs).map(key => [key, key === "all" ? events.length : events.filter(event => activityPhase(event) === key).length]));
    document.querySelector("#adminContent").innerHTML = `<div class="mw-activities-list">
      <div class="mw-activity-tabs" role="group" aria-label="ช่วงกิจกรรม">${Object.entries(tabs).map(([key, label]) => `<button type="button" data-activity-phase="${key}" aria-pressed="${phase === key}">${label}<span>${counts[key]}</span></button>`).join("")}</div>
      <div class="mw-activity-filters"><label class="mw-activity-search"><span class="mw-admin-sr-only">ค้นหากิจกรรม</span>${icon("search")}<input type="search" data-activity-search value="${e(search)}" placeholder="ค้นหาชื่อกิจกรรม วัด หรือสถานที่..."></label>
        <button class="mw-admin-btn mw-admin-btn-icon mw-activity-filter-toggle" type="button" data-activity-filter-toggle aria-expanded="${filtersOpen}" aria-controls="activity-list-filters" aria-label="ตัวกรองกิจกรรม${activeFilters() ? ` (${activeFilters()})` : ""}">${icon("list-filter")}${activeFilters() ? `<span>${activeFilters()}</span>` : ""}</button>
        <div class="mw-activity-filter-options ${filtersOpen ? "is-open" : ""}" id="activity-list-filters">
          <label>ประเภท<select data-activity-type aria-label="ประเภทกิจกรรมที่ค้นหา">${options({ all: "ทั้งหมด", ...ACTIVITY_TYPES }, type)}</select></label>
          <label>สถานะ<select data-activity-filter aria-label="สถานะกิจกรรมที่ค้นหา">${options({ all: "ทั้งหมด", ...ACTIVITY_STATUSES }, status)}</select></label>
          <div class="mw-activity-range"><span>ช่วงวันที่</span><details><summary>${e(activityDateRange(from, to))}${icon("calendar-days")}</summary><div><label>ตั้งแต่<input type="date" data-activity-from value="${e(from)}" ${to ? `max="${e(to)}"` : ""}></label><label>ถึง<input type="date" data-activity-to value="${e(to)}" ${from ? `min="${e(from)}"` : ""}></label><button class="mw-admin-btn" type="button" data-activity-clear-dates>ล้างช่วงวันที่</button></div></details></div>
          <button class="mw-admin-btn mw-admin-btn-icon" type="button" data-activity-reset aria-label="ล้างตัวกรอง" title="ล้างตัวกรอง">${icon("rotate-ccw")}</button>
        </div>
      </div>
      <p class="mw-activity-list-feedback" data-activity-list-feedback role="status"></p>
      <div class="mw-activity-bulk" data-activity-bulk hidden><strong data-activity-selected-count></strong><button class="mw-admin-btn" type="button" data-activity-bulk-archive>${icon("layers-2")}เก็บเข้าคลัง</button><button class="mw-admin-btn" type="button" data-activity-clear-selection>ยกเลิกการเลือก</button></div>
      <table class="mw-activity-table"><caption class="mw-admin-sr-only">รายการกิจกรรมและงานบุญ</caption><thead><tr><th scope="col"><input type="checkbox" data-activity-select-all aria-label="เลือกกิจกรรมทั้งหมดในหน้านี้"></th><th scope="col">รูปภาพ</th><th scope="col">ชื่อกิจกรรม</th><th scope="col">วัด / สถานที่</th><th scope="col">ประเภท</th><th scope="col">วันที่เริ่ม - สิ้นสุด</th><th scope="col">สถานะ</th><th scope="col">การแสดงผล</th><th scope="col">จัดการ</th></tr></thead><tbody data-activity-rows></tbody></table>
      <div class="mw-activity-empty" data-activity-empty hidden></div>
      <div class="mw-activity-pagination"><nav data-activity-pagination aria-label="หน้ารายการกิจกรรม"></nav><span data-activity-count role="status"></span><label><span class="mw-admin-sr-only">จำนวนกิจกรรมต่อหน้า</span><select data-activity-page-size>${[5, 10, 20, 50].map(number => `<option value="${number}" ${number === pageSize ? "selected" : ""}>${number} / หน้า</option>`).join("")}</select></label></div>
    </div>`;
    const root = roots();
    root.addEventListener("click", click);
    root.addEventListener("input", input);
    root.addEventListener("change", input);
    root.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const menu = event.target.closest("details[open]");
      if (menu) { menu.open = false; menu.querySelector("summary").focus(); }
    });
    renderRows();
  }

  async function click(event) {
    if (isBusy()) return;
    roots().querySelectorAll("details[open]").forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
    const button = event.target.closest("button");
    if (!button) return;
    const id = button.dataset.editActivity || button.dataset.copyActivity || button.dataset.archiveActivity;
    const item = events.find(record => record.id === id);
    if (button.hasAttribute("data-edit-activity") || button.hasAttribute("data-copy-activity")) {
      lastFocusId = id; lastScroll = window.scrollY;
      open(button.hasAttribute("data-copy-activity") ? { ...item, id: undefined, version: undefined, updatedAt: undefined, updatedBy: undefined, history: [], status: "draft", title: `${item.title.slice(0, 150)} (สำเนา)` } : item);
    } else if (button.hasAttribute("data-activity-create")) open();
    else if (button.hasAttribute("data-activity-phase")) { phase = button.dataset.activityPhase; selected.clear(); pageNumber = 1; render(events); document.querySelector(`[data-activity-phase="${phase}"]`)?.focus({ preventScroll: true }); }
    else if (button.hasAttribute("data-activity-page")) { pageNumber = Number(button.dataset.activityPage); selected.clear(); renderRows(); roots().querySelector('[aria-current="page"]')?.focus({ preventScroll: true }); roots().scrollIntoView({ block: "start" }); }
    else if (button.hasAttribute("data-activity-filter-toggle")) { filtersOpen = !filtersOpen; render(events); roots().querySelector("[data-activity-filter-toggle]").focus(); }
    else if (button.hasAttribute("data-activity-clear-selection")) { selected.clear(); renderRows(); }
    else if (button.hasAttribute("data-activity-reset")) { search = ""; phase = "all"; status = "all"; type = "all"; from = ""; to = ""; selected.clear(); pageNumber = 1; render(events); roots().querySelector("[data-activity-search]").focus({ preventScroll: true }); }
    else if (button.hasAttribute("data-activity-clear-dates")) { from = ""; to = ""; pageNumber = 1; selected.clear(); render(events); }
    else if (button.hasAttribute("data-archive-activity") || button.hasAttribute("data-activity-bulk-archive")) {
      const candidates = (item ? [item] : events.filter(record => selected.has(record.id))).filter(record => record.status !== "archived");
      if (!candidates.length || !window.confirm(`เก็บ ${candidates.length} กิจกรรมเข้าคลัง? รายการจะไม่แสดงบนเว็บไซต์ แต่ยังเปิดแก้ไขและเผยแพร่ใหม่ได้`)) return;
      const outcome = await archive(candidates);
      message = `เก็บเข้าคลังแล้ว ${outcome.saved} รายการ${outcome.errors.length ? ` · ไม่สำเร็จ ${outcome.errors.length} รายการ: ${outcome.errors[0]}` : ""}`;
      messageError = Boolean(outcome.errors.length);
      if (state.section === "dates") render(outcome.events);
    }
  }

  function input(event) {
    if (isBusy()) return;
    const target = event.target;
    if (target.matches("[data-activity-search]")) { search = target.value; pageNumber = 1; selected.clear(); renderRows(); return; }
    if (event.type !== "change") return;
    if (target.matches("[data-activity-select]")) { target.checked ? selected.add(target.dataset.activitySelect) : selected.delete(target.dataset.activitySelect); renderRows(); roots().querySelector(`[data-activity-select="${target.dataset.activitySelect}"]`)?.focus({ preventScroll: true }); return; }
    if (target.matches("[data-activity-select-all]")) { const shown = records().slice((pageNumber - 1) * pageSize, pageNumber * pageSize).filter(item => item.status !== "archived"); shown.forEach(item => target.checked ? selected.add(item.id) : selected.delete(item.id)); renderRows(); return; }
    const fromInput = roots().querySelector("[data-activity-from]");
    const toInput = roots().querySelector("[data-activity-to]");
    if (target.matches("[data-activity-from], [data-activity-to]")) {
      if (fromInput.value && toInput.value && fromInput.value > toInput.value) {
        roots().querySelector("[data-activity-list-feedback]").textContent = "วันสิ้นสุดของตัวกรองต้องไม่ก่อนวันเริ่ม";
        return;
      }
      message = "";
      fromInput.max = toInput.value; toInput.min = fromInput.value;
      from = fromInput.value; to = toInput.value;
    }
    if (target.matches("[data-activity-type]")) type = target.value;
    else if (target.matches("[data-activity-filter]")) status = target.value;
    else if (target.matches("[data-activity-from], [data-activity-to]")) { /* Both range bounds were validated together above. */ }
    else if (target.matches("[data-activity-page-size]")) pageSize = Number(target.value);
    else return;
    pageNumber = 1; selected.clear(); renderRows();
    const toggle = roots().querySelector("[data-activity-filter-toggle]");
    toggle.setAttribute("aria-label", `ตัวกรองกิจกรรม${activeFilters() ? ` (${activeFilters()})` : ""}`);
    toggle.innerHTML = `${icon("list-filter")}${activeFilters() ? `<span>${activeFilters()}</span>` : ""}`;
    const range = roots().querySelector(".mw-activity-range summary");
    range.innerHTML = `${e(activityDateRange(from, to))}${icon("calendar-days")}`;
  }
  function restorePosition() {
    requestAnimationFrame(() => {
      if (state.section !== "dates" || !roots()) return;
      window.scrollTo(0, lastScroll);
      roots().querySelector(`[data-edit-activity="${lastFocusId}"]`)?.focus({ preventScroll: true });
    });
  }
  return { render, restorePosition };
}
