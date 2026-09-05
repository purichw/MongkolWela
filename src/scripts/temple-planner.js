import { createPlannerPicker } from "./planner/picker.js";
import { createPlannerResults } from "./planner/results.js";
import { createPlannerMaps } from "./planner/maps.js";
import { createPlannerStorage } from "./planner/storage.js";
import { getThailandNow, parseTime, formatClock, formatMinutes, formatMinutesRange, formatDistance, formatDistanceRange, normalize, toRadians, escapeHtml, prefersReducedMotion } from "./planner/format.js";
import { createLatestRequest } from "./request.js";
import { loadPlannerCatalog, requestPlannerPlan, reconcileCatalog } from "./planner/api.js";

const root = document.querySelector("[data-temple-planner]");
const PLANNER_PICKER_BATCH_SIZE = 12;

const { persistState, restoreState } = createPlannerStorage({ getTargetCount });

const { refreshSelectionMap, ensureSelectionMap, updateSelectionMarker, createSelectionIcon, renderSelectionPopup, renderRouteMap, addTiles, ensureLeaflet, loadStylesheet, loadScript } = createPlannerMaps({ getPickerItems, getStartPoint, toggleSelection, haversineKm, formatDistance, escapeHtml });

const { renderSummary, renderWarnings, renderTimelineItem } = createPlannerResults({ formatDistance, formatMinutes, formatClock, escapeHtml, formatDistanceRange, formatMinutesRange, buildSingleMapUrl });

const { renderPicker, revealPlannerPlaceCards, queuePlannerCardReveal, assignPlannerRevealDelays, renderSelected } = createPlannerPicker({ getPickerItems, getStartPoint, renderPickerContext, haversineKm, formatDistance, getPickerRecommendationText, escapeHtml, prefersReducedMotion });

if (root) {
  root.setAttribute("aria-busy", "true");
  loadTemplePlannerPayload(root)
    .then((payload) => initializeTemplePlanner(root, payload))
    .catch((error) => showPlannerLoadError(root, error))
    .finally(() => {
      root.removeAttribute("aria-busy");
    });
}

async function loadTemplePlannerPayload(planner) {
  const dataSrc = planner.dataset.plannerDataSrc;
  if (!dataSrc) throw new Error("Planner data source is missing.");

  return loadPlannerCatalog(dataSrc);
}

function showPlannerLoadError(planner, error) {
  console.warn("โหลดข้อมูลวางแผนไหว้พระไม่สำเร็จ", error);
  planner.dataset.plannerLoadError = "true";
  const status = planner.querySelector("[data-planner-location-status]");
  if (status) {
    status.textContent = "โหลดข้อมูลสถานที่ไม่สำเร็จ ";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "ลองใหม่";
    retry.addEventListener("click", async () => {
      retry.disabled = true;
      try {
        const payload = await loadTemplePlannerPayload(planner);
        delete planner.dataset.plannerLoadError;
        initializeTemplePlanner(planner, payload);
      } catch (error) { showPlannerLoadError(planner, error); }
    }, { once: true });
    status.append(retry);
  }
}

function initializeTemplePlanner(planner, payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const itemById = new Map(items.map((item) => [item.id, item]));
  const elements = collectElements(planner);
  const state = {
    items,
    itemById,
    revision: payload.revision,
    planRequests: createLatestRequest(),
    selected: [],
    plan: [],
    visibleCount: PLANNER_PICKER_BATCH_SIZE,
    currentLocation: null,
    pinnedStartId: "",
    activeRegions: new Set(),
    activeProvinces: new Set(),
    activePurposes: new Set(),
    manualSelectionOrder: false,
    planDetails: null,
    pickerReady: true,
    hasPlannerAction: false,
    nearbyMode: false,
    tripCriteria: null,
    pickerContext: createPickerContext("browse", { mode: "recommended" }),
    selectionMap: null,
    selectionCluster: null,
    selectionMarkers: new Map(),
    routeMap: null,
    routeLayer: null,
    dialogAction: null,
    dialogTrigger: null,
  };

  planner._plannerState = { state, elements };
  populatePlannerStartSuggestions(state, elements);
  initializeSmoothFilterAccordions(planner);
  initializePlannerHelp(planner);
  const restored = restoreState(state, elements);
  applyPlannerSearchParams(state, elements);
  applyPlannerDefaults(state, elements, restored);
  enforcePlannerDateTimeBounds(elements, { snap: true });
  applyPinnedStart(state, elements);
  bindControls(state, elements);
  synchronizeFilterOptions(state, elements, "restore");
  syncPlannerAreaHint(elements);
  syncOriginTextFromPinnedStart(state, elements);
  updateStartWarning(state, elements);
  state.pickerContext.criteria = getDraftCriteria(state, elements);
  elements.pickSection.hidden = true;
  renderSelected(state, elements);
  updateTargetCount(state, elements);
  renderPicker(state, elements);
  if (state.plan.length) {
    refreshPlanFromServer(state, elements, { scroll: false, manualSelectionOrder: true, quiet: true });
  } else {
    updateTripSource(state, elements);
    updateCriteriaNotice(state, elements);
  }
  elements.locationStatus.textContent = "";
}

function collectElements(planner) {
  return {
    countInputs: [...planner.querySelectorAll('input[name="planner-count"]')],
    budget: planner.querySelector("[data-planner-budget]"),
    startDate: planner.querySelector("[data-planner-start-date]"),
    startTime: planner.querySelector("[data-planner-start-time]"),
    regionTags: [...planner.querySelectorAll("[data-planner-region-tag]")],
    provinceFilter: planner.querySelector("[data-planner-province-filter]"),
    provinceTags: planner.querySelector("[data-planner-province-tags]"),
    provinceSummary: planner.querySelector("[data-temple-province-summary]"),
    purposeTags: [...planner.querySelectorAll("[data-planner-purpose-tag]")],
    purposeSummary: planner.querySelector("[data-temple-purpose-summary]"),
    area: planner.querySelector("[data-planner-area]"),
    areaHint: planner.querySelector("[data-planner-area-hint-display]"),
    originText: planner.querySelector("[data-planner-origin-text]"),
    startSuggestions: planner.querySelector("#planner-start-suggestions"),
    defaultPurpose: planner.dataset.plannerDefaultPurpose || "",
    start: planner.querySelector("[data-planner-start]"),
    radius: planner.querySelector("[data-planner-radius]"),
    startWarning: planner.querySelector("[data-planner-start-warning]"),
    locationButton: planner.querySelector("[data-planner-location]"),
    locationStatus: planner.querySelector("[data-planner-location-status]"),
    resetFilters: planner.querySelector("[data-planner-reset-filters]"),
    criteriaNotice: planner.querySelector("[data-planner-criteria-notice]"),
    criteriaRebuild: planner.querySelector("[data-planner-criteria-rebuild]"),
    criteriaRestore: planner.querySelector("[data-planner-criteria-restore]"),
    filterSearchButtons: [...planner.querySelectorAll("[data-planner-filter-search]")],
    autoButton: planner.querySelector("[data-planner-auto]"),
    pickerTabs: [...planner.querySelectorAll("[data-planner-picker-tab]")],
    pickerPanels: [...planner.querySelectorAll("[data-planner-picker-panel]")],
    search: planner.querySelector("[data-planner-search]"),
    pickerContext: planner.querySelector("[data-planner-picker-context]"),
    pickerKicker: planner.querySelector("[data-planner-picker-kicker]"),
    pickerTitle: planner.querySelector("[data-planner-picker-title]"),
    pickerDescription: planner.querySelector("[data-planner-picker-description]"),
    pickerChips: planner.querySelector("[data-planner-picker-chips]"),
    pickerSearch: planner.querySelector("[data-planner-picker-search]"),
    pickerModeButtons: [...planner.querySelectorAll("[data-planner-picker-mode]")],
    pickerToggleScope: planner.querySelector("[data-planner-picker-toggle-scope]"),
    pickerNote: planner.querySelector("[data-planner-picker-note]"),
    grid: planner.querySelector("[data-planner-place-grid]"),
    moreButton: planner.querySelector("[data-planner-more]"),
    empty: planner.querySelector("[data-planner-empty]"),
    selectedTray: planner.querySelector("[data-planner-selected-tray]"),
    selectedCount: planner.querySelector("[data-planner-selected-count]"),
    targetCount: planner.querySelector("[data-planner-target-count]"),
    selectionMap: planner.querySelector("[data-planner-selection-map]"),
    buildButton: planner.querySelector("[data-planner-build]"),
    clearSelection: planner.querySelector("[data-planner-clear-selection]"),
    result: planner.querySelector("[data-planner-result]"),
    editButton: planner.querySelector("[data-planner-edit]"),
    clearTrip: planner.querySelector("[data-planner-clear-trip]"),
    tripSource: planner.querySelector("[data-planner-trip-source]"),
    summary: planner.querySelector("[data-planner-summary]"),
    warnings: planner.querySelector("[data-planner-warnings]"),
    resultTabs: [...planner.querySelectorAll("[data-planner-result-tab]")],
    resultPanels: [...planner.querySelectorAll("[data-planner-result-panel]")],
    timeline: planner.querySelector("[data-planner-timeline]"),
    routeMap: planner.querySelector("[data-planner-route-map]"),
    saveButton: planner.querySelector("[data-planner-save]"),
    googleLink: planner.querySelector("[data-planner-google]"),
    pickSection: planner.querySelector("#planner-pick"),
    setup: planner.querySelector(".planner-setup"),
    dialog: planner.querySelector("[data-planner-dialog]"),
    dialogKicker: planner.querySelector("[data-planner-dialog-kicker]"),
    dialogTitle: planner.querySelector("[data-planner-dialog-title]"),
    dialogMessage: planner.querySelector("[data-planner-dialog-message]"),
    dialogCancel: planner.querySelector("[data-planner-dialog-cancel]"),
    dialogConfirm: planner.querySelector("[data-planner-dialog-confirm]"),
    dialogCloseButtons: [...planner.querySelectorAll("[data-planner-dialog-close], [data-planner-dialog-cancel]")],
  };
}

