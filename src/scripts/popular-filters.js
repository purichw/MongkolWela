import { createChoiceChip } from "../lib/choice-chip.js";

export const normalizeFilterText = value => String(value || "").trim().toLocaleLowerCase("th-TH");
export const filterSnapshotKey = snapshot => JSON.stringify([
  normalizeFilterText(snapshot.query),
  ...["regions", "provinces", "purposes"].map(key => [...snapshot[key]].sort()),
]);

// A view adapter: the collection engine remains the sole owner of draft/applied data.
export function initializePopularFilters(root, engine) {
  const dialog = document.querySelector("#pf-editor");
  const triggers = [...root.querySelectorAll("[data-pf-group]")];
  const title = dialog.querySelector("h2");
  const search = dialog.querySelector("[data-pf-option-search]");
  const choices = dialog.querySelector("[data-pf-choices]");
  const count = dialog.querySelector("[data-pf-selection-count]");
  const selectedOnlyButton = dialog.querySelector("[data-pf-selected-only]");
  const message = dialog.querySelector("[data-pf-editor-status]");
  const status = root.querySelector("[data-pf-status]");
  const restore = root.querySelector("[data-pf-restore]");
  const retry = root.querySelector("[data-pf-retry]");
  const applied = root.querySelector("[data-pf-applied]");
  const labels = { provinces: "จังหวัด", purposes: "วัตถุประสงค์" };
  let editor = null;
  let releaseScroll = null;
  let frame = 0;
  let presenting = false;
  let notice = "";
  const optionNodes = new Map();
  const all = createChoiceChip({ kind: "button", label: "ทั้งหมด", className: "pf-editor__all" });
  choices.append(all);
  document.body.append(dialog);
  root.querySelectorAll("[disabled]").forEach(node => { node.disabled = false; });

  function close(restoreFocus = true) {
    if (!editor) return;
    const trigger = editor.trigger;
    editor = null;
    presenting = true;
    dialog.close();
    releaseScroll?.();
    releaseScroll = null;
    presenting = false;
    triggers.forEach(node => node.setAttribute("aria-expanded", "false"));
    if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
  }

  function lockScroll() {
    if (releaseScroll) return;
    const y = window.scrollY;
    const body = document.body;
    const props = { position: "fixed", top: `-${y}px`, width: "100%", overflow: "hidden" };
    const saved = Object.fromEntries(Object.keys(props).map(key => [key, body.style[key]]));
    Object.assign(body.style, props);
    releaseScroll = () => {
      for (const key of Object.keys(props)) {
        if (body.style[key] === props[key]) body.style[key] = saved[key];
      }
      window.scrollTo({ top: y, behavior: "instant" });
    };
  }

  function position() {
    if (!editor) return;
    const viewport = window.visualViewport;
    const height = viewport?.height || innerHeight;
    const top = viewport?.offsetTop || 0;
    const width = document.documentElement.clientWidth;
    const anchor = editor.trigger.getBoundingClientRect();
    const headerBottom = document.querySelector(".mw-header")?.getBoundingClientRect().bottom || 0;
    const lowerBound = Math.max(top + 16, headerBottom + 8);
    const below = height + top - anchor.bottom - 24;
    const above = anchor.top - lowerBound - 8;
    const chrome = [...dialog.children].filter(node => node !== choices).reduce((sum, node) => sum + node.getBoundingClientRect().height, 0) + 32;
    const needed = Math.max(320, chrome + 132);
    const popover = width >= 1024 && Math.max(below, above) >= needed;
    const mode = popover ? "popover" : width < 768 ? "sheet" : "modal";
    const modal = mode !== "popover";
    const focused = document.activeElement;
    const previousMode = dialog.dataset.mode;
    presenting = true;
    if (dialog.open && (previousMode === "popover") !== !modal) dialog.close();
    dialog.dataset.mode = mode;
    dialog.setAttribute("aria-modal", String(modal));
    if (modal) lockScroll();
    else { releaseScroll?.(); releaseScroll = null; }
    dialog.style.setProperty("--pf-available-height", `${Math.max(100, height - (height < 430 ? 0 : 24))}px`);
    dialog.classList.toggle("is-short", height < 430);
    if (popover) {
      const size = Math.min(480, Math.max(360, anchor.width), width - 32);
      const downward = below >= needed || below >= above;
      dialog.style.width = `${size}px`;
      dialog.style.left = `${Math.max(16, Math.min(anchor.left, width - size - 16))}px`;
      dialog.style.maxHeight = `${Math.min(480, downward ? below : above)}px`;
      dialog.style.top = `${downward ? anchor.bottom + 8 : anchor.top - 8}px`;
      dialog.style.transform = downward ? "none" : "translateY(-100%)";
    } else {
      dialog.style.width = "";
      dialog.style.left = "";
      dialog.style.maxHeight = "";
      dialog.style.top = mode === "sheet" ? `${top + height}px` : `${top + height / 2}px`;
      dialog.style.transform = mode === "sheet" ? "translateY(-100%)" : "translate(-50%, -50%)";
    }
    if (!dialog.open) {
      if (modal) dialog.showModal(); else dialog.show();
      if (focused && dialog.contains(focused)) focused.focus({ preventScroll: true });
    }
    presenting = false;
  }

  function schedulePosition() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(position);
  }

  function open(trigger, keyboard) {
    if (editor?.trigger === trigger) { close(); return; }
    close(false);
    document.querySelectorAll(".mw-nav-item[open]").forEach(node => { node.open = false; });
    const group = trigger.dataset.pfGroup;
    editor = { group, trigger, working: new Set(engine.read().draft[group]), selectedOnly: false };
    search.value = "";
    notice = "";
    title.textContent = `เลือก${labels[group]}`;
    search.placeholder = `ค้นหา${labels[group]}`;
    dialog.querySelector("[data-pf-search-label]").textContent = search.placeholder;
    trigger.setAttribute("aria-expanded", "true");
    optionNodes.forEach(node => node.remove());
    optionNodes.clear();
    renderOptions();
    position();
    (innerWidth >= 1024 || keyboard ? search : title).focus({ preventScroll: true });
    schedulePosition();
  }

  function renderOptions() {
    if (!editor) return;
    const state = engine.read();
    const { group, working, selectedOnly } = editor;
    const catalog = new Set(state.catalog[group]);
    const available = state.available[group];
    const values = [...state.catalog[group].filter(value => available.has(value) || working.has(value)), ...[...working].filter(value => !catalog.has(value))];
    const validValues = new Set(values);
    const query = normalizeFilterText(search.value);
    let visible = 0;
    for (const [value, node] of optionNodes) {
      if (!validValues.has(value)) { node.remove(); optionNodes.delete(value); }
    }
    for (const value of values) {
      let node = optionNodes.get(value);
      if (!node) {
        node = createChoiceChip({ label: value, value, className: "pf-option" });
        const input = node.querySelector("input");
        input.addEventListener("change", () => {
          if (!editor) return;
          if (input.checked) editor.working.add(value); else editor.working.delete(value);
          notice = "";
          renderOptions();
        });
        optionNodes.set(value, node);
        choices.append(node);
      }
      const missing = !catalog.has(value);
      node.querySelector("input").checked = working.has(value);
      node.querySelector(".ui-choice-chip__label").textContent = value + (missing ? " (ไม่มีในข้อมูลล่าสุด)" : "");
      node.hidden = (selectedOnly && !working.has(value)) || (query && !normalizeFilterText(value).includes(query));
      if (!node.hidden) visible++;
    }
    all.setAttribute("aria-pressed", String(working.size === 0));
    all.hidden = false;
    count.textContent = `เลือกแล้ว ${working.size} ${group === "provinces" ? "จังหวัด" : "รายการ"}`;
    selectedOnlyButton.textContent = selectedOnly ? "ดูทุกตัวเลือก" : `ดูที่เลือก (${working.size})`;
    selectedOnlyButton.setAttribute("aria-pressed", String(selectedOnly));
    message.textContent = notice || (!visible ? query ? "ไม่พบตัวเลือกที่ตรงกับคำค้น" : selectedOnly ? "ยังไม่ได้เลือกตัวเลือก" : state.loadState === "loading" ? "กำลังโหลดตัวเลือก…" : state.loadState === "error" ? "ข้อมูลยังไม่ครบ กรุณาลองโหลดอีกครั้ง" : "ไม่มีตัวเลือกที่ตรงกับเงื่อนไขอื่น" : "");
    message.hidden = !message.textContent;
    schedulePosition();
  }

  function summary(trigger, values) {
    const node = trigger.querySelector("[data-pf-summary]");
    const selected = [...values];
    let shown = Math.min(2, selected.length);
    const text = n => selected.slice(0, n).join(", ") + (selected.length > n ? ` +${selected.length - n}` : "");
    node.textContent = selected.length ? text(shown) : "ทั้งหมด";
    while (shown > 0 && node.scrollWidth > node.clientWidth + 1) {
      shown--;
      node.textContent = shown ? text(shown) : `เลือกแล้ว ${selected.length} ${trigger.dataset.pfGroup === "provinces" ? "จังหวัด" : "รายการ"}`;
    }
    trigger.setAttribute("aria-label", `${labels[trigger.dataset.pfGroup]}: ${selected.join(", ") || "ทั้งหมด"}`);
    trigger.title = selected.join(", ");
  }

  function refresh() {
    const state = engine.read();
    triggers.forEach(trigger => summary(trigger, state.draft[trigger.dataset.pfGroup]));
    const dirty = filterSnapshotKey(state.draft) !== filterSnapshotKey(state.applied);
    status.textContent = state.notice || (state.loadState === "error" ? "โหลดข้อมูลไม่ครบ ยังแสดงรายการเดิมอยู่" : state.loadState === "loading" ? "กำลังโหลดข้อมูลสถานที่…" : dirty ? "เปลี่ยนเงื่อนไขแล้ว · กดค้นหาเพื่อใช้กับผลลัพธ์" : "");
    restore.hidden = !dirty;
    retry.hidden = state.loadState !== "error";
    const groups = [
      ["คำค้น", state.applied.query],
      ["ภาค", [...state.applied.regions].join(", ")],
      ["จังหวัด", [...state.applied.provinces].join(", ")],
      ["วัตถุประสงค์", [...state.applied.purposes].join(", ")],
      ["การเรียง", state.nearby ? "ใกล้ตำแหน่งปัจจุบัน" : ""],
    ].filter(([, value]) => value);
    applied.hidden = !groups.length;
    root.querySelector("[data-pf-applied-summary]").textContent = `เงื่อนไขที่ใช้กับผลลัพธ์ (${groups.length})`;
    const details = root.querySelector("[data-pf-applied-details]");
    details.replaceChildren(...groups.flatMap(([key, value]) => {
      const dt = document.createElement("dt"); dt.textContent = key;
      const dd = document.createElement("dd"); dd.textContent = value;
      return [dt, dd];
    }));
    renderOptions();
  }

  triggers.forEach(trigger => trigger.addEventListener("click", event => open(trigger, event.detail === 0)));
  all.addEventListener("click", () => { editor?.working.clear(); notice = ""; renderOptions(); });
  dialog.querySelector("[data-pf-clear-working]").addEventListener("click", () => { editor?.working.clear(); notice = ""; renderOptions(); });
  selectedOnlyButton.addEventListener("click", () => { if (editor) editor.selectedOnly = !editor.selectedOnly; renderOptions(); });
  search.addEventListener("input", () => { notice = ""; renderOptions(); });
  search.addEventListener("keydown", event => { if (event.key === "Enter") event.preventDefault(); });
  dialog.querySelector("[data-pf-done]").addEventListener("click", () => {
    if (!editor) return;
    const known = new Set(engine.read().catalog[editor.group]);
    if ([...editor.working].some(value => !known.has(value))) {
      notice = "บางตัวเลือกไม่มีในข้อมูลล่าสุด กรุณานำออกก่อนยืนยัน";
      renderOptions();
      return;
    }
    engine.setGroup(editor.group, editor.working);
    close();
    refresh();
  });
  dialog.querySelector("[data-pf-close]").addEventListener("click", () => close());
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button, input")].filter(node => !node.disabled && node.getClientRects().length);
    const first = focusable[0]; const last = focusable.at(-1);
    if (dialog.dataset.mode === "popover") {
      if ((!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        const trigger = editor.trigger;
        const pageControls = [...document.querySelectorAll("a[href], button, input, select, summary")].filter(node => !dialog.contains(node) && !node.disabled && node.getClientRects().length);
        const next = event.shiftKey ? trigger : pageControls[pageControls.indexOf(trigger) + 1];
        close(false);
        next?.focus();
      }
      return;
    }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.addEventListener("pointerdown", event => {
    if (!editor) return;
    if (dialog.contains(event.target) && event.target !== dialog) return;
    if (triggers.some(trigger => trigger.contains(event.target))) return;
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom) return;
    close(false);
  }, true);
  document.addEventListener("focusin", event => {
    if (!presenting && editor && dialog.dataset.mode === "popover" && !dialog.contains(event.target) && !triggers.some(trigger => trigger.contains(event.target))) close(false);
  });
  document.addEventListener("click", event => {
    if (event.target.closest?.(".mw-menu-toggle, [data-temple-map-open]")) close(false);
  }, true);
  document.addEventListener("mw:map-open", () => close(false));
  window.addEventListener("resize", () => { refresh(); schedulePosition(); });
  window.addEventListener("scroll", schedulePosition, { passive: true });
  window.visualViewport?.addEventListener("resize", schedulePosition);
  window.visualViewport?.addEventListener("scroll", schedulePosition);
  window.addEventListener("pagehide", () => close(false));
  restore.addEventListener("click", () => { close(false); engine.restore(); refresh(); });
  retry.addEventListener("click", () => engine.retry());
  return { refresh, cancel: () => close(false) };
}
