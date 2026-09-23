import { requestJson, createLatestRequest } from "./request.js";
import { iconAttributes } from "../lib/ui-markup.js";
import { syncPublicSelects } from "./public-select.js";
import { startContentRefresh } from "./content-refresh.js";
import { normalizePlaceholderImage, sitePlaceholderImage } from "../lib/image-placeholder.js";

function icon(name) {
  const node = document.createElement("span");
  for (const [key, value] of Object.entries(iconAttributes(name))) node.setAttribute(key, value);
  return node;
}

function safeImage(value) {
  if (typeof value !== "string" || !value) return "";
  try { const url = new URL(value, location.origin); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}

function resultLink(item) {
  const link = document.createElement("a");
  link.className = "temple-search__result";
  link.href = /^\/temples\/(popular|sacred|mu)\/[^?#]+\/$/.test(item.detailUrl) ? item.detailUrl : "/temples/";
  const media = document.createElement("span");
  media.className = "temple-search__image";
  const image = new Image();
  image.alt = ""; image.loading = "lazy"; image.width = 80; image.height = 70;
  image.dataset.fallbackSrc = sitePlaceholderImage;
  image.src = safeImage(normalizePlaceholderImage(item.imageUrl)) || sitePlaceholderImage;
  media.append(image);
  const copy = document.createElement("span");
  copy.className = "temple-search__copy";
  const name = document.createElement("strong"); name.textContent = item.name;
  const place = document.createElement("span"); place.className = "temple-search__location";
  place.textContent = [item.province, item.district].filter(Boolean).join(" · ");
  const tags = document.createElement("span"); tags.className = "temple-search__tags";
  for (const value of item.blessings.slice(0, 2)) { const tag = document.createElement("span"); tag.textContent = value; tags.append(tag); }
  copy.append(name, place, tags);
  link.append(media, copy, icon("arrow-right"));
  return link;
}

async function search(params, signal) {
  const data = await requestJson(`/api/temple-search?${params}`, { signal, timeoutMs: 12000 });
  if (!Array.isArray(data.items) || !data.filters || !Number.isFinite(data.total)) throw new Error("Invalid search response");
  return data;
}

function enhanceSuggestions(root) {
  const input = root.querySelector("[data-search-input]");
  const panel = root.querySelector("[data-search-suggestions]");
  const list = root.querySelector("[data-search-list]");
  const status = root.querySelector("[data-search-status]");
  const all = root.querySelector("[data-search-all]");
  const retry = root.querySelector("[data-search-retry]");
  const explore = root.closest("dialog")?.querySelector("[data-search-explore]");
  const requests = createLatestRequest();
  let timer, stopPosition, active = -1, items = [], open = false, generation = 0;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  function dismiss() {
    generation++; clearTimeout(timer); requests.cancel(); open = false;
    stopPosition?.(); stopPosition = null;
    if (panel.matches(":popover-open")) panel.hidePopover();
    panel.hidden = true; input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant"); active = -1;
    if (explore) explore.hidden = false;
  }

  async function show() {
    panel.hidden = false; open = true; input.setAttribute("aria-expanded", "true");
    if (explore) explore.hidden = true;
    if (!panel.hasAttribute("popover")) return;
    if (!panel.matches(":popover-open")) panel.showPopover();
    if (stopPosition) return;
    const ticket = generation;
    const { computePosition, autoUpdate, flip, shift, size } = await import("@floating-ui/dom");
    if (!open || ticket !== generation) return;
    stopPosition = autoUpdate(root.querySelector("form"), panel, async () => {
      const result = await computePosition(root.querySelector("form"), panel, {
        strategy: "fixed", placement: "bottom-start", middleware: [flip(), shift({ padding: 8 }), size({ padding: 8, apply({ availableHeight, rects }) {
          panel.style.width = `${rects.reference.width}px`;
          panel.style.maxHeight = `${Math.max(80, Math.min(500, availableHeight - 8))}px`;
        } })],
      });
      if (open) Object.assign(panel.style, { left: `${result.x}px`, top: `${result.y + (result.placement.startsWith("bottom") ? 6 : -6)}px` });
    });
  }

  async function run() {
    const q = input.value.trim();
    if (!q) { dismiss(); return; }
    const request = requests.start();
    active = -1; items = []; list.replaceChildren(); all.hidden = true; retry.hidden = true;
    input.removeAttribute("aria-activedescendant");
    status.replaceChildren(icon("search"), document.createTextNode("กำลังค้นหา…"));
    show();
    try {
      const data = await search(new URLSearchParams({ q, suggest: "1" }), request.signal);
      if (!request.isCurrent()) return;
      status.textContent = data.total ? `พบ ${data.total.toLocaleString("th-TH")} สถานที่` : "ยังไม่พบสถานที่ ลองชื่อวัด จังหวัด หรือคำขอพรอื่น";
      data.items.forEach((item, index) => {
        const node = resultLink(item);
        node.id = `${input.id}-option-${index}`; node.role = "option";
        node.tabIndex = -1; node.setAttribute("aria-selected", "false"); list.append(node);
      });
      items = [...list.children];
      all.href = `/search/?${new URLSearchParams({ q })}`;
      all.hidden = !data.total;
    } catch {
      if (!request.isCurrent()) return;
      status.replaceChildren(icon("info"), document.createTextNode("โหลดผลค้นหาไม่สำเร็จ คำค้นของคุณยังอยู่"));
      retry.hidden = false;
    }
  }

  input.addEventListener("input", event => {
    input.setCustomValidity("");
    clearTimeout(timer); requests.cancel();
    list.replaceChildren(); items = []; active = -1; all.hidden = true;
    input.removeAttribute("aria-activedescendant");
    if (!input.value.trim()) { dismiss(); return; }
    status.textContent = "กำลังค้นหา…";
    if (!event.isComposing) timer = setTimeout(run, 240);
  });
  input.addEventListener("compositionend", () => { clearTimeout(timer); timer = setTimeout(run, 240); });
  input.addEventListener("focus", () => { if (input.value.trim()) run(); });
  input.addEventListener("keydown", event => {
    if (event.isComposing) return;
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); dismiss(); return; }
    if (["ArrowDown", "ArrowUp"].includes(event.key) && items.length && open) {
      event.preventDefault();
      active = (active + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((node, index) => node.setAttribute("aria-selected", String(index === active)));
      input.setAttribute("aria-activedescendant", items[active].id);
      items[active].scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && active >= 0 && open) { event.preventDefault(); location.assign(items[active].href); }
  });
  retry.addEventListener("click", run);
  root.addEventListener("focusout", event => { if (!root.contains(event.relatedTarget)) dismiss(); });
  document.addEventListener("pointerdown", event => { if (!root.contains(event.target)) dismiss(); });
  root.querySelector("form").addEventListener("submit", event => {
    input.value = input.value.trim(); dismiss();
    if (!input.value) {
      event.preventDefault(); input.setCustomValidity("กรุณาระบุชื่อวัด จังหวัด หรือเรื่องที่ต้องการค้นหา"); input.reportValidity();
    }
  });
  return { dismiss };
}

function initResults(root) {
  const form = root.querySelector("form");
  const input = root.querySelector("[data-search-input]");
  const filters = [...root.querySelectorAll("[data-search-filter]")];
  const results = root.querySelector("[data-search-results]");
  const state = root.querySelector("[data-search-page-state]");
  const title = root.querySelector("[data-search-state-title]");
  const copy = root.querySelector("[data-search-state-copy]");
  const retry = root.querySelector("[data-search-page-retry]");
  const count = root.querySelector("[data-search-count]");
  const pagination = root.querySelector("[data-search-pagination]");
  const prev = root.querySelector("[data-search-prev]");
  const next = root.querySelector("[data-search-next]");
  const requests = createLatestRequest();
  let params = new URLSearchParams(location.search), page = 1;
  let facetSignature = "";

  function restore() {
    params = new URLSearchParams(location.search);
    input.value = params.get("q") || "";
    filters.forEach(select => { select.value = params.get(select.name) || ""; });
    syncPublicSelects(root);
  }

  function updateUrl() {
    const nextUrl = `/search/${params.size ? `?${params}` : ""}`;
    if (nextUrl !== location.pathname + location.search) history.pushState({}, "", nextUrl);
  }

  async function load() {
    const request = requests.start();
    results.replaceChildren(); pagination.hidden = true; state.hidden = false; retry.hidden = true;
    count.textContent = ""; title.textContent = "กำลังค้นหาสถานที่"; copy.textContent = "รอสักครู่";
    root.setAttribute("aria-busy", "true");
    try {
      const data = await search(params, request.signal);
      if (!request.isCurrent()) return;
      const signature = JSON.stringify(data.filters);
      if (signature !== facetSignature) {
        facetSignature = signature;
        const options = { collection: data.filters.collections, province: data.filters.provinces, purpose: data.filters.purposes };
        for (const select of filters) {
          const all = select.options[0].cloneNode(true);
          select.replaceChildren(all, ...options[select.name].map(value => new Option(value.label || value, value.key || value)));
        }
      }
      for (const select of filters) {
        const value = params.get(select.name) || "";
        if (value && ![...select.options].some(option => option.value === value)) select.add(new Option(value, value));
        select.value = value;
      }
      syncPublicSelects(root);
      page = data.page;
      count.textContent = data.q ? `ผลค้นหา “${data.q}” · ${data.total.toLocaleString("th-TH")} สถานที่` : `${data.total.toLocaleString("th-TH")} สถานที่`;
      state.hidden = Boolean(data.total);
      title.textContent = "ยังไม่พบสถานที่ที่ตรงกัน";
      copy.textContent = "ลองใช้คำค้นสั้นลง หรือปรับหมวด จังหวัด และเรื่องที่ขอพร";
      results.replaceChildren(...data.items.map(resultLink));
      pagination.hidden = data.pages <= 1;
      prev.disabled = data.page <= 1; next.disabled = data.page >= data.pages;
      root.querySelector("[data-search-page-number]").textContent = `หน้า ${data.page} จาก ${data.pages}`;
    } catch {
      if (!request.isCurrent()) return;
      title.textContent = "โหลดผลค้นหาไม่สำเร็จ"; copy.textContent = "คำค้นและตัวกรองของคุณยังอยู่ กรุณาลองอีกครั้ง"; retry.hidden = false;
    } finally { if (request.isCurrent()) root.setAttribute("aria-busy", "false"); }
  }

  function submit() {
    params = new URLSearchParams();
    const q = input.value.trim(); if (q) params.set("q", q);
    filters.forEach(select => { if (select.value) params.set(select.name, select.value); });
    updateUrl(); load();
  }
  form.addEventListener("submit", event => { event.preventDefault(); submit(); });
  filters.forEach(select => select.addEventListener("change", submit));
  root.querySelector("[data-search-reset]").addEventListener("click", () => { filters.forEach(select => { select.value = ""; }); syncPublicSelects(root); submit(); });
  for (const [button, offset] of [[prev, -1], [next, 1]]) button.addEventListener("click", () => {
    params.set("page", String(page + offset)); updateUrl(); load(); count.scrollIntoView({ block: "center" });
  });
  retry.addEventListener("click", load);
  window.addEventListener("popstate", () => { restore(); load(); });
  restore(); load(); startContentRefresh(load);
}

export function initTempleSearch() {
  const controls = [...document.querySelectorAll("[data-temple-search]:not([data-search-mode=results])")].map(enhanceSuggestions);
  const dialog = document.querySelector("#temple-search-dialog");
  let opener, overflow;
  document.addEventListener("click", event => {
    const trigger = event.target.closest?.("[data-header-search]");
    if (!trigger || !dialog) return;
    event.preventDefault();
    controls.forEach(control => control.dismiss());
    opener = trigger; overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal(); dialog.querySelector("input").focus();
  });
  dialog?.querySelector("[data-search-close]").addEventListener("click", () => dialog.close());
  dialog?.addEventListener("keydown", event => {
    if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); dialog.close(); }
  });
  dialog?.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog?.addEventListener("close", () => {
    controls.forEach(control => control.dismiss());
    document.body.style.overflow = overflow || "";
    const target = opener?.getClientRects().length ? opener : document.querySelector(".mw-search");
    target?.focus({ preventScroll: true });
  });
  const page = document.querySelector("[data-search-page]");
  if (page) initResults(page);
}