function populatePlannerStartSuggestions(state, elements) {
  if (!elements.startSuggestions) return;
  elements.startSuggestions.innerHTML = state.items
    .slice(0, 80)
    .map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.province)}</option>`)
    .join("");
}

function applyPlannerDefaults(state, elements, restored = {}) {
  const hasSavedArea = Boolean(restored.region || restored.regions?.length || restored.province || restored.provinces?.length);
  if (elements.area) {
    if (hasSavedArea) syncAreaControlFromState(state, elements);
    else applyAreaFilterFromControl(state, elements);
    syncPlannerAreaHint(elements);
  }

  const hasSavedPurpose = Boolean(restored.purpose || restored.purposes?.length);
  if (!hasSavedPurpose && !state.activePurposes.size && elements.defaultPurpose) {
    state.activePurposes.add(elements.defaultPurpose);
  }
}

function parsePlannerAreaValue(value = "") {
  if (!value) return { regions: [], provinces: [] };
  const [type, raw = ""] = String(value).split(":");
  const values = raw.split("|").map((item) => item.trim()).filter(Boolean);
  if (type === "region") return { regions: values, provinces: [] };
  if (type === "province" || type === "provinces") return { regions: [], provinces: values };
  return { regions: [], provinces: [] };
}

function applyAreaFilterFromControl(state, elements) {
  if (!elements.area) return;
  const { regions, provinces } = parsePlannerAreaValue(elements.area.value);
  state.activeRegions = new Set(regions);
  state.activeProvinces = new Set(provinces);
  syncPlannerAreaHint(elements);
}

function syncAreaControlFromState(state, elements) {
  if (!elements.area) return;
  const regionKey = [...state.activeRegions].sort().join("|");
  const provinceKey = [...state.activeProvinces].sort().join("|");
  const match = [...elements.area.options].find((option) => {
    const parsed = parsePlannerAreaValue(option.value);
    return parsed.regions.sort().join("|") === regionKey && parsed.provinces.sort().join("|") === provinceKey;
  });
  elements.area.value = match?.value || "";
  syncPlannerAreaHint(elements);
}

function syncPlannerAreaHint(elements) {
  if (!elements.area || !elements.areaHint) return;
  const selected = elements.area.selectedOptions?.[0];
  elements.areaHint.textContent = selected?.dataset.plannerAreaHint || selected?.getAttribute("data-planner-area-hint") || "เลือกจังหวัดหรือย่านที่จะเดินทาง";
}

function syncOriginTextFromPinnedStart(state, elements) {
  if (!elements.originText) return;
  const pinnedStart = getPinnedStartItem(state, elements);
  if (pinnedStart && !elements.originText.value) elements.originText.value = pinnedStart.name;
}

function syncPinnedStartFromOriginText(state, elements) {
  if (!elements.originText || !elements.start) return;
  const query = normalize(elements.originText.value);
  const match = query
    ? state.items.find((item) => normalize(item.name) === query)
      || state.items.find((item) => normalize(item.name).includes(query) || query.includes(normalize(item.name)))
    : null;
  elements.start.value = match?.id || "";
  state.currentLocation = null;
  applyPinnedStart(state, elements);
  updateStartWarning(state, elements);
}

function bindControls(state, elements) {
  elements.countInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const target = getTargetCount(elements);
      if (!hasVisiblePlan(state, elements) && state.selected.length > target) state.selected = state.selected.slice(0, target);
      const planSynced = hasVisiblePlan(state, elements) ? false : synchronizePlanWithSelection(state, elements);
      resetPlannerVisibleCount(state);
      renderSelected(state, elements);
      renderPicker(state, elements);
      updateTargetCount(state, elements);
      updateCriteriaNotice(state, elements);
      if (planSynced) renderPlan(state, elements, { scroll: false });
      else persistState(state, elements);
    });
  });

  elements.regionTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      const value = tag.value || "";
      if (!value) {
        state.activeRegions.clear();
        state.activeProvinces.clear();
      } else if (state.activeRegions.has(value)) {
        state.activeRegions.delete(value);
        state.activeProvinces.forEach((province) => {
          const item = state.items.find((candidate) => candidate.province === province);
          if (item?.region === value) state.activeProvinces.delete(province);
        });
      } else {
        state.activeRegions.add(value);
      }
      applyPlannerFilterChange(state, elements);
    });
  });

  elements.provinceTags?.addEventListener("click", (event) => {
    const tag = event.target.closest("[data-planner-province-tag]");
    if (!tag) return;
    const value = tag.value || "";
    if (!value) {
      state.activeProvinces.clear();
    } else if (state.activeProvinces.has(value)) {
      state.activeProvinces.delete(value);
    } else {
      state.activeProvinces.add(value);
      const item = state.items.find((candidate) => candidate.province === value);
      if (item?.region) state.activeRegions.add(item.region);
    }
    applyPlannerFilterChange(state, elements);
  });

  elements.purposeTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      const value = tag.value || "";
      if (!value) {
        state.activePurposes.clear();
      } else if (state.activePurposes.has(value)) {
        state.activePurposes.delete(value);
      } else {
        state.activePurposes.add(value);
      }
      applyPlannerFilterChange(state, elements);
    });
  });

  elements.area?.addEventListener("change", () => {
    applyAreaFilterFromControl(state, elements);
    applyPlannerFilterChange(state, elements);
  });

  elements.originText?.addEventListener("input", () => {
    syncPinnedStartFromOriginText(state, elements);
    updateCriteriaNotice(state, elements);
    persistState(state, elements);
  });

  [elements.budget, elements.startDate, elements.startTime, elements.radius].forEach((control) => {
    control?.addEventListener("change", () => {
      if (control === elements.startDate || control === elements.startTime) {
        enforcePlannerDateTimeBounds(elements, { snap: true });
      }
      updateCriteriaNotice(state, elements);
      persistState(state, elements);
    });
  });

  elements.radius?.addEventListener("change", () => {
    if (!state.nearbyMode || !state.currentLocation || !state.pickerReady) return;
    showNearbyPlaces(state, elements);
  });

  elements.start?.addEventListener("change", () => {
    state.currentLocation = null;
    const hasPlan = hasVisiblePlan(state, elements);
    if (!hasPlan) applyPinnedStart(state, elements);
    const planSynced = hasPlan ? false : synchronizePlanWithSelection(state, elements);
    state.nearbyMode = false;
    updateStartWarning(state, elements);
    renderSelected(state, elements);
    if (state.pickerReady) {
      renderPicker(state, elements);
      refreshSelectionMap(state, elements);
    }
    updateCriteriaNotice(state, elements);
    if (planSynced) renderPlan(state, elements, { scroll: false });
    else persistState(state, elements);
  });

  elements.search?.addEventListener("input", () => {
    resetPlannerVisibleCount(state);
    updateCriteriaNotice(state, elements);
    if (!state.pickerReady || state.pickerContext.type === "browse") {
      renderPicker(state, elements);
      refreshSelectionMap(state, elements);
    }
    persistState(state, elements);
  });

  elements.pickerSearch?.addEventListener("input", () => {
    resetPlannerVisibleCount(state);
    state.pickerContext.query = elements.pickerSearch.value || "";
    renderPicker(state, elements);
    refreshSelectionMap(state, elements);
  });

  elements.pickerModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.pickerContext.mode = button.dataset.plannerPickerMode || "recommended";
      resetPlannerVisibleCount(state);
      renderPicker(state, elements);
      refreshSelectionMap(state, elements);
    });
  });

  elements.pickerToggleScope?.addEventListener("click", () => {
    state.pickerContext.useCriteria = !state.pickerContext.useCriteria;
    resetPlannerVisibleCount(state);
    renderPicker(state, elements);
    refreshSelectionMap(state, elements);
  });

  elements.moreButton?.addEventListener("click", () => {
    revealMorePlannerPlaces(state, elements);
    renderPicker(state, elements);
  });

  elements.grid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-planner-toggle-place]");
    if (!button) return;
    toggleSelection(state, elements, button.dataset.plannerTogglePlace);
  });

  elements.selectedTray?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-planner-remove-selected]");
    if (!button) return;
    toggleSelection(state, elements, button.dataset.plannerRemoveSelected, false);
  });
  bindSelectedTrayDrag(state, elements);

  elements.pickerTabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab, elements.pickerTabs, elements.pickerPanels, "plannerPickerTab"));
  });

  elements.resultTabs.forEach((tab) => {
    tab.addEventListener("click", async () => {
      activateTab(tab, elements.resultTabs, elements.resultPanels, "plannerResultTab");
      if (tab.dataset.plannerResultTab === "map") {
        await ensureLeaflet();
        renderRouteMap(state, elements);
      }
    });
  });

  elements.locationButton?.addEventListener("click", () => requestCurrentLocation(state, elements));
  elements.resetFilters?.addEventListener("click", () => resetSearchFilters(state, elements));
  elements.criteriaRebuild?.addEventListener("click", () => {
    confirmAutomaticPlan(state, elements, elements.criteriaRebuild);
  });
  elements.criteriaRestore?.addEventListener("click", () => {
    if (!state.tripCriteria) return;
    applyCriteriaToControls(state, elements, state.tripCriteria);
    synchronizeFilterOptions(state, elements);
    updateStartWarning(state, elements);
    updateCriteriaNotice(state, elements);
    renderPicker(state, elements);
    refreshSelectionMap(state, elements);
    elements.locationStatus.textContent = "คืนค่าเงื่อนไขเดิมของแผนแล้ว";
    persistState(state, elements);
  });
  elements.filterSearchButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      showFilteredPlaces(state, elements);
    });
  });
  elements.autoButton?.addEventListener("click", () => {
    confirmAutomaticPlan(state, elements, elements.autoButton);
  });
  elements.buildButton?.addEventListener("click", () => buildSelectedPlan(state, elements));
  elements.clearSelection?.addEventListener("click", () => {
    state.selected = [];
    state.plan = [];
    state.planDetails = null;
    renderSelected(state, elements);
    renderPicker(state, elements);
    refreshSelectionMap(state, elements);
    elements.result.hidden = true;
    persistState(state, elements);
  });
  elements.clearTrip?.addEventListener("click", () => clearTrip(state, elements));
  elements.editButton?.addEventListener("click", () => {
    showManualEditMode(state, elements);
  });
  elements.saveButton?.addEventListener("click", () => {
    persistState(state, elements);
    elements.saveButton.textContent = "บันทึกแล้ว";
    setTimeout(() => {
      elements.saveButton.textContent = "บันทึกแผน";
    }, 1600);
  });
  elements.timeline?.addEventListener("click", (event) => handleTimelineAction(event, state, elements));
  elements.dialogCloseButtons.forEach((button) => button.addEventListener("click", () => closePlannerDialog(state, elements)));
  elements.dialogConfirm?.addEventListener("click", () => {
    const action = state.dialogAction;
    closePlannerDialog(state, elements, { restoreFocus: false });
    action?.();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.dialog?.hidden) closePlannerDialog(state, elements);
  });
  bindTimelineDrag(state, elements);
}

function applyPlannerFilterChange(state, elements) {
  resetPlannerVisibleCount(state);
  state.nearbyMode = false;
  synchronizeFilterOptions(state, elements);
  updateStartWarning(state, elements);
  updateCriteriaNotice(state, elements);
  if (state.pickerReady) {
    renderPicker(state, elements);
    refreshSelectionMap(state, elements);
  }
  persistState(state, elements);
}

function resetPlannerVisibleCount(state) {
  state.visibleCount = PLANNER_PICKER_BATCH_SIZE;
}

function revealMorePlannerPlaces(state, elements) {
  const total = getPickerItems(state, elements).length;
  state.visibleCount = Math.min(total, state.visibleCount + PLANNER_PICKER_BATCH_SIZE);
}

function initializePlannerHelp(planner) {
  const helps = [...planner.querySelectorAll("[data-planner-help]")];
  if (!helps.length) return;

  const closeHelp = (help) => {
    help.classList.remove("is-open");
    help.querySelector("[data-planner-help-toggle]")?.setAttribute("aria-expanded", "false");
    help.querySelector("[data-planner-help-panel]")?.setAttribute("aria-hidden", "true");
  };
  const closeOthers = (activeHelp) => {
    helps.forEach((help) => {
      if (help !== activeHelp) closeHelp(help);
    });
  };

  helps.forEach((help) => {
    const button = help.querySelector("[data-planner-help-toggle]");
    if (!button) return;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = help.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
      help.querySelector("[data-planner-help-panel]")?.setAttribute("aria-hidden", String(!isOpen));
      if (isOpen) closeOthers(help);
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("[data-planner-help]")) return;
    helps.forEach(closeHelp);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    helps.forEach(closeHelp);
  });
}

function activateTab(activeTab, tabs, panels, dataKey) {
  const value = activeTab.dataset[dataKey];
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab === activeTab)));
  panels.forEach((panel) => {
    panel.hidden = panel.dataset[dataKey.replace("Tab", "Panel")] !== value;
  });

  if (dataKey === "plannerPickerTab" && value === "map") {
    ensureLeaflet()
      .then(() => initializeSelectionMap(activeTab.closest("[data-temple-planner]"), panels, value))
      .catch(() => {});
  }
}

function initializeSelectionMap(planner, panels, value) {
  if (value !== "map") return;
  const panel = panels.find((candidate) => candidate.dataset.plannerPickerPanel === "map");
  panel?.dispatchEvent(new CustomEvent("planner:map-visible", { bubbles: true }));
  const rootElement = planner || root;
  const mapElement = rootElement?.querySelector("[data-planner-selection-map]");
  if (!mapElement) return;
  const context = mapElement._plannerContext;
  if (context) {
    setTimeout(() => context.state.selectionMap?.invalidateSize(), 40);
    return;
  }
}


function bindSelectedTrayDrag(state, elements) {
  let draggedId = "";

  elements.selectedTray?.addEventListener("dragstart", (event) => {
    const chip = event.target.closest("[data-planner-selected-id]");
    if (!chip || event.target.closest("button")) return;
    draggedId = chip.dataset.plannerSelectedId;
    chip.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedId);
  });

  elements.selectedTray?.addEventListener("dragover", (event) => {
    const chip = event.target.closest("[data-planner-selected-id]");
    if (!chip || !draggedId || chip.dataset.plannerSelectedId === draggedId) return;
    event.preventDefault();
    chip.classList.add("is-drop-target");
  });

  elements.selectedTray?.addEventListener("dragleave", (event) => {
    event.target.closest("[data-planner-selected-id]")?.classList.remove("is-drop-target");
  });

  elements.selectedTray?.addEventListener("drop", (event) => {
    const chip = event.target.closest("[data-planner-selected-id]");
    if (!chip || !draggedId) return;
    event.preventDefault();
    reorderSelectedPlace(state, elements, draggedId, chip.dataset.plannerSelectedId);
  });

  elements.selectedTray?.addEventListener("dragend", () => {
    draggedId = "";
    elements.selectedTray
      .querySelectorAll(".planner-selected-chip")
      .forEach((chip) => chip.classList.remove("is-dragging", "is-drop-target"));
  });
}

function reorderSelectedPlace(state, elements, fromId, toId) {
  const pinnedStart = getPinnedStartItem(state, elements);
  if (pinnedStart?.id === fromId) {
    elements.locationStatus.textContent = `${pinnedStart.name} ถูกกำหนดเป็นสถานที่แรกของแผนอยู่แล้ว`;
    return;
  }

  const nextSelected = [...state.selected];
  const fromIndex = nextSelected.indexOf(fromId);
  let toIndex = nextSelected.indexOf(toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

  const [movedId] = nextSelected.splice(fromIndex, 1);
  if (pinnedStart && toIndex === 0) toIndex = 1;
  if (fromIndex < toIndex) toIndex -= 1;
  nextSelected.splice(toIndex, 0, movedId);

  state.selected = nextSelected;
  state.manualSelectionOrder = true;
  const planSynced = synchronizePlanWithSelection(state, elements);
  renderSelected(state, elements);
  renderPicker(state, elements);
  refreshSelectionMap(state, elements);
  if (planSynced) renderPlan(state, elements, { scroll: false });
  else persistState(state, elements);
}

function toggleSelection(state, elements, id, force) {
  if (!state.itemById.has(id)) return;
  state.hasPlannerAction = true;
  const index = state.selected.indexOf(id);
  const shouldSelect = force ?? index === -1;
  const replacementContext = state.pickerContext?.type === "replace" ? state.pickerContext : null;
  if (!shouldSelect && index !== -1) {
    state.selected.splice(index, 1);
    if (id === elements.start?.value) {
      elements.start.value = "";
      state.pinnedStartId = "";
    }
  }
  if (shouldSelect && index === -1) {
    const target = getTargetCount(elements);
    if (state.selected.length >= target) {
      elements.locationStatus.textContent = `เลือกได้สูงสุด ${target.toLocaleString("th-TH")} แห่งสำหรับแผนนี้`;
      return;
    }
    if (replacementContext) {
      const insertIndex = clampIndex(Number(replacementContext.replaceIndex), state.selected.length);
      state.selected.splice(insertIndex, 0, id);
      state.manualSelectionOrder = true;
      elements.locationStatus.textContent = `เลือกสถานที่ใหม่แทนจุดที่ ${(insertIndex + 1).toLocaleString("th-TH")} แล้ว`;
    } else {
      state.selected.push(id);
    }
  }
  const planSynced = synchronizePlanWithSelection(state, elements);
  renderSelected(state, elements);
  renderPicker(state, elements);
  refreshSelectionMap(state, elements);
  if (planSynced) renderPlan(state, elements, { scroll: false });
  else persistState(state, elements);
}

function synchronizePlanWithSelection(state, elements) {
  const pinnedStart = getPinnedStartItem(state, elements);
  if (pinnedStart) {
    state.selected = [pinnedStart.id, ...state.selected.filter((id) => id !== pinnedStart.id)].slice(0, getTargetCount(elements));
  }
  if (!state.plan.length && elements.result.hidden) return false;

  const planItems = state.selected
    .map((id) => state.itemById.get(id))
    .filter(Boolean);

  state.plan = planItems;
  state.selected = state.plan.map((item) => item.id);
  state.planDetails = null;

  if (!state.plan.length) {
    elements.result.hidden = true;
    elements.timeline.innerHTML = "";
    elements.summary.innerHTML = "";
    elements.warnings.hidden = true;
    elements.warnings.innerHTML = "";
    return false;
  }

  return true;
}

function applyPinnedStart(state, elements) {
  const previousStartId = state.pinnedStartId;
  const nextStartId = elements.start?.value || "";
  if (previousStartId && previousStartId !== nextStartId) {
    state.selected = state.selected.filter((id) => id !== previousStartId);
    state.plan = state.plan.filter((item) => item.id !== previousStartId);
    state.planDetails = null;
  }

  state.pinnedStartId = nextStartId;
  const pinnedStart = getPinnedStartItem(state, elements);
  if (!pinnedStart) return;

  state.selected = [pinnedStart.id, ...state.selected.filter((id) => id !== pinnedStart.id)].slice(0, getTargetCount(elements));
  if (state.plan.length) {
    state.plan = [pinnedStart, ...state.plan.filter((item) => item.id !== pinnedStart.id)];
    state.planDetails = null;
  }
}

function getFilteredItems(state, elements) {
  return getItemsByCriteria(state, getDraftCriteria(state, elements));
}

function getPickerItems(state, elements) {
  const context = state.pickerContext || createPickerContext("browse");
  const criteria = context.useCriteria === false
    ? createEmptyCriteria(elements)
    : context.criteria || state.tripCriteria || getDraftCriteria(state, elements);
  const query = normalize(elements.pickerSearch?.value || context.query || "");
  const base = getItemsByCriteria(state, { ...criteria, query: "" }).filter((item) => matchesSearch(item, query));

  if (context.type === "nearby" && state.currentLocation) {
    return base.sort((left, right) => haversineKm(state.currentLocation, left) - haversineKm(state.currentLocation, right));
  }

  if (context.mode === "browse") {
    return base.sort((left, right) => {
      const selectedDifference = Number(state.selected.includes(right.id)) - Number(state.selected.includes(left.id));
      return selectedDifference || left.globalRank - right.globalRank || right.globalMentions - left.globalMentions;
    });
  }

  if (context.type === "replace") {
    return sortReplacementCandidates(state, context, base);
  }

  if (context.type === "trip") {
    return sortTripEditCandidates(state, base);
  }

  return base;
}

function getItemsByCriteria(state, criteria) {
  const query = normalize(criteria.query);
  if (criteria.nearbyMode && criteria.currentLocation) {
    const radiusKm = getCriteriaRadiusKm(criteria);
    return state.items
      .filter((item) => {
        if (Number.isFinite(radiusKm) && haversineKm(criteria.currentLocation, item) > radiusKm) return false;
        return matchesSearch(item, query);
      })
      .sort((left, right) => haversineKm(criteria.currentLocation, left) - haversineKm(criteria.currentLocation, right));
  }

  const regions = new Set(criteria.regions || []);
  const provinces = new Set(criteria.provinces || []);
  const purposes = new Set(criteria.purposes || []);
  return state.items.filter((item) => {
    if (regions.size && !regions.has(item.region)) return false;
    if (provinces.size && !provinces.has(item.province)) return false;
    if (purposes.size && !item.blessings.some((purpose) => purposes.has(purpose))) return false;
    return matchesSearch(item, query);
  });
}

function createPickerContext(type = "browse", overrides = {}) {
  return {
    type,
    mode: type === "browse" ? "browse" : "recommended",
    useCriteria: true,
    criteria: null,
    query: "",
    replaceIndex: null,
    removedItemId: "",
    previousId: "",
    nextId: "",
    ...overrides,
  };
}


function enforcePlannerDateTimeBounds(elements, options = {}) {
  if (!elements.startDate || !elements.startTime) return;
  const now = getThailandNow();
  const snap = options.snap !== false;

  elements.startDate.min = now.date;
  if (!elements.startDate.value || elements.startDate.value < now.date) {
    if (snap) elements.startDate.value = now.date;
  }

  if (!elements.startTime.value) elements.startTime.value = "09:00";
  const shouldEnforceTimeMinimum = !elements.startDate.closest("[hidden]") && elements.startDate.value === now.date;
  if (shouldEnforceTimeMinimum) {
    elements.startTime.min = now.time;
    if (snap && parseTime(elements.startTime.value) < parseTime(now.time)) {
      elements.startTime.value = now.time;
    }
  } else {
    elements.startTime.removeAttribute("min");
  }
}

function createEmptyCriteria(elements) {
  return {
    count: getTargetCount(elements),
    budget: elements.budget?.value || "300",
    startDate: elements.startDate?.value || getThailandNow().date,
    startTime: elements.startTime?.value || "09:00",
    radius: elements.radius?.value ?? "100",
    query: "",
    start: "",
    regions: [],
    provinces: [],
    purposes: [],
    nearbyMode: false,
    currentLocation: null,
  };
}

function getDraftCriteria(state, elements) {
  enforcePlannerDateTimeBounds(elements, { snap: true });
  return {
    count: getTargetCount(elements),
    budget: elements.budget?.value || "300",
    startDate: elements.startDate?.value || getThailandNow().date,
    startTime: elements.startTime?.value || "09:00",
    radius: elements.radius?.value ?? "100",
    query: elements.search?.value || "",
    start: elements.start?.value || "",
    regions: [...state.activeRegions].sort(),
    provinces: [...state.activeProvinces].sort(),
    purposes: [...state.activePurposes].sort(),
    nearbyMode: Boolean(state.nearbyMode && state.currentLocation),
    currentLocation: state.currentLocation
      ? {
          id: "current-location",
          name: "ตำแหน่งปัจจุบัน",
          latitude: state.currentLocation.latitude,
          longitude: state.currentLocation.longitude,
        }
      : null,
  };
}

function criteriaKey(criteria) {
  if (!criteria) return "";
  return JSON.stringify({
    count: Number(criteria.count || 9),
    budget: String(criteria.budget || "300"),
    startDate: String(criteria.startDate || getThailandNow().date),
    startTime: String(criteria.startTime || "09:00"),
    radius: String(criteria.radius ?? "100"),
    query: normalize(criteria.query),
    start: criteria.start || "",
    regions: [...(criteria.regions || [])].sort(),
    provinces: [...(criteria.provinces || [])].sort(),
    purposes: [...(criteria.purposes || [])].sort(),
    nearbyMode: Boolean(criteria.nearbyMode),
    currentLocation: criteria.currentLocation
      ? [
          Number(criteria.currentLocation.latitude).toFixed(4),
          Number(criteria.currentLocation.longitude).toFixed(4),
        ]
      : null,
  });
}

function hasVisiblePlan(state, elements) {
  return Boolean(state.plan.length || (elements.result && !elements.result.hidden));
}

function applyCriteriaToControls(state, elements, criteria) {
  const countInput = elements.countInputs.find((input) => Number(input.value) === Number(criteria.count));
  if (countInput) countInput.checked = true;
  if (elements.budget) elements.budget.value = criteria.budget || "300";
  if (elements.startDate) elements.startDate.value = criteria.startDate || getThailandNow().date;
  if (elements.startTime) elements.startTime.value = criteria.startTime || "09:00";
  enforcePlannerDateTimeBounds(elements, { snap: true });
  if (elements.radius) elements.radius.value = criteria.radius ?? "100";
  if (elements.search) elements.search.value = criteria.query || "";
  if (elements.start) elements.start.value = criteria.start && state.itemById.has(criteria.start) ? criteria.start : "";
  state.activeRegions = new Set(criteria.regions || []);
  state.activeProvinces = new Set(criteria.provinces || []);
  state.activePurposes = new Set(criteria.purposes || []);
  state.currentLocation = criteria.currentLocation ? { ...criteria.currentLocation } : null;
  state.nearbyMode = Boolean(criteria.nearbyMode && state.currentLocation);
  state.pinnedStartId = elements.start?.value || "";
  syncAreaControlFromState(state, elements);
  syncOriginTextFromPinnedStart(state, elements);
}

function updateCriteriaNotice(state, elements) {
  if (!elements.criteriaNotice) return;
  const show = Boolean(state.tripCriteria && !elements.result.hidden && criteriaKey(state.tripCriteria) !== criteriaKey(getDraftCriteria(state, elements)));
  elements.criteriaNotice.hidden = !show;
}

function updateTripSource(state, elements) {
  if (!elements.tripSource) return;
  if (!state.tripCriteria || !state.plan.length) {
    elements.tripSource.hidden = true;
    elements.tripSource.innerHTML = "";
    return;
  }
  const sourceLabel = state.tripCriteria.source === "manual" ? "แผนนี้มาจากการเลือกด้วยตนเอง" : "แผนนี้จัดจากเงื่อนไขด้านบน";
  const chips = describeCriteria(state, elements, state.tripCriteria);
  elements.tripSource.hidden = false;
  elements.tripSource.innerHTML = `
    <strong>${escapeHtml(sourceLabel)}</strong>
    <div class="planner-trip-source__chips">
      ${(chips.length ? chips : ["ไม่ได้จำกัดภาค จังหวัด หรือวัตถุประสงค์"]).map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
    </div>`;
}

function describeCriteria(state, elements, criteria) {
  const chips = [];
  chips.push(`${Number(criteria.count || getTargetCount(elements)).toLocaleString("th-TH")} แห่ง`);
  chips.push(`วันที่ ${formatCriteriaDate(criteria.startDate || getThailandNow().date)}`);
  if (criteria.start) {
    const startItem = state.itemById.get(criteria.start);
    if (startItem) chips.push(`เริ่มที่ ${startItem.name}`);
  } else if (criteria.currentLocation) {
    chips.push("เริ่มจากตำแหน่งปัจจุบัน");
  } else {
    chips.push("ระบบเลือกวัดแรก");
  }
  if (criteria.nearbyMode) {
    const radiusKm = getCriteriaRadiusKm(criteria);
    chips.push(Number.isFinite(radiusKm) ? `ในรัศมี ${radiusKm.toLocaleString("th-TH")} กม.` : "ไม่จำกัดรัศมี");
    if (normalize(criteria.query)) chips.push(`คำค้น "${criteria.query}"`);
    return chips;
  }
  if (criteria.regions?.length) chips.push(`ภาค ${criteria.regions.join(", ")}`);
  if (criteria.provinces?.length) chips.push(`จังหวัด ${criteria.provinces.join(", ")}`);
  if (criteria.purposes?.length) chips.push(`วัตถุประสงค์ ${criteria.purposes.slice(0, 3).join(", ")}${criteria.purposes.length > 3 ? "..." : ""}`);
  if (normalize(criteria.query)) chips.push(`คำค้น "${criteria.query}"`);
  return chips;
}

function formatCriteriaDate(value) {
  if (!value) return "วันนี้";
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function renderPickerContext(state, elements, resultCount) {
  const context = state.pickerContext || createPickerContext("browse");
  elements.pickerModeButtons.forEach((button) => {
    const active = button.dataset.plannerPickerMode === context.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (elements.pickerSearch && elements.pickerSearch.value !== (context.query || "")) {
    elements.pickerSearch.value = context.query || "";
  }
  if (elements.pickerToggleScope) {
    elements.pickerToggleScope.textContent = context.useCriteria === false ? "กลับมาใช้เงื่อนไขแผน" : "แสดงทั้งหมด";
  }

  const chips = context.useCriteria === false
    ? ["แสดงทุกสถานที่", "ค้นหาแยกจากเงื่อนไขแผน"]
    : describeCriteria(state, elements, context.criteria || state.tripCriteria || getDraftCriteria(state, elements));
  if (elements.pickerChips) {
    elements.pickerChips.innerHTML = chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("");
  }
  const scopeSuffix = context.useCriteria === false
    ? " จากทุกสถานที่ กดกลับมาใช้เงื่อนไขแผนเพื่อดูรายการแนะนำชุดเดิม"
    : "";

  if (context.type === "replace") {
    const ordinal = Number(context.replaceIndex) + 1;
    elements.pickerKicker.textContent = "เปลี่ยนสถานที่ในแผน";
    elements.pickerTitle.textContent = `เลือกสถานที่แทนจุดที่ ${ordinal.toLocaleString("th-TH")}`;
    elements.pickerDescription.textContent = "แนะนำจากตำแหน่งก่อนหน้า/ถัดไป วัตถุประสงค์เดิม และอันดับในฐานข้อมูล";
    elements.pickerNote.textContent = scopeSuffix
      ? `พบ ${resultCount.toLocaleString("th-TH")} สถานที่${scopeSuffix}`
      : `พบ ${resultCount.toLocaleString("th-TH")} สถานที่ เลือกเพิ่มแล้วกดจัดลำดับสถานที่ที่เลือก`;
    return;
  }

  if (context.type === "trip") {
    elements.pickerKicker.textContent = "ปรับแผนที่จัดไว้";
    elements.pickerTitle.textContent = "เลือกเพิ่มหรือเปลี่ยนจากรายการแนะนำ";
    elements.pickerDescription.textContent = "รายการจะแนะนำสถานที่ที่เข้ากับเงื่อนไขเดิมและอยู่ใกล้ลำดับแผนปัจจุบันก่อน";
    elements.pickerNote.textContent = scopeSuffix
      ? `พบ ${resultCount.toLocaleString("th-TH")} สถานที่${scopeSuffix}`
      : `พบ ${resultCount.toLocaleString("th-TH")} สถานที่ หากต้องการดูนอกเงื่อนไขเดิมให้กดแสดงทั้งหมด`;
    return;
  }

  if (context.type === "nearby") {
    elements.pickerKicker.textContent = "ใกล้ตำแหน่งปัจจุบัน";
    elements.pickerTitle.textContent = "เลือกสถานที่ในรัศมีจากตำแหน่งปัจจุบัน";
    elements.pickerDescription.textContent = "โหมดนี้ไม่ใช้ภาค จังหวัด และวัตถุประสงค์จากเงื่อนไขด้านบน";
    elements.pickerNote.textContent = `พบ ${resultCount.toLocaleString("th-TH")} สถานที่ เรียงจากใกล้ไปไกล`;
    return;
  }

  elements.pickerKicker.textContent = "ค้นหาด้วยตนเอง";
  elements.pickerTitle.textContent = "เลือกจากรายการหรือแผนที่";
  elements.pickerDescription.textContent = "รายการนี้ใช้เงื่อนไขด้านบนเพื่อช่วยคัดสถานที่ แต่ยังไม่เปลี่ยนแผนจนกว่าจะกดจัดลำดับ";
  elements.pickerNote.textContent = `พบ ${resultCount.toLocaleString("th-TH")} สถานที่ตามเงื่อนไขด้านบน`;
}

function sortTripEditCandidates(state, items) {
  const selectedIds = new Set(state.selected);
  const routeItems = state.plan.length ? state.plan : state.selected.map((id) => state.itemById.get(id)).filter(Boolean);
  const purposes = getTripPurposes(state);
  return [...items].sort((left, right) => {
    const selectedDifference = Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id));
    return selectedDifference || tripCandidateScore(state, left, routeItems, purposes) - tripCandidateScore(state, right, routeItems, purposes);
  });
}

function tripCandidateScore(state, item, routeItems, purposes) {
  const routeDistance = routeItems.length
    ? Math.min(...routeItems.map((routeItem) => haversineKm(routeItem, item)).filter(Number.isFinite))
    : item.globalRank;
  const purposeBonus = item.blessings.some((purpose) => purposes.has(purpose)) ? -35 : 0;
  const selectedBonus = state.selected.includes(item.id) ? -500 : 0;
  return selectedBonus + routeDistance * 4 + Math.min(item.globalRank, 200) * 0.25 + purposeBonus;
}

function sortReplacementCandidates(state, context, items) {
  const selectedIds = new Set(state.selected);
  const previous = state.itemById.get(context.previousId);
  const next = state.itemById.get(context.nextId);
  const purposes = getTripPurposes(state);
  return [...items]
    .filter((item) => !selectedIds.has(item.id))
    .sort((left, right) => replacementCandidateScore(left, previous, next, purposes) - replacementCandidateScore(right, previous, next, purposes));
}

function replacementCandidateScore(item, previous, next, purposes) {
  const previousLeg = previous ? estimateLeg(previous, item).midpointMinutes : 0;
  const nextLeg = next ? estimateLeg(item, next).midpointMinutes : 0;
  const purposeBonus = item.blessings.some((purpose) => purposes.has(purpose)) ? -35 : 0;
  return previousLeg + nextLeg + Math.min(item.globalRank, 200) * 0.25 + purposeBonus;
}

function getTripPurposes(state) {
  const source = state.tripCriteria?.purposes?.length ? state.tripCriteria.purposes : [...state.activePurposes];
  return new Set(source);
}

function getPickerRecommendationText(state, elements, item) {
  const context = state.pickerContext || createPickerContext("browse");
  if (context.mode === "browse") return "";
  if (state.selected.includes(item.id)) return "อยู่ในแผนนี้แล้ว";
  if (context.type === "replace") {
    const previous = state.itemById.get(context.previousId);
    const next = state.itemById.get(context.nextId);
    const minutes = (previous ? estimateLeg(previous, item).midpointMinutes : 0) + (next ? estimateLeg(item, next).midpointMinutes : 0);
    return `เหมาะเป็นจุดแทน · ระยะต่อเนื่องประมาณ ${formatMinutes(minutes)}`;
  }
  if (context.type === "trip" && state.plan.length) {
    const nearest = Math.min(...state.plan.map((planItem) => haversineKm(planItem, item)).filter(Number.isFinite));
    if (Number.isFinite(nearest)) return `ใกล้เส้นทางเดิมประมาณ ${formatDistance(nearest)}`;
  }
  return "";
}

function matchesSearch(item, query) {
  if (!query) return true;
  return normalize(
    `${item.name} ${item.region} ${item.province} ${item.district} ${item.blessings.join(" ")} ${item.objectHero.join(" ")}`,
  ).includes(query);
}

function synchronizeFilterOptions(state, elements) {
  const matchesPurposes = (item) =>
    !state.activePurposes.size || item.blessings.some((purpose) => state.activePurposes.has(purpose));
  const availableRegions = new Set(
    state.items
      .filter((item) => (!state.activeProvinces.size || state.activeProvinces.has(item.province)) && matchesPurposes(item))
      .map((item) => item.region),
  );
  const availableProvinces = new Set(
    state.items
      .filter((item) => (!state.activeRegions.size || state.activeRegions.has(item.region)) && matchesPurposes(item))
      .map((item) => item.province),
  );
  const availablePurposes = new Set(
    state.items
      .filter(
        (item) =>
          (!state.activeRegions.size || state.activeRegions.has(item.region)) &&
          (!state.activeProvinces.size || state.activeProvinces.has(item.province)),
      )
      .flatMap((item) => item.blessings),
  );

  updatePlannerTagStates(elements.regionTags, state.activeRegions, availableRegions);
  updatePlannerTagStates(elements.purposeTags, state.activePurposes, availablePurposes);
  renderPlannerProvinceTags(state, elements, availableProvinces);
  updateFilterSummary(elements.provinceSummary, state.activeProvinces.size);
  updateFilterSummary(elements.purposeSummary, state.activePurposes.size);
}

function uniqueThai(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "th"));
}

function updatePlannerTagStates(tags, activeValues, availableValues) {
  tags.forEach((tag) => {
    const value = tag.value || "";
    const isActive = value ? activeValues.has(value) : activeValues.size === 0;
    tag.classList.toggle("is-active", isActive);
    tag.setAttribute("aria-pressed", String(isActive));
    tag.hidden = Boolean(value) && !isActive && !availableValues.has(value);
  });
}

function renderPlannerProvinceTags(state, elements, availableProvinces) {
  if (!elements.provinceTags) return;
  const provinces = uniqueThai([...availableProvinces, ...state.activeProvinces]);
  elements.provinceTags.innerHTML = [
    `<button type="button" data-planner-province-tag value="" class="${state.activeProvinces.size ? "" : "is-active"}" aria-pressed="${String(!state.activeProvinces.size)}">ทั้งหมด</button>`,
    ...provinces.map((province) => {
      const isActive = state.activeProvinces.has(province);
      return `<button type="button" data-planner-province-tag value="${escapeHtml(province)}" class="${isActive ? "is-active" : ""}" aria-pressed="${String(isActive)}">${escapeHtml(province)}</button>`;
    }),
  ].join("");
}

function updateFilterSummary(node, selectedCount) {
  if (!node) return;
  node.textContent = selectedCount ? `เลือกแล้ว ${selectedCount.toLocaleString("th-TH")}` : "ทั้งหมด";
}

function resetSearchFilters(state, elements) {
  const hasPlan = hasVisiblePlan(state, elements);
  if (elements.area) {
    elements.area.value = elements.area.dataset.plannerAreaDefault || "province:กรุงเทพมหานคร";
    applyAreaFilterFromControl(state, elements);
  } else {
    state.activeRegions.clear();
    state.activeProvinces.clear();
  }
  state.activePurposes.clear();
  if (elements.defaultPurpose) state.activePurposes.add(elements.defaultPurpose);
  elements.search.value = "";
  elements.radius.value = "100";
  elements.start.value = "";
  if (elements.originText) elements.originText.value = "";
  state.currentLocation = null;
  state.nearbyMode = false;
  resetPlannerVisibleCount(state);
  if (!hasPlan) applyPinnedStart(state, elements);
  const planSynced = hasPlan ? false : synchronizePlanWithSelection(state, elements);
  synchronizeFilterOptions(state, elements);
  updateStartWarning(state, elements);
  updateCriteriaNotice(state, elements);
  renderSelected(state, elements);
  if (planSynced) renderPlan(state, elements, { scroll: false });
  if (state.pickerReady) {
    renderPicker(state, elements);
    refreshSelectionMap(state, elements);
  }
  elements.locationStatus.textContent = "รีเซ็ตเงื่อนไขการค้นหาแล้ว";
  persistState(state, elements);
}

function openPlannerDialog(state, elements, options) {
  if (!elements.dialog) return;
  state.dialogAction = options.action || null;
  state.dialogTrigger = options.trigger || document.activeElement;
  elements.dialogKicker.textContent = options.kicker || "แจ้งผลการค้นหา";
  elements.dialogTitle.textContent = options.title || "ตรวจสอบเงื่อนไขอีกครั้ง";
  elements.dialogMessage.textContent = options.message || "";
  elements.dialogConfirm.textContent = options.confirmText || "ตกลง";
  elements.dialogCancel.hidden = Boolean(options.hideCancel);
  elements.dialog.hidden = false;
  elements.dialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-planner-dialog");
  elements.dialogConfirm.focus({ preventScroll: true });
}

function confirmAutomaticPlan(state, elements, trigger) {
  const hasExistingTrip = state.selected.length || state.plan.length || !elements.result.hidden;
  if (!state.hasPlannerAction || !hasExistingTrip) {
    state.hasPlannerAction = true;
    buildAutomaticPlan(state, elements);
    return;
  }
  openPlannerDialog(state, elements, {
    kicker: "ตรวจสอบก่อนจัดแผน",
    title: "จัดแผนใหม่อัตโนมัติ?",
    message: "ระบบจะล้างสถานที่ที่เลือกไว้และแผนปัจจุบันทั้งหมด แล้วเลือกใหม่ตามเงื่อนไขด้านบน",
    confirmText: "ล้างและจัดแผนใหม่",
    trigger,
    action: () => buildAutomaticPlan(state, elements),
  });
}

function closePlannerDialog(state, elements, options = {}) {
  if (!elements.dialog || elements.dialog.hidden) return;
  elements.dialog.hidden = true;
  elements.dialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-planner-dialog");
  const trigger = state.dialogTrigger;
  state.dialogAction = null;
  state.dialogTrigger = null;
  if (options.restoreFocus !== false) trigger?.focus?.({ preventScroll: true });
}

function showNoResultsDialog(state, elements, message) {
  openPlannerDialog(state, elements, {
    kicker: "ไม่พบผลลัพธ์",
    title: "ไม่พบสถานที่ตามเงื่อนไข",
    message: `${message} ลองเปลี่ยนตัวกรองหรือกดรีเซ็ตเงื่อนไขแล้วค้นหาใหม่`,
    confirmText: "กลับไปค้นหาใหม่",
    hideCancel: true,
    trigger: document.activeElement,
    action: () => {
      elements.setup?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      elements.resetFilters?.focus({ preventScroll: true });
    },
  });
}

function clearTrip(state, elements) {
  state.planRequests.cancel();
  setPlannerPlanBusy(elements, false);
  state.selected = [];
  state.plan = [];
  state.planDetails = null;
  state.tripCriteria = null;
  state.lastSuccessfulPayload = null;
  state.manualSelectionOrder = false;
  state.pickerContext = createPickerContext("browse", { criteria: getDraftCriteria(state, elements), mode: "browse" });
  elements.result.hidden = true;
  elements.timeline.innerHTML = "";
  elements.summary.innerHTML = "";
  elements.warnings.hidden = true;
  elements.warnings.innerHTML = "";
  renderSelected(state, elements);
  renderPicker(state, elements);
  refreshSelectionMap(state, elements);
  updateTripSource(state, elements);
  updateCriteriaNotice(state, elements);
  elements.locationStatus.textContent = "ล้างแผนนี้แล้ว เงื่อนไขด้านบนยังใช้สำหรับจัดใหม่ได้";
  persistState(state, elements);
}

function updateStartWarning(state, elements) {
  if (!elements.startWarning) return;
  const pinnedStart = getPinnedStartItem(state, elements);
  if (pinnedStart) {
    elements.startWarning.hidden = false;
    elements.startWarning.textContent = `${pinnedStart.name} จะถูกนับเป็นสถานที่แรกของแผน และระบบจะจัดสถานที่ถัดไปต่อจากจุดนี้`;
    return;
  }

  const anchor = getStartPoint(state, elements);
  const hasAreaFilter = Boolean(state.activeRegions.size || state.activeProvinces.size);
  const candidates = getFilteredItems(state, { ...elements, search: { value: "" } });

  if (!anchor || !hasAreaFilter || !candidates.length) {
    elements.startWarning.hidden = true;
    elements.startWarning.textContent = "";
    return;
  }

  const nearestDistance = candidates
    .map((item) => haversineKm(anchor, item))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0];
  const provinceMismatch = state.activeProvinces.size && anchor.province && !state.activeProvinces.has(anchor.province);
  const regionMismatch = state.activeRegions.size && anchor.region && !state.activeRegions.has(anchor.region);
  const isFar = nearestDistance > 120;

  if (!provinceMismatch && !regionMismatch && !isFar) {
    elements.startWarning.hidden = true;
    elements.startWarning.textContent = "";
    return;
  }

  elements.startWarning.hidden = false;
  elements.startWarning.textContent = `จุดเริ่มต้นอยู่ห่างจากพื้นที่ที่เลือกประมาณ ${formatDistance(nearestDistance)} ระบบจะคำนวณเป็นการเดินทางไปจุดแรก ไม่นับเป็นสถานที่ในแผน`;
}

function updateTargetCount(state, elements) {
  elements.targetCount.textContent = getTargetCount(elements).toLocaleString("th-TH");
}

function showFilteredPlaces(state, elements) {
  state.hasPlannerAction = true;
  state.pickerReady = true;
  state.nearbyMode = false;
  state.pickerContext = createPickerContext("browse", {
    criteria: getDraftCriteria(state, elements),
    mode: "browse",
    useCriteria: true,
    query: "",
  });
  if (elements.pickerSearch) elements.pickerSearch.value = "";
  elements.pickSection.hidden = false;
  elements.result.hidden = true;
  resetPlannerVisibleCount(state);
  renderPicker(state, elements);
  refreshSelectionMap(state, elements);
  const count = getFilteredItems(state, elements).length;
  elements.locationStatus.textContent = count
    ? `พบ ${count.toLocaleString("th-TH")} สถานที่ตามตัวกรอง เลือกจากรายการหรือแผนที่ได้เลย`
    : "ไม่พบสถานที่ที่ตรงกับตัวกรอง";
  if (!count) {
    showNoResultsDialog(state, elements, "ไม่พบวัดหรือสถานที่ศักดิ์สิทธิ์ที่ตรงกับภาค จังหวัด และวัตถุประสงค์ที่เลือก");
    persistState(state, elements);
    return;
  }
  elements.pickSection?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  persistState(state, elements);
}

function showNearbyPlaces(state, elements) {
  state.hasPlannerAction = true;
  state.pickerReady = true;
  state.nearbyMode = true;
  state.pickerContext = createPickerContext("nearby", {
    criteria: getDraftCriteria(state, elements),
    mode: "recommended",
    useCriteria: true,
    query: "",
  });
  if (elements.pickerSearch) elements.pickerSearch.value = "";
  elements.pickSection.hidden = false;
  elements.result.hidden = true;
  resetPlannerVisibleCount(state);
  renderPicker(state, elements);
  refreshSelectionMap(state, elements);
  const radiusKm = getRadiusKm(elements);
  const nearbyScope = formatNearbyScope(radiusKm);
  const count = getFilteredItems(state, elements).length;
  elements.locationStatus.textContent = count
    ? `พบ ${count.toLocaleString("th-TH")} สถานที่${nearbyScope}`
    : `ไม่พบสถานที่${nearbyScope}`;
  if (!count) {
    showNoResultsDialog(state, elements, `ไม่พบวัดหรือสถานที่ศักดิ์สิทธิ์${nearbyScope}`);
    persistState(state, elements);
    return;
  }
  elements.pickSection?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  persistState(state, elements);
}

function getRadiusKm(elements) {
  return getCriteriaRadiusKm({ radius: elements.radius?.value ?? "100" });
}

function getCriteriaRadiusKm(criteria) {
  const radius = criteria?.radius ?? "100";
  if (radius === "") return Number.POSITIVE_INFINITY;
  const radiusKm = Number(radius);
  return Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 100;
}

function formatNearbyScope(radiusKm) {
  return Number.isFinite(radiusKm)
    ? `ในรัศมี ${radiusKm.toLocaleString("th-TH")} กม. จากตำแหน่งปัจจุบัน`
    : "จากตำแหน่งปัจจุบันแบบไม่จำกัดรัศมี";
}

function getTargetCount(elements) {
  return Number(elements.countInputs.find((input) => input.checked)?.value || 9);
}

async function buildAutomaticPlan(state, elements) {
  const criteria = getDraftCriteria(state, elements);
  state.manualSelectionOrder = false;
  state.pickerReady = false;
  state.planDetails = null;
  elements.pickSection.hidden = true;
  state.selected = [];
  state.plan = [];
  elements.result.hidden = true;
  renderSelected(state, elements);
  await runPlannerPlanRequest(state, elements, {
    mode: "auto",
    criteria,
    emptyMessage: "ไม่พบวัดหรือสถานที่ศักดิ์สิทธิ์ที่ตรงกับภาค จังหวัด และวัตถุประสงค์ที่เลือก",
  });
}

function showManualEditMode(state, elements, options = {}) {
  state.pickerReady = true;
  state.pickerContext = createPickerContext(options.type || "trip", {
    criteria: state.tripCriteria || getDraftCriteria(state, elements),
    mode: options.mode || "recommended",
    useCriteria: true,
    replaceIndex: options.replaceIndex,
    removedItemId: options.removedItemId,
    previousId: options.previousId,
    nextId: options.nextId,
    query: "",
  });
  if (elements.pickerSearch) elements.pickerSearch.value = "";
  elements.pickSection.hidden = false;
  elements.result.hidden = true;
  state.visibleCount = Math.max(state.visibleCount, PLANNER_PICKER_BATCH_SIZE);
  renderSelected(state, elements);
  renderPicker(state, elements);
  refreshSelectionMap(state, elements);
  if (options.status) elements.locationStatus.textContent = options.status;
  elements.pickSection?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  persistState(state, elements);
}

async function buildSelectedPlan(state, elements) {
  const criteria = state.pickerContext?.criteria || getDraftCriteria(state, elements);
  enforcePinnedStartByCriteria(state, elements, criteria);
  if (!state.selected.length) {
    await buildAutomaticPlan(state, elements);
    return;
  }
  await runPlannerPlanRequest(state, elements, {
    mode: "manual",
    criteria,
    selectedIds: state.selected,
    manualSelectionOrder: state.manualSelectionOrder,
    emptyMessage: "ไม่สามารถจัดลำดับจากสถานที่ที่เลือกได้",
  });
}

async function refreshPlanFromServer(state, elements, options = {}) {
  if (!state.plan.length && !state.selected.length) return;
  const criteria = state.tripCriteria || getDraftCriteria(state, elements);
  await runPlannerPlanRequest(state, elements, {
    mode: "manual",
    criteria,
    selectedIds: state.plan.length ? state.plan.map((item) => item.id) : state.selected,
    manualSelectionOrder: options.manualSelectionOrder !== false,
    emptyMessage: "ไม่สามารถคำนวณรายละเอียดแผนนี้ได้",
    scroll: options.scroll,
    quiet: options.quiet,
  });
}

async function runPlannerPlanRequest(state, elements, options) {
  const request = state.planRequests.start();
  setPlannerPlanBusy(elements, true);
  if (!options.quiet && elements.locationStatus) {
    elements.locationStatus.textContent = options.mode === "manual" ? "กำลังจัดลำดับและคำนวณแผน..." : "กำลังจัดแผนจากเงื่อนไขที่เลือก...";
  }

  try {
    const payload = await requestPlannerPlan({
      mode: options.mode,
      criteria: options.criteria,
      selectedIds: options.selectedIds || [],
      manualSelectionOrder: Boolean(options.manualSelectionOrder),
      revision: state.revision,
    }, { signal: request.signal });
    if (!request.isCurrent()) return;
    applyPlannerPlanResult(state, elements, payload, { scroll: options.scroll, quiet: options.quiet });
  } catch (error) {
    if (!request.isCurrent()) return;
    if (error.payload?.code === "CATALOG_CHANGED") {
      reconcileCatalog(state, error.payload.catalog);
      populatePlannerStartSuggestions(state, elements);
      renderSelected(state, elements);
      renderPicker(state, elements);
      elements.result.hidden = true;
    } else if (state.lastSuccessfulPayload) {
      const draftSelection = [...state.selected];
      applyPlannerPlanResult(state, elements, state.lastSuccessfulPayload, { scroll: false, quiet: true });
      state.selected = draftSelection;
      renderSelected(state, elements);
    }
    console.warn("คำนวณแผนไหว้พระไม่สำเร็จ", error);
    if (elements.locationStatus) elements.locationStatus.textContent = "คำนวณแผนไม่สำเร็จ กรุณาลองใหม่";
    showNoResultsDialog(state, elements, error.message || options.emptyMessage || "ไม่สามารถคำนวณแผนนี้ได้");
    persistState(state, elements);
  } finally {
    if (request.isCurrent()) setPlannerPlanBusy(elements, false);
  }
}

function applyPlannerPlanResult(state, elements, payload, options = {}) {
  for (const item of payload.items || []) state.itemById.set(item.id, item);
  state.revision = payload.revision || state.revision;
  const plan = (payload.planIds || []).map((id) => state.itemById.get(id)).filter(Boolean);
  if (!plan.length) throw new Error("ไม่พบสถานที่ในแผนที่คำนวณได้");

  state.plan = plan;
  state.selected = plan.map((item) => item.id);
  state.tripCriteria = payload.criteria || { ...getDraftCriteria(state, elements), source: payload.mode || "manual" };
  state.manualSelectionOrder = payload.mode === "manual";
  state.planDetails = payload.details || null;
  state.lastSuccessfulPayload = payload;
  state.pickerReady = true;

  renderSelected(state, elements);
  renderPlan(state, elements, options);
  if (!options.quiet && elements.locationStatus) {
    const count = state.plan.length.toLocaleString("th-TH");
    elements.locationStatus.textContent =
      payload.mode === "manual" ? `จัดลำดับ ${count} สถานที่แล้ว` : `จัดแผน ${count} สถานที่จากเงื่อนไขแล้ว`;
  }
}

function setPlannerPlanBusy(elements, isBusy) {
  elements.result?.setAttribute("aria-busy", String(isBusy));
  [elements.autoButton, elements.buildButton, elements.criteriaRebuild].forEach((button) => {
    if (!button) return;
    button.disabled = isBusy;
    button.setAttribute("aria-busy", String(isBusy));
  });
}

function enforcePinnedStartByCriteria(state, elements, criteria) {
  const pinnedStart = criteria.start ? state.itemById.get(criteria.start) : null;
  if (!pinnedStart) return;
  state.selected = [pinnedStart.id, ...state.selected.filter((id) => id !== pinnedStart.id)].slice(0, getTargetCount(elements));
}

function renderPlan(state, elements, options = {}) {
  if (!state.plan.length) return;
  const details = hydratePlanDetails(state);
  if (!details) {
    refreshPlanFromServer(state, elements, { scroll: options.scroll, manualSelectionOrder: true, quiet: true });
    return;
  }
  elements.result.hidden = false;
  updateTripSource(state, elements);
  updateCriteriaNotice(state, elements);
  elements.summary.innerHTML = renderSummary(details);
  renderWarnings(details, elements);
  elements.timeline.innerHTML = state.plan
    .map((item, index) => renderTimelineItem(item, index, details, state.plan.length))
    .join("");
  elements.googleLink.href = buildGoogleMapsUrl(state, elements);
  persistState(state, elements);
  if (state.routeMap) renderRouteMap(state, elements);
  if (options.scroll !== false) {
    elements.result.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }
}

function hydratePlanDetails(state) {
  const details = state.planDetails;
  if (!details || !Array.isArray(details.stops)) return null;
  const planIds = state.plan.map((item) => item.id);
  const detailIds = details.stops.map((stop) => stop.itemId);
  if (planIds.join("|") !== detailIds.join("|")) return null;
  const stops = details.stops
    .map((stop) => ({ ...stop, item: state.itemById.get(stop.itemId) }))
    .filter((stop) => stop.item);
  if (stops.length !== state.plan.length) return null;
  return { ...details, stops };
}


function handleTimelineAction(event, state, elements) {
  const stop = event.target.closest("[data-planner-stop]");
  if (!stop) return;
  const index = state.plan.findIndex((item) => item.id === stop.dataset.plannerStop);
  if (index === -1) return;
  const moveButton = event.target.closest("[data-planner-move]");
  if (moveButton) {
    const nextIndex = moveButton.dataset.plannerMove === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= state.plan.length) return;
    [state.plan[index], state.plan[nextIndex]] = [state.plan[nextIndex], state.plan[index]];
    state.selected = state.plan.map((item) => item.id);
    state.planDetails = null;
    renderSelected(state, elements);
    renderPlan(state, elements, { scroll: false });
    return;
  }
  if (event.target.closest("[data-planner-replace]")) {
    const [removed] = state.plan.splice(index, 1);
    state.selected = state.plan.map((item) => item.id);
    state.planDetails = null;
    if (removed.id === elements.start?.value) {
      elements.start.value = "";
      state.pinnedStartId = "";
    }
    if (state.tripCriteria?.start === removed.id) {
      state.tripCriteria = { ...state.tripCriteria, start: "" };
    }
    showManualEditMode(state, elements, {
      type: "replace",
      replaceIndex: index,
      removedItemId: removed.id,
      previousId: state.plan[index - 1]?.id || "",
      nextId: state.plan[index]?.id || "",
      status: `นำ ${removed.name} ออกจากแผนแล้ว เลือกสถานที่ใหม่แทนจุดนี้ได้`,
    });
  }
}

function clampIndex(value, max) {
  if (!Number.isFinite(value)) return max;
  return Math.min(Math.max(0, value), max);
}

function bindTimelineDrag(state, elements) {
  let draggedId = "";
  elements.timeline?.addEventListener("dragstart", (event) => {
    const item = event.target.closest("[data-planner-stop]");
    if (!item) return;
    draggedId = item.dataset.plannerStop;
    item.classList.add("is-dragging");
  });
  elements.timeline?.addEventListener("dragend", (event) => {
    event.target.closest("[data-planner-stop]")?.classList.remove("is-dragging");
    draggedId = "";
  });
  elements.timeline?.addEventListener("dragover", (event) => {
    if (draggedId) event.preventDefault();
  });
  elements.timeline?.addEventListener("drop", (event) => {
    event.preventDefault();
    const target = event.target.closest("[data-planner-stop]");
    if (!target || !draggedId || target.dataset.plannerStop === draggedId) return;
    const from = state.plan.findIndex((item) => item.id === draggedId);
    const to = state.plan.findIndex((item) => item.id === target.dataset.plannerStop);
    const [moved] = state.plan.splice(from, 1);
    state.plan.splice(to, 0, moved);
    state.selected = state.plan.map((item) => item.id);
    state.planDetails = null;
    renderSelected(state, elements);
    renderPlan(state, elements, { scroll: false });
  });
}

function estimateLeg(from, to) {
  const directKm = haversineKm(from, to);
  const sameProvince = from.province && to.province && from.province === to.province;
  const sameDistrict = sameProvince && from.district && to.district && from.district === to.district;
  const isBangkok = from.province === "กรุงเทพมหานคร" || to.province === "กรุงเทพมหานคร";
  const roadFactor = sameDistrict ? 1.32 : sameProvince ? 1.24 : 1.14;
  const roadKm = directKm * roadFactor;
  let speed = 62;
  if (isBangkok && directKm < 35) speed = 20;
  else if (directKm < 8) speed = 24;
  else if (sameProvince && directKm < 45) speed = 38;
  else if (directKm < 80) speed = 48;
  const accessMinutes = directKm < 20 ? 10 : directKm < 100 ? 15 : 25;
  const midpointMinutes = Math.max(10, Math.round(((roadKm / speed) * 60 + accessMinutes) / 5) * 5);
  const uncertainty = directKm < 10 ? 10 : directKm < 50 ? 20 : directKm < 150 ? 30 : 50;
  return {
    directKm,
    roadKm,
    midpointMinutes,
    lowMinutes: Math.max(10, midpointMinutes - Math.round(uncertainty * 0.45)),
    highMinutes: midpointMinutes + uncertainty,
    lowKm: roadKm * 0.9,
    highKm: roadKm * 1.12,
  };
}

function haversineKm(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const earthRadius = 6371;
  const latitudeDistance = toRadians(Number(right.latitude) - Number(left.latitude));
  const longitudeDistance = toRadians(Number(right.longitude) - Number(left.longitude));
  const leftLatitude = toRadians(Number(left.latitude));
  const rightLatitude = toRadians(Number(right.latitude));
  const value =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDistance / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function getStartPoint(state, elements) {
  if (state.currentLocation) return state.currentLocation;
  return getPinnedStartItem(state, elements);
}

function getPinnedStartItem(state, elements) {
  return state.itemById.get(elements.start?.value) || null;
}

function requestCurrentLocation(state, elements) {
  if (!navigator.geolocation) {
    elements.locationStatus.textContent = "เบราว์เซอร์นี้ไม่รองรับตำแหน่งปัจจุบัน";
    return;
  }
  elements.locationButton.disabled = true;
  elements.locationStatus.textContent = "กำลังขอตำแหน่งปัจจุบัน...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.currentLocation = {
        id: "current-location",
        name: "ตำแหน่งปัจจุบัน",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      elements.start.value = "";
      applyPinnedStart(state, elements);
      updateStartWarning(state, elements);
      showNearbyPlaces(state, elements);
      elements.locationButton.disabled = false;
    },
    () => {
      elements.locationStatus.textContent = "ไม่สามารถใช้ตำแหน่งปัจจุบันได้ ระบบจะเริ่มจากสถานที่แรกในแผน หรือเลือกวัดให้เป็นจุดเริ่มต้นได้";
      elements.locationButton.disabled = false;
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}


function buildGoogleMapsUrl(state, elements) {
  const plan = state.plan;
  if (!plan.length) return "#";
  const criteria = state.tripCriteria || getDraftCriteria(state, elements);
  const origin = criteria.currentLocation || plan[0];
  const destination = plan.at(-1);
  const waypointItems = criteria.currentLocation ? plan.slice(0, -1) : plan.slice(1, -1);
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
  if (waypointItems.length) {
    url.searchParams.set("waypoints", waypointItems.map((item) => `${item.latitude},${item.longitude}`).join("|"));
  }
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function buildSingleMapUrl(item) {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${item.latitude},${item.longitude}`);
  return url.toString();
}


