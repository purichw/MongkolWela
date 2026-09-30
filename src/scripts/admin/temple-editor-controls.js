export function createTempleEditorControls({ state, getRecord, getEdit, render, setStatus, cancel }) {
  let snapshot;
  let panels = {};
  let variant = "desktop";
  let scrollTop = 0;
  let focusField = "";
  let active = "place";
  let regions = [];
  let loadingAreas;
  let inertElements = [];
  let returnKey = "";

  const drawer = () => document.querySelector(".mw-place-editor");
  const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  const value = field => getEdit({ create: false })?.fields?.[field] ?? getRecord()?.temple?.[field] ?? "";

  function begin() {
    document.addEventListener("keydown", handleKeyDown);
    snapshot = structuredClone({ temples: state.content.temples, catalog: state.templeCatalog, dirty: state.dirty, search: state.templeSearch, key: state.selectedTempleKey });
    returnKey = state.selectedTempleKey;
    state.templeEditorSession = (state.templeEditorSession || 0) + 1;
    panels = { place: true, visit: false, images: innerWidth > 700 };
    variant = "desktop"; scrollTop = 0; focusField = ""; active = "place";
    if (!loadingAreas) {
      loadingAreas = fetch("/assets/data/temples-thailand-index.json").then(response => {
        if (!response.ok) throw new Error("Area index unavailable");
        return response.json();
      }).then(data => {
        regions = data.facets?.regions || [];
        if (state.templeEditorOpen) {
          // Late lookup data must not replace an open editor or its dropdown.
          drawer()?.querySelectorAll("select[data-temple-field]").forEach(select => {
            const field = select.dataset.templeField;
            if (!["region", "province", "district"].includes(field)) return;
            const selected = select.value;
            const empty = [...select.options].find(option => option.value === "")?.cloneNode(true);
            select.replaceChildren(...(empty ? [empty] : []), ...choices(field).map(option => new Option(option, option, false, option === selected)));
            select.value = selected;
          });
        }
      }).catch(() => { loadingAreas = null; });
    }
  }

  function finish(restore = false) {
    document.removeEventListener("keydown", handleKeyDown);
    if (restore && snapshot) {
      state.content.temples = snapshot.temples;
      state.templeCatalog = snapshot.catalog;
      state.dirty = snapshot.dirty;
      state.templeSearch = snapshot.search;
      state.selectedTempleKey = snapshot.key;
    }
    snapshot = null;
    state.templeEditorSession = (state.templeEditorSession || 0) + 1;
    release();
    requestAnimationFrame(() => {
      const target = document.querySelector(`[data-edit-temple="${CSS.escape(returnKey)}"]`) || document.querySelector('[data-action="add-temple"]');
      target?.focus({ preventScroll: true });
    });
  }

  function release() {
    inertElements.forEach(([element, previous]) => { element.inert = previous; });
    inertElements = [];
    document.documentElement.classList.remove("mw-place-editor-open");
  }

  function capture() {
    const root = drawer();
    if (!root) return;
    root.querySelectorAll("[data-editor-panel]").forEach(panel => { panels[panel.dataset.editorPanel] = panel.open; });
    scrollTop = root.querySelector(".mw-admin-drawer-body").scrollTop;
    const focused = document.activeElement;
    focusField = focused?.dataset.templeField || focused?.closest(".mw-select")?.querySelector("[data-temple-field]")?.dataset.templeField || "";
  }

  function mount() {
    release();
    const root = drawer();
    if (!root) return;
    document.documentElement.classList.add("mw-place-editor-open");
    for (const element of document.querySelectorAll('.mw-admin-sidebar, .mw-admin-main > :not(#adminContent), .mw-temples-workspace')) {
      inertElements.push([element, element.inert]); element.inert = true;
    }
    root.querySelector(".mw-admin-drawer-body").scrollTop = scrollTop;
    root.addEventListener("toggle", event => {
      const panel = event.target;
      if (!panel.matches("[data-editor-panel]")) return;
      panels[panel.dataset.editorPanel] = panel.open;
    }, true);
    requestAnimationFrame(() => {
      if (!root.isConnected) return;
      const input = focusField ? root.querySelector(`[data-temple-field="${focusField}"]`) : null;
      const target = input?.closest(".mw-select") || input || root.querySelector("#templeDrawerTitle");
      target?.focus({ preventScroll: true });
      root.querySelector(".mw-admin-drawer-body").scrollTop = scrollTop;
    });
  }

  function setActive(id) {
    active = id;
    drawer()?.querySelectorAll("[data-editor-jump]").forEach(button => {
      if (button.dataset.editorJump === id) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function openPanel(id, focus = true) {
    const panel = drawer()?.querySelector(`[data-editor-panel="${id}"]`);
    if (!panel) return;
    panel.open = true; panels[id] = true; setActive(id);
    panel.scrollIntoView({ block: "start", behavior: "instant" });
    if (focus) panel.querySelector("summary")?.focus({ preventScroll: true });
  }

  function click(event) {
    const root = event.target.closest(".mw-place-editor");
    if (!root) return false;
    const summary = event.target.closest("details[data-editor-panel] > summary");
    if (summary && ["place", "visit", "images"].includes(summary.parentElement.dataset.editorPanel)) setActive(summary.parentElement.dataset.editorPanel);
    const upload = event.target.closest("[data-editor-upload]");
    if (upload) { upload.closest(".mw-admin-image-field").querySelector("[data-temple-image-upload]").click(); return true; }
    const jump = event.target.closest("[data-editor-jump]");
    if (jump) { openPanel(jump.dataset.editorJump); return true; }
    const preview = event.target.closest("[data-editor-visit-kind]");
    if (preview) {
      openPanel("visit", false);
      const section = root.querySelector(`[data-visit-kind="${preview.dataset.editorVisitKind}"]`);
      section.open = true; section.scrollIntoView({ block: "start" }); section.querySelector("summary").focus();
      return true;
    }
    const media = event.target.closest("[data-editor-viewport]");
    if (media) {
      variant = media.dataset.editorViewport;
      root.querySelectorAll("[data-editor-viewport]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.editorViewport === variant)));
      root.querySelectorAll(".mw-admin-image-field").forEach(field => { field.hidden = field.dataset.imageViewport !== variant; });
      return true;
    }
    const manual = event.target.closest("[data-editor-manual]");
    if (manual) {
      const label = manual.closest("label"), field = manual.dataset.editorManual;
      const input = document.createElement("input"); input.dataset.templeField = field; input.value = value(field);
      input.setAttribute("aria-label", label.querySelector("select")?.getAttribute("aria-label") || field);
      label.querySelector(".mw-place-location-control").replaceChildren(input); input.focus();
      return true;
    }
    return false;
  }

  function choices(field) {
    const province = value("province"), region = value("region");
    let indexed = [];
    if (field === "region") indexed = regions.map(item => item.name);
    if (field === "province") indexed = regions.filter(item => !region || item.name === region).flatMap(item => item.provinces.map(province => province.name));
    if (field === "district") indexed = regions.flatMap(item => item.provinces).filter(item => item.name === province).flatMap(item => item.districts.map(district => district.name));
    const catalog = state.templeCatalog.filter(record => field === "region" || (field === "province" ? !region || record.temple.region === region : record.temple.province === province)).map(record => record.temple[field]);
    return unique([value(field), ...indexed, ...catalog]);
  }

  function changed(target) {
    if (!target.matches("select[data-temple-field='region'], select[data-temple-field='province']")) return;
    const field = target.dataset.templeField;
    const edit = getEdit(); const record = getRecord();
    const clear = key => { edit.fields[key] = ""; record.temple[key] = ""; };
    if (field === "region") { clear("province"); clear("district"); }
    else {
      clear("district");
      const region = regions.find(item => item.provinces.some(province => province.name === target.value))?.name;
      if (region) { edit.fields.region = region; record.temple.region = region; }
    }
    render();
  }

  function validate() {
    const root = drawer();
    if (!root) return false;
    const name = root.querySelector('[data-temple-field="name"]');
    name.setCustomValidity(name.value.trim() ? "" : "กรุณาระบุชื่อสถานที่");
    const invalid = [...root.querySelectorAll("[data-temple-field], [data-temple-visit], [data-temple-slug]")].find(input => !input.checkValidity());
    if (!invalid) return true;
    for (let parent = invalid.parentElement; parent && parent !== root; parent = parent.parentElement) if (parent.matches("details")) parent.open = true;
    setActive(invalid.closest('[id^="temple-editor-"]')?.dataset.editorPanel || "place");
    invalid.scrollIntoView({ block: "center" }); invalid.focus(); invalid.reportValidity();
    setStatus("กรุณาตรวจสอบข้อมูลในช่องที่ระบุ", "error"); return false;
  }

  function handleKeyDown(event) {
    if (!state.templeEditorOpen || event.defaultPrevented) return;
    const crop = document.querySelector("#templeCropOverlay.is-open");
    const confirm = document.querySelector("#adminConfirmDialog:not([hidden])");
    const root = crop || confirm || drawer();
    if (!root) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (crop) { crop.querySelector("[data-crop-close]")?.click(); drawer()?.querySelector('[data-editor-jump="images"]')?.focus(); }
      else if (confirm) confirm.querySelector("[data-confirm-cancel]")?.click();
      else if (!root.querySelector('[aria-expanded="true"][role="combobox"]')) cancel();
    }
    if (event.key !== "Tab") return;
    const focusable = [...root.querySelectorAll('a[href],button,input,textarea,select,summary,[tabindex="0"]')].filter(element => !element.disabled && element.getClientRects().length && !element.closest("[hidden], [inert]"));
    const first = focusable[0], last = focusable.at(-1);
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }

  return { begin, finish, capture, mount, click, choices, changed, validate, isOpen: id => Boolean(panels[id]), variant: () => variant, active: () => active };
}