function applyPlannerSearchParams(state, elements) {
  try {
    const params = new URLSearchParams(window.location.search);
    const startQuery = params.get("start") || params.get("temple") || "";
    const provinceQuery = params.get("province") || "";
    const searchQuery = params.get("name") || params.get("q") || "";
    if (!startQuery && !searchQuery) return;

    const matchedStart = startQuery ? findPlannerItemByQuery(state, startQuery, provinceQuery) : null;
    if (matchedStart && elements.start) {
      elements.start.value = matchedStart.id;
      if (elements.originText) elements.originText.value = matchedStart.name;
      state.selected = [matchedStart.id, ...state.selected.filter((id) => id !== matchedStart.id)].slice(0, getTargetCount(elements));
      state.plan = [];
      state.planDetails = null;
      state.tripCriteria = null;
    }

    if (elements.search) elements.search.value = searchQuery || startQuery;
    state.pickerContext = createPickerContext("browse", { mode: "recommended" });
  } catch {}
}

function findPlannerItemByQuery(state, name, province = "") {
  const normalizedName = normalizePlannerLookup(name);
  const normalizedProvince = normalizePlannerLookup(province);
  if (!normalizedName) return null;

  return state.items.find((item) => {
    const nameMatches = normalizePlannerLookup(item.name) === normalizedName;
    const provinceMatches = !normalizedProvince || normalizePlannerLookup(item.province) === normalizedProvince;
    return nameMatches && provinceMatches;
  }) || state.items.find((item) => normalizePlannerLookup(item.name) === normalizedName) || null;
}

function normalizePlannerLookup(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("th");
}


function initializeSmoothFilterAccordions(scope = document) {
  const accordions = scope?.querySelectorAll?.(".temple-province-accordion, .temple-purpose-accordion") || [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  accordions.forEach((details) => {
    if (details.dataset.smoothAccordion === "true") return;

    const summary = details.querySelector("summary");
    const content = summary?.nextElementSibling;
    if (!summary || !content) return;

    details.dataset.smoothAccordion = "true";

    if (reduceMotion || !details.animate) return;

    let animation = null;
    let closing = false;

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      details.style.overflow = "hidden";

      if (closing || !details.open) {
        openDetails();
      } else {
        closeDetails();
      }
    });

    function openDetails() {
      details.style.height = `${details.offsetHeight}px`;
      details.open = true;
      window.requestAnimationFrame(() => {
        const startHeight = details.style.height;
        const endHeight = `${summary.offsetHeight + content.offsetHeight}px`;
        runAnimation(startHeight, endHeight, true);
      });
    }

    function closeDetails() {
      closing = true;
      runAnimation(`${details.offsetHeight}px`, `${summary.offsetHeight}px`, false);
    }

    function runAnimation(startHeight, endHeight, shouldOpen) {
      animation?.cancel();
      animation = details.animate(
        { height: [startHeight, endHeight] },
        { duration: 240, easing: "cubic-bezier(0.2, 0, 0.2, 1)" },
      );
      animation.onfinish = () => finishAnimation(shouldOpen);
      animation.oncancel = () => {
        closing = false;
      };
    }

    function finishAnimation(shouldOpen) {
      details.open = shouldOpen;
      animation = null;
      closing = false;
      details.style.height = "";
      details.style.overflow = "";
    }
  });
}


document.addEventListener("planner:map-visible", () => {
  const planner = document.querySelector("[data-temple-planner]");
  const mapElement = planner?.querySelector("[data-planner-selection-map]");
  const context = mapElement?._plannerContext;
  if (context) {
    context.state.selectionMap?.invalidateSize();
    return;
  }
});

root?.querySelector('[data-planner-picker-tab="map"]')?.addEventListener("click", async () => {
  const mapElement = root.querySelector("[data-planner-selection-map]");
  const context = mapElement?._plannerContext;
  if (context) {
    setTimeout(() => context.state.selectionMap?.invalidateSize(), 40);
    return;
  }
  const plannerState = root._plannerState;
  if (!plannerState) return;
  try {
    await ensureSelectionMap(plannerState.state, plannerState.elements);
  } catch {
    plannerState.elements.locationStatus.textContent = "โหลดแผนที่ไม่สำเร็จ ยังเลือกสถานที่จากรายการได้ตามปกติ";
  }
});
