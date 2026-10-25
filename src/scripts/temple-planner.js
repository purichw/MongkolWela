import { applyImageFallback } from "../lib/image-placeholder.js";
import { createPlannerPicker } from "./planner/picker.js";
import { createPlannerResults } from "./planner/results.js";
import { createPlannerMaps } from "./planner/maps.js";
import { createPlannerStorage } from "./planner/storage.js";
import { getThailandNow, formatClock, formatMinutes, formatMinutesRange, formatDistance, formatDistanceRange, normalize, escapeHtml, prefersReducedMotion } from "./planner/format.js";
import { createLatestRequest } from "./request.js";
import { loadPlannerCatalog, requestPlannerPlan } from "./planner/api.js";
import { syncPublicSelects } from "./public-select.js";
import { settlePageContent } from "./page-content-ready.js";
import { copy, observeDraft, freshness, responseIsCurrent, validatePlan, stageReplacement } from "./planner/workspace-state.js";

const root = document.querySelector("[data-temple-planner]");
const batchSize = () => matchMedia("(max-width: 599px)").matches ? 6 : 12;
const { persistState, restoreState } = createPlannerStorage({ getTargetCount });
const maps = createPlannerMaps({ getPickerItems, getStartPoint, toggleSelection, haversineKm, formatDistance, escapeHtml });
const picker = createPlannerPicker({ getPickerItems, getStartPoint, renderPickerContext, haversineKm, formatDistance, getPickerRecommendationText, escapeHtml, prefersReducedMotion });
const results = createPlannerResults({ formatDistance, formatMinutes, formatClock, escapeHtml, formatDistanceRange, formatMinutesRange, buildSingleMapUrl });

if (root) load();

async function load() {
  root.setAttribute("aria-busy", "true");
  const controls = [...root.querySelectorAll(".planner-setup input,.planner-setup select,.planner-setup button")];
  controls.forEach(control => control.disabled = true);
  try {
    const payload = await loadPlannerCatalog(root.dataset.plannerDataSrc);
    delete root.dataset.plannerLoadError;
    controls.forEach(control => control.disabled = false);
    initialize(payload);
  } catch {
    root.dataset.plannerLoadError = "true";
    const status = root.querySelector("[data-planner-location-status]");
    status.textContent = "โหลดรายชื่อสถานที่ไม่สำเร็จ ";
    const retry = document.createElement("button");
    retry.textContent = "ลองอีกครั้ง";
    retry.type = "button";
    retry.onclick = load;
    status.append(retry);
  } finally { root.removeAttribute("aria-busy"); settlePageContent(root); }
}

function collectElements() {
  const elements = {};
  const names = {
    area: "area", budget: "budget", startDate: "start-date", startTime: "start-time",
    originText: "origin-text", originMatches: "origin-matches", start: "start", radius: "radius", search: "search",
    startWarning: "start-warning", locationStatus: "location-status", autoButton: "auto", buildButton: "build",
    grid: "place-grid", moreButton: "more", empty: "empty", selectedTray: "selected-tray", selectedCount: "selected-count",
    targetCount: "target-count", pickerSearch: "picker-search", pickerNote: "picker-note", pickerToggleScope: "picker-toggle-scope",
    selectionMap: "selection-map", routeMap: "route-map", result: "result", timeline: "timeline", summary: "summary",
    routeMapContent: "route-map-content", routeDialog: "route-dialog", routeDialogBody: "route-dialog-body", mapExpand: "map-expand", mapClose: "map-close",
    warnings: "warnings", googleLink: "google", saveButton: "save", tripSource: "trip-source",
    criteriaNotice: "criteria-notice", freshness: "freshness", unplanned: "unplanned", recoveryNotice: "recovery-notice",
    dialog: "dialog", dialogTitle: "dialog-title", dialogMessage: "dialog-message",
    dialogOptions: "dialog-options", dialogConfirm: "dialog-confirm", dialogCancel: "dialog-cancel",
    viewControl: "view-control", workspaceSummary: "workspace-summary", workspaceCount: "workspace-count",
    mobileBar: "mobile-bar", mobileStatus: "mobile-status", mobilePrimary: "mobile-primary", mobileSecondary: "mobile-secondary",
    routeDisclosure: "route-disclosure", replacement: "replacement", advancedSummary: "advanced-summary", trayExpand: "tray-expand", trayToggle: "tray-toggle",
  };
  for (const [key, suffix] of Object.entries(names)) elements[key] = root.querySelector("[data-planner-" + suffix + "]");
  elements.countInputs = [...root.querySelectorAll('input[name="planner-count"]')];
  elements.purposeTags = [...root.querySelectorAll("[data-planner-purpose-tag]")];
  elements.pickSection = root.querySelector("#planner-pick");
  elements.setup = root.querySelector(".planner-setup");
  return elements;
}

function initialize(payload) {
  const elements = collectElements();
  const state = {
    items: payload.items, itemById: new Map(payload.items.map(item => [item.id, item])), revision: payload.revision,
    selected: [], plan: [], planDetails: null, tripCriteria: null, committed: null,
    activeRegions: new Set(), activeProvinces: new Set(["กรุงเทพมหานคร"]), activePurposes: new Set(["การงาน"]),
    currentLocation: null, nearbyMode: false, manualSelectionOrder: false, pinnedStartId: "",
    originText: "", originResolution: "empty", draftVersion: 0, draftKey: "", replacement: null,
    planRequests: createLatestRequest(), requestToken: 0, pending: false, failed: false, lastRequest: null,
    pickerContext: { type: "browse", mode: "recommended", useCriteria: true, query: "" },
    view: "picker", workspaceOpened: false, visibleCount: batchSize(), trayExpanded: false,
    selectionMap: null, selectionCluster: null, selectionMarkers: new Map(), routeMap: null, routeLayer: null,
    dialogTrigger: null, mapErrors: new Set(),
  };
  root._plannerState = { state, elements };
  elements.startDate.value = getThailandNow().date;
  const saved = restoreState(state, elements);
  state.workspaceOpened = Boolean(state.selected.length || state.plan.length);
  state.view = ["plan", "picker", "both"].includes(saved.workspace?.view) ? saved.workspace.view : state.plan.length ? "plan" : "picker";
  elements.pickerSearch.value = saved.workspace?.query || "";
  state.pickerContext.query = elements.pickerSearch.value;
  state.trayExpanded = Boolean(saved.workspace?.trayExpanded);
  state.visibleCount = Math.max(batchSize(), Number(saved.workspace?.visibleCount) || 0);
  const restoredPlan = state.plan.map(item => item.id);
  state.plan = [];
  state.planDetails = null;
  let restoreNotice = "";
  const removed = (saved.selected || []).filter(id => !state.itemById.has(id));
  const missingPlan = (saved.plan || []).filter(id => !state.itemById.has(id));
  if (removed.length || missingPlan.length) restoreNotice = "ข้อมูลที่บันทึกไว้มีสถานที่ที่ไม่อยู่ในระบบแล้ว " + [...new Set([...removed, ...missingPlan])].join(", ") + " โปรดทบทวนก่อนจัดใหม่";
  if (elements.startDate.value < getThailandNow().date) {
    elements.startDate.value = getThailandNow().date;
    restoreNotice += " ปรับวันที่เดินทางเป็นวันนี้แล้ว โปรดจัดแผนอีกครั้ง";
  }
  elements.startDate.min = getThailandNow().date;
  elements.recoveryNotice.textContent = restoreNotice;
  elements.recoveryNotice.hidden = !restoreNotice;
  syncArea(state, elements);
  const params = new URLSearchParams(location.search);
  const query = params.get("start") || params.get("temple");
  if (query) {
    const matches = state.items.filter(item => normalize(item.name) === normalize(query) && (!params.get("province") || item.province === params.get("province")));
    if (matches.length === 1) {
      elements.originText.value = matches[0].name;
      elements.start.value = matches[0].id;
      state.selected = [matches[0].id];
      state.workspaceOpened = true;
      state.view = "picker";
    } else elements.originText.value = query;
  }
  elements.search.value = params.get("name") || params.get("q") || "";
  if (elements.search.value) {
    elements.pickerSearch.value = elements.search.value;
    state.pickerContext.query = elements.search.value;
  }
  resolveOrigin(state, elements);
  observeDraft(state, getDraftCriteria(state, elements));
  bindControls(state, elements);
  paint(state, elements);
  status(elements, restoreNotice || "เลือกสถานที่เอง หรือให้ระบบจัดเส้นทางแนะนำ");
  if (restoredPlan.length && !restoreNotice && !query) {
    const criteria = saved.tripCriteria || getDraftCriteria(state, elements);
    runPlan(state, elements, { mode: "manual", criteria, selectedIds: restoredPlan, manualSelectionOrder: true, restore: true });
  }
  bindCatalogRefresh(state, elements);
  const guideLayout = matchMedia("(min-width: 900px)");
  const syncGuides = () => root.querySelectorAll(".planner-guide").forEach(guide => { guide.open = guideLayout.matches; });
  syncGuides();
  guideLayout.addEventListener("change", syncGuides);
  const resize = () => {
    state.selectionMap?.invalidateSize();
    state.routeMap?.invalidateSize();
    updateBarSpace(elements);
  };
  new ResizeObserver(resize).observe(elements.mobileBar);
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", () => {
    root.classList.toggle("planner-keyboard-open", innerHeight - visualViewport.height > 140);
    resize();
  });
  root.addEventListener("error", event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.closest(".planner-place-card,.planner-timeline")) return;
    applyImageFallback(image);
    image.alt = "ยังไม่มีภาพสถานที่";
    image.closest("figure")?.classList.add("is-placeholder");
  }, true);
}

function getTargetCount(elements) { return Number(elements.countInputs.find(input => input.checked)?.value || 3); }
function getDraftCriteria(state, elements) {
  return { count: getTargetCount(elements), budget: elements.budget.value, startDate: elements.startDate.value,
    startTime: elements.startTime.value, radius: elements.radius.value, query: elements.search.value,
    start: elements.start.value, regions: [...state.activeRegions].sort(), provinces: [...state.activeProvinces].sort(),
    purposes: [...state.activePurposes].sort(), nearbyMode: state.nearbyMode, currentLocation: state.currentLocation };
}
function applyCriteria(state, elements, criteria) {
  elements.countInputs.forEach(input => input.checked = Number(input.value) === Number(criteria.count));
  for (const key of ["budget", "startDate", "startTime", "radius", "start"]) if (criteria[key] != null) elements[key].value = criteria[key];
  elements.search.value = criteria.query || "";
  state.activeRegions = new Set(criteria.regions || []);
  state.activeProvinces = new Set(criteria.provinces || []);
  state.activePurposes = new Set(criteria.purposes || []);
  state.currentLocation = criteria.currentLocation || null;
  state.nearbyMode = Boolean(criteria.nearbyMode);
  elements.originText.value = state.itemById.get(criteria.start)?.name || "";
  syncArea(state, elements);
  resolveOrigin(state, elements);
}
function syncArea(state, elements) {
  elements.area.value = [...elements.area.options].find(option => {
    const [type, raw = ""] = option.value.split(":");
    const values = raw.split("|").filter(Boolean).sort();
    return JSON.stringify(values) === JSON.stringify([...(type === "region" ? state.activeRegions : state.activeProvinces)].sort());
  })?.value || "";
  syncPublicSelects(elements.area.closest("main"));
}
function syncDraft(state, elements, message = "") {
  state.originText = elements.originText.value;
  const replacing = state.replacement;
  observeDraft(state, getDraftCriteria(state, elements));
  if (replacing && !state.replacement) message ||= "รายการเปลี่ยนแล้ว ยกเลิกการเลือกสถานที่แทน กรุณาเริ่มใหม่";
  state.failed = false;
  paint(state, elements);
  if (message) status(elements, message);
  else if (state.committed && freshness(state, getDraftCriteria(state, elements)) !== "synced") status(elements, "มีการเปลี่ยนเงื่อนไขหรือรายการที่เลือก กดอัปเดตแผนก่อนใช้งาน");
  persistState(state, elements);
}
function status(elements, text) { elements.locationStatus.textContent = text; }
function resolveOrigin(state, elements) {
  const query = normalize(elements.originText.value);
  state.originText = elements.originText.value;
  elements.originMatches.replaceChildren();
  const pinned = state.itemById.get(elements.start.value);
  const exact = state.items.filter(item => normalize(item.name) === query);
  let matches = exact.length ? exact : state.items.filter(item => normalize(item.name).includes(query));
  if (!query) {
    elements.start.value = "";
    state.originResolution = "empty";
    elements.startWarning.textContent = "เมื่อไม่ระบุจุดเริ่มต้น เวลาเริ่มหมายถึงเริ่มที่สถานที่แรก";
  } else if ((pinned && normalize(pinned.name) === query) || exact.length === 1) {
    const item = pinned && normalize(pinned.name) === query ? pinned : exact[0];
    elements.start.value = item.id;
    state.originResolution = "matched";
    elements.startWarning.textContent = "เริ่มที่ " + item.name + " · " + item.province + " (นับรวมในจำนวนสถานที่)";
  } else {
    elements.start.value = "";
    state.originResolution = matches.length ? "ambiguous" : "unmatched";
    elements.startWarning.textContent = matches.length ? "เลือกสถานที่พร้อมพื้นที่ให้ตรงก่อนจัดแผน" : "ยังไม่พบชื่อนี้ในระบบ เลือกจากคำแนะนำ หรือล้างเพื่อเริ่มที่สถานที่แรก";
    for (const item of matches.slice(0, 12)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.plannerOriginId = item.id;
      button.textContent = [item.name, item.province, item.district].filter(Boolean).join(" · ");
      elements.originMatches.append(button);
    }
  }
  elements.originText.setAttribute("aria-invalid", String(["unmatched", "ambiguous"].includes(state.originResolution)));
}
function adoptOrigin(state, elements) {
  const id = elements.start.value;
  if (!id) return;
  if (state.selected.includes(id) || state.selected.length < getTargetCount(elements)) {
    state.selected = [id, ...state.selected.filter(selected => selected !== id)];
  }
}

function bindControls(state, elements) {
  elements.countInputs.forEach(input => input.addEventListener("change", () => {
    const next = getTargetCount(elements);
    const acceptedCount = Number(root.dataset.plannerCount || next);
    if (state.selected.length > next) {
      elements.countInputs.forEach(radio => radio.checked = Number(radio.value) === acceptedCount);
      const ids = [...state.selected];
      openDialog(state, elements, {
        title: "เลือก " + next + " สถานที่ที่จะเก็บ", message: "จำนวนใหม่ยังไม่ถูกใช้ เลือกรายการที่จะเก็บให้ครบ หรือยกเลิกเพื่อคงรายการเดิม",
        confirmText: "เก็บรายการที่เลือก", choices: ids.map(id => ({ id, name: state.itemById.get(id)?.name || id })), limit: next,
        action: kept => { state.selected = kept; elements.countInputs.forEach(radio => radio.checked = Number(radio.value) === next); syncDraft(state, elements); },
      });
    } else syncDraft(state, elements);
  }));
  elements.area.addEventListener("change", () => {
    const [type, raw = ""] = elements.area.value.split(":");
    state.activeRegions = new Set(type === "region" ? raw.split("|") : []);
    state.activeProvinces = new Set(type?.startsWith("province") && raw ? raw.split("|") : []);
    syncDraft(state, elements);
  });
  elements.originText.addEventListener("input", () => {
    resolveOrigin(state, elements);
    adoptOrigin(state, elements);
    syncDraft(state, elements);
  });
  for (const node of [elements.startDate, elements.startTime, elements.budget, elements.radius, elements.search]) node.addEventListener("input", () => { node.removeAttribute("aria-invalid"); syncDraft(state, elements); });
  elements.pickerSearch.addEventListener("input", () => {
    state.pickerContext.query = elements.pickerSearch.value;
    state.visibleCount = batchSize();
    paintPicker(state, elements);
    persistState(state, elements);
  });
  elements.routeDisclosure.addEventListener("toggle", () => {
    if (elements.routeDisclosure.open && state.plan.length && !elements.result.hidden) openMap(state, elements, "route");
  });
  maps.bindRouteDialog(state, elements, () => openMap(state, elements, "route"));
  root.querySelector(".planner-tray-wrap").addEventListener("toggle", event => {
    elements.trayToggle.setAttribute("aria-expanded", String(event.target.open));
  });
  root.addEventListener("click", event => {
    const button = event.target.closest("button,a[data-planner-jump]");
    if (!button) return;
    const d = button.dataset;
    if ("plannerView" in d) setView(state, elements, d.plannerView);
    else if ("plannerJump" in d) { event.preventDefault(); jump(elements, d.plannerJump); }
    else if ("plannerPurposeTag" in d) { state.activePurposes.has(button.value) ? state.activePurposes.delete(button.value) : state.activePurposes.add(button.value); syncDraft(state, elements); }
    else if ("plannerOriginId" in d) { elements.start.value = d.plannerOriginId; elements.originText.value = state.itemById.get(d.plannerOriginId).name; resolveOrigin(state, elements); adoptOrigin(state, elements); syncDraft(state, elements); }
    else if ("plannerOriginClear" in d) { elements.originText.value = ""; resolveOrigin(state, elements); syncDraft(state, elements); elements.originText.focus(); }
    else if ("plannerFilterSearch" in d || "plannerEdit" in d) { state.workspaceOpened = true; setView(state, elements, state.committed ? "both" : "picker"); jump(elements, "picker"); }
    else if ("plannerAuto" in d) confirmAuto(state, elements);
    else if ("plannerBuild" in d || "plannerCriteriaRebuild" in d || "plannerUpdate" in d) buildManual(state, elements);
    else if ("plannerCriteriaRestore" in d || "plannerRevert" in d) revert(state, elements);
    else if ("plannerPickerMode" in d) {
      state.pickerContext.mode = d.plannerPickerMode;
      paintPicker(state, elements);
      if (d.plannerPickerMode === "browse") elements.pickerSearch.focus({ preventScroll: true });
    }
    else if ("plannerPickerToggleScope" in d) { state.pickerContext.useCriteria = !state.pickerContext.useCriteria; state.visibleCount = batchSize(); paintPicker(state, elements); }
    else if ("plannerPickerTab" in d) {
      state.pickerSurface = d.plannerPickerTab;
      root.querySelectorAll("[data-planner-picker-panel]").forEach(panel => panel.hidden = panel.dataset.plannerPickerPanel !== state.pickerSurface);
      root.querySelectorAll("[data-planner-picker-tab]").forEach(tab => tab.setAttribute("aria-pressed", String(tab === button)));
      root.querySelector('[data-planner-picker-tab="' + (state.pickerSurface === "map" ? "list" : "map") + '"]').focus({ preventScroll: true });
      if (state.pickerSurface === "map") openMap(state, elements, "picker");
    }
    else if ("plannerMore" in d) { state.visibleCount += batchSize(); paintPicker(state, elements); persistState(state, elements); }
    else if ("plannerTogglePlace" in d) toggleSelection(state, elements, d.plannerTogglePlace);
    else if ("plannerRemoveSelected" in d) toggleSelection(state, elements, d.plannerRemoveSelected, false);
    else if ("plannerTrayExpand" in d) { state.trayExpanded = !state.trayExpanded; paintPicker(state, elements); }
    else if ("plannerTrayToggle" in d) {
      const tray = root.querySelector(".planner-tray-wrap");
      tray.open = !tray.open;
      if (tray.open) { state.trayExpanded = true; paintPicker(state, elements); }
      elements.trayToggle.setAttribute("aria-expanded", String(tray.open));
    }
    else if ("plannerMoveSelected" in d) moveDraft(state, elements, d.plannerId, Number(d.plannerMoveSelected));
    else if ("plannerMove" in d) moveDraft(state, elements, button.closest("[data-planner-stop]").dataset.plannerStop, d.plannerMove === "up" ? -1 : 1);
    else if ("plannerRemoveStop" in d) toggleSelection(state, elements, button.closest("[data-planner-stop]").dataset.plannerStop, false);
    else if ("plannerReplace" in d) beginReplace(state, elements, button.closest("[data-planner-stop]").dataset.plannerStop, button);
    else if ("plannerReplacementCancel" in d) { const trigger = state.replacement?.trigger; state.replacement = null; paintPicker(state, elements); trigger?.focus(); }
    else if ("plannerClearSelection" in d) openDialog(state, elements, { title: "ล้างรายการที่เลือก?", message: "แผนที่คำนวณไว้จะยังอยู่จนกว่าจะอัปเดตหรือล้างแผน", action: () => { state.selected = []; syncDraft(state, elements); } });
    else if ("plannerClearTrip" in d) openDialog(state, elements, { title: "ล้างแผนนี้?", message: "ล้างแผนและรายการที่เลือก แต่เก็บเงื่อนไขไว้จัดใหม่", action: () => { cancelRequest(state, elements); state.selected = []; state.committed = null; state.plan = []; state.planDetails = null; state.tripCriteria = null; state.view = "picker"; syncDraft(state, elements); renderCommitted(state, elements); } });
    else if ("plannerSave" in d) { if (canExport(state, elements)) status(elements, persistState(state, elements) ? "บันทึกไว้ในเบราว์เซอร์นี้แล้ว" : "บันทึกบนอุปกรณ์นี้ไม่ได้ คุณยังใช้งานแผนในหน้านี้ต่อได้"); }
    else if ("plannerMapRetry" in d) openMap(state, elements, d.plannerMapRetry);
    else if ("plannerCancel" in d) cancelRequest(state, elements);
    else if ("plannerRetry" in d) mobilePrimary(state, elements);
    else if ("plannerMobilePrimary" in d) mobilePrimary(state, elements);
    else if ("plannerMobileSecondary" in d) {
      if (state.pending) cancelRequest(state, elements);
      else if (state.view === "plan") { setView(state, elements, "both"); jump(elements, "picker"); }
      else if (state.committed) { if (state.view === "picker") setView(state, elements, "both"); jump(elements, "plan"); }
      else { state.trayExpanded = true; root.querySelector(".planner-tray-wrap").open = true; paintPicker(state, elements); jump(elements, "picker"); }
    }
  });
  elements.googleLink.addEventListener("click", event => { if (!canExport(state, elements)) { event.preventDefault(); status(elements, "อัปเดตแผนก่อนเปิดเส้นทาง"); } });
}

function getPickerItems(state, elements) {
  const criteria = getDraftCriteria(state, elements);
  const query = normalize(elements.pickerSearch.value);
  const filtered = state.items.filter(item => {
    if (state.replacement && state.selected.includes(item.id)) return false;
    const searchable = normalize([item.name, item.region, item.province, item.district, ...(item.blessings || []), ...(item.objectHero || [])].join(" "));
    return (!query || searchable.includes(query)) && (!state.pickerContext.useCriteria || matchesCriteria(item, criteria));
  });
  const route = state.plan.length ? state.plan : state.selected.map(id => state.itemById.get(id)).filter(Boolean);
  return filtered.sort((a, b) => {
    if (state.pickerContext.mode === "browse") return Number(state.selected.includes(b.id)) - Number(state.selected.includes(a.id)) || a.globalRank - b.globalRank;
    const score = item => {
      if (state.replacement) {
        const at = state.replacement.slot;
        return haversineKm(state.itemById.get(state.selected[at - 1]) || item, item) + haversineKm(item, state.itemById.get(state.selected[at + 1]) || item);
      }
      if (route.length) return (state.selected.includes(item.id) ? -500 : 0) + Math.min(...route.map(stop => haversineKm(stop, item))) * 4 + Math.min(item.globalRank || 200, 200) * .25;
      return item.globalRank || 200;
    };
    return score(a) - score(b);
  });
}
function matchesCriteria(item, criteria) {
  return (!criteria.regions.length || criteria.regions.includes(item.region))
    && (!criteria.provinces.length || criteria.provinces.includes(item.province))
    && (!criteria.purposes.length || item.blessings.some(value => criteria.purposes.includes(value)));
}
function getPickerRecommendationText() { return ""; }
function renderPickerContext(state, elements, count) {
  elements.pickerNote.textContent = "พบ " + count + " สถานที่" + (state.pickerContext.useCriteria ? "ตามเงื่อนไข" : "จากทุกพื้นที่");
  elements.pickerToggleScope.setAttribute("aria-pressed", String(!state.pickerContext.useCriteria));
  elements.pickerToggleScope.textContent = state.pickerContext.useCriteria ? "แสดงทั้งหมด" : "ใช้เงื่อนไขแผน";
  root.querySelectorAll("[data-planner-picker-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.plannerPickerMode === state.pickerContext.mode)));
  const showSearch = state.pickerContext.mode === "browse" || Boolean(elements.pickerSearch.value.trim());
  elements.pickerSearch.closest(".planner-search").hidden = !showSearch;
  elements.pickerNote.hidden = !showSearch;
}
function paintPicker(state, elements) {
  const focus = document.activeElement;
  const focusData = focus?.dataset?.plannerTogglePlace || focus?.dataset?.plannerRemoveSelected;
  state.outsideIds = state.selected.filter(id => !matchesCriteria(state.itemById.get(id), getDraftCriteria(state, elements)));
  picker.renderSelected(state, elements);
  picker.renderPicker(state, elements);
  elements.targetCount.textContent = getTargetCount(elements);
  elements.trayToggle.disabled = state.selected.length === 0;
  elements.trayToggle.classList.toggle("has-outside-selection", state.outsideIds.length > 0);
  elements.trayToggle.title = state.outsideIds.length ? "จัดการรายการที่เลือก · มีรายการนอกตัวกรอง" : "จัดการรายการที่เลือก";
  if (!state.selected.length) root.querySelector(".planner-tray-wrap").open = false;
  elements.trayExpand.hidden = state.selected.length <= 3;
  elements.trayExpand.textContent = state.trayExpanded ? "ย่อรายการที่เลือก" : "ดูรายการที่เลือกทั้งหมด (" + state.selected.length + ")";
  root.querySelector("[data-planner-order-label]").textContent = state.selected.length ? state.manualSelectionOrder ? "ใช้ลำดับที่คุณกำหนด" : "รายการที่เลือก · ระบบจะจัดลำดับเมื่อสร้างแผน" : "";
  elements.replacement.hidden = !state.replacement;
  if (state.replacement) elements.replacement.querySelector("p").textContent = "กำลังเปลี่ยนจุดที่ " + (state.replacement.slot + 1) + ": " + state.itemById.get(state.replacement.oldId)?.name;
  maps.refreshSelectionMap(state, elements);
  if (focusData) [...root.querySelectorAll("[data-planner-toggle-place],[data-planner-remove-selected]")].find(node => node.dataset.plannerTogglePlace === focusData || node.dataset.plannerRemoveSelected === focusData)?.focus({ preventScroll: true });
}

function toggleSelection(state, elements, id, force) {
  if (!state.itemById.has(id)) return;
  if (state.replacement && force !== false) {
    const replacement = state.replacement;
    openDialog(state, elements, { title: "ยืนยันเปลี่ยนสถานที่?", message: "แทน " + state.itemById.get(replacement.oldId).name + " ด้วย " + state.itemById.get(id).name,
      action: () => {
        if (!stageReplacement(state, replacement.oldId, id)) { status(elements, "ข้อมูลเปลี่ยนแล้ว กรุณาเลือกสถานที่แทนอีกครั้ง"); return; }
        if (elements.start.value === replacement.oldId) { elements.start.value = id; elements.originText.value = state.itemById.get(id).name; resolveOrigin(state, elements); }
        syncDraft(state, elements, "เปลี่ยนรายการที่เลือกแล้ว กดอัปเดตแผนเพื่อคำนวณเวลาใหม่");
      } });
    return;
  }
  const index = state.selected.indexOf(id);
  const select = force ?? index < 0;
  if (select && index < 0) {
    if (state.selected.length >= getTargetCount(elements)) { status(elements, "เลือกครบ " + getTargetCount(elements) + " สถานที่แล้ว นำออกก่อนเพิ่ม หรือเปลี่ยนจำนวนสูงสุด"); return; }
    state.selected.push(id);
  } else if (!select && index >= 0) {
    state.selected.splice(index, 1);
    if (elements.start.value === id) { elements.start.value = ""; elements.originText.value = ""; resolveOrigin(state, elements); }
  }
  state.workspaceOpened = true;
  syncDraft(state, elements);
}
function moveDraft(state, elements, id, offset) {
  const index = state.selected.indexOf(id), next = index + offset;
  if (index < 0 || next < 0 || next >= state.selected.length) return;
  if (elements.start.value && (id === elements.start.value || state.selected[next] === elements.start.value)) { status(elements, "จุดเริ่มต้นที่เลือกต้องเป็นสถานที่แรก ล้างจุดเริ่มต้นก่อนเปลี่ยนลำดับ"); return; }
  [state.selected[index], state.selected[next]] = [state.selected[next], state.selected[index]];
  state.manualSelectionOrder = true;
  syncDraft(state, elements, "ใช้ลำดับที่คุณกำหนด กดอัปเดตแผนเพื่อคำนวณเวลาใหม่");
}
function beginReplace(state, elements, id, trigger) {
  const slot = state.selected.indexOf(id);
  if (slot < 0) { status(elements, "สถานที่นี้ถูกนำออกจากรายการที่กำลังแก้แล้ว"); return; }
  state.replacement = { oldId: id, slot, version: state.draftVersion, revision: state.revision, trigger };
  setView(state, elements, "both");
  jump(elements, "picker");
}
function revert(state, elements) {
  if (!state.committed) return;
  openDialog(state, elements, { title: "คืนค่าแผนเดิม?", message: "การแก้ไขรายการและเงื่อนไขที่ยังไม่ได้จัดแผนจะถูกแทนที่", action: () => {
    state.selected = state.committed.planIds.filter(id => state.itemById.has(id));
    state.manualSelectionOrder = true;
    applyCriteria(state, elements, state.committed.criteria);
    syncDraft(state, elements, state.committed.revision === state.revision ? "คืนค่าแผนเดิมแล้ว" : "ข้อมูลสถานที่เปลี่ยนแล้ว ต้องจัดแผนใหม่ก่อนใช้งาน");
  } });
}

function paint(state, elements) {
  const current = freshness(state, getDraftCriteria(state, elements));
  root.dataset.workspaceView = state.workspaceOpened ? state.view : "initial";
  root.dataset.plannerFreshness = current;
  root.dataset.plannerCount = getTargetCount(elements);
  root.querySelector("[data-planner-cancel]").hidden = !state.pending;
  root.querySelector("[data-planner-retry]").hidden = !state.failed;
  elements.viewControl.hidden = !state.workspaceOpened;
  elements.pickSection.hidden = !state.workspaceOpened || state.view === "plan";
  elements.result.hidden = !state.workspaceOpened || state.view === "picker";
  root.querySelectorAll("[data-planner-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.plannerView === state.view)));
  elements.workspaceSummary.hidden = !(state.workspaceOpened && state.view === "both");
  elements.workspaceCount.textContent = "เลือก " + state.selected.length + "/" + getTargetCount(elements) + (state.committed ? " · " + (current === "synced" ? "แผน " : "แผนเดิม ") + state.plan.length + " จุด" : " · ยังไม่มีแผน");
  elements.purposeTags.forEach(button => button.setAttribute("aria-pressed", String(state.activePurposes.has(button.value))));
  elements.advancedSummary.textContent = formatDate(elements.startDate.value) + " · งบเวลาอ้างอิง " + formatMinutes(Number(elements.budget.value));
  elements.criteriaNotice.hidden = !state.committed || current === "synced";
  elements.freshness.hidden = !state.committed || current === "synced";
  elements.freshness.querySelector("p").textContent = current === "catalog-stale" ? "ข้อมูลสถานที่เปลี่ยนแล้ว แผนนี้เป็นข้อมูลเก่า โปรดทบทวนและจัดเส้นทางใหม่" : "มีการเปลี่ยนเงื่อนไขหรือรายการที่เลือก แผนนี้ยังเป็นแผนก่อนแก้ไข";
  elements.unplanned.hidden = Boolean(state.committed);
  elements.unplanned.textContent = "ยังไม่ได้จัดเส้นทาง" + (state.selected.length ? " · " + state.selected.map(id => state.itemById.get(id)?.name).join(" / ") : "");
  elements.routeDisclosure.hidden = !state.committed;
  elements.autoButton.disabled = state.pending;
  elements.buildButton.disabled = state.pending || !state.selected.length;
  elements.buildButton.textContent = state.committed ? "อัปเดตแผนจากที่เลือก " + state.selected.length + " แห่ง" : "จัดจากที่เลือก " + state.selected.length + " แห่ง";
  root.querySelectorAll("[data-planner-update],[data-planner-criteria-rebuild]").forEach(button => button.disabled = state.pending || !state.selected.length);
  const exportable = canExport(state, elements);
  elements.saveButton.disabled = !exportable;
  elements.googleLink.setAttribute("aria-disabled", String(!exportable));
  if (exportable) elements.googleLink.href = buildGoogleMapsUrl(state); else elements.googleLink.removeAttribute("href");
  elements.result.setAttribute("aria-busy", String(state.pending));
  elements.saveButton.title = exportable ? "" : "อัปเดตแผนก่อนบันทึก";
  elements.mobileBar.hidden = !state.workspaceOpened;
  paintPicker(state, elements);
  paintMobileBar(state, elements, current);
  if (state.plan.length && elements.routeDisclosure.open && !elements.result.hidden) openMap(state, elements, "route");
}
function setView(state, elements, view) {
  if (state.replacement && view !== "both") {
    openDialog(state, elements, { title: "ออกจากการเปลี่ยนสถานที่?", message: "รายการเดิมยังอยู่ครบ การเลือกสถานที่แทนที่ยังไม่ยืนยันจะถูกยกเลิก", action: () => { state.replacement = null; setView(state, elements, view); } });
    return;
  }
  const focused = document.activeElement;
  state.view = view;
  state.workspaceOpened = true;
  elements.setup.open = view !== "plan" || !state.committed;
  paint(state, elements);
  persistState(state, elements);
  if (focused?.closest("[hidden]")) (view === "picker" ? root.querySelector("#planner-pick-title") : root.querySelector("#planner-result-title")).focus({ preventScroll: true });
}
function jump(elements, destination) {
  const node = destination === "picker" ? elements.pickSection : elements.result;
  node.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  node.querySelector("h2").focus({ preventScroll: true });
}
function paintMobileBar(state, elements, current) {
  const label = state.pending ? "กำลังจัดเส้นทาง…" : state.failed ? "จัดแผนไม่สำเร็จ" : current === "catalog-stale" ? "ข้อมูลสถานที่เปลี่ยน" : current === "draft-changed" ? "มีรายการหรือเงื่อนไขเปลี่ยน" : state.committed ? state.plan.length + " สถานที่ · รวมประมาณ " + formatMinutes(state.planDetails.totalMinutes) : "เลือกแล้ว " + state.selected.length + "/" + getTargetCount(elements);
  elements.mobileStatus.textContent = label;
  elements.mobilePrimary.textContent = state.pending ? "กำลังคำนวณ…" : state.failed ? "ลองอีกครั้ง" : current === "catalog-stale" ? "ทบทวนและอัปเดต" : current === "draft-changed" ? "อัปเดตแผน" : state.committed ? state.view === "picker" ? "ดูแผนเส้นทาง" : "เปิด Google Maps" : "จัดจากที่เลือก";
  elements.mobilePrimary.disabled = state.pending || (!state.committed && !state.selected.length && !state.failed);
  elements.mobileSecondary.textContent = state.pending ? "ยกเลิก" : state.view === "plan" ? "แก้สถานที่" : state.committed ? "ดูแผนเดิม" : "ดูที่เลือก";
}
function mobilePrimary(state, elements) {
  if (state.failed) { if (state.lastRequest?.mode === "auto") confirmAuto(state, elements); else buildManual(state, elements); }
  else if (canExport(state, elements)) {
    if (state.view === "picker") { setView(state, elements, "plan"); jump(elements, "plan"); }
    else window.open(buildGoogleMapsUrl(state), "_blank", "noopener");
  } else buildManual(state, elements);
}
function updateBarSpace(elements) { document.body.style.setProperty("--planner-bar-height", elements.mobileBar.hidden ? "0px" : elements.mobileBar.getBoundingClientRect().height + "px"); }

function validateInputs(state, elements, manual) {
  for (const input of [elements.startDate, elements.startTime]) {
    if (!input.checkValidity()) { status(elements, "ตรวจสอบวันที่และเวลาเริ่มให้ถูกต้อง"); elements.setup.open = true; input.closest("details").open = true; input.setAttribute("aria-invalid", "true"); input.reportValidity(); input.focus(); return false; }
  }
  if (["unmatched", "ambiguous"].includes(state.originResolution)) { status(elements, elements.startWarning.textContent); elements.setup.open = true; elements.originText.focus(); return false; }
  if (manual && elements.start.value && !state.selected.includes(elements.start.value)) {
    status(elements, "เพิ่มจุดเริ่มต้นในรายการที่เลือกก่อน หรือล้างจุดเริ่มต้น" + (state.selected.length >= getTargetCount(elements) ? " รายการที่เลือกครบจำนวนแล้ว" : ""));
    setView(state, elements, "both");
    return false;
  }
  return !manual || (state.selected.length > 0 && state.selected.length <= getTargetCount(elements));
}
function confirmAuto(state, elements) {
  if (!validateInputs(state, elements, false)) return;
  const action = () => runPlan(state, elements, { mode: "auto", criteria: getDraftCriteria(state, elements), selectedIds: [], manualSelectionOrder: false });
  if (state.selected.length || state.committed) openDialog(state, elements, { title: "จัดเส้นทางแนะนำใหม่?", message: "เมื่อจัดสำเร็จ ระบบจะแทนที่รายการที่เลือกและแผนเดิมด้วยชุดแนะนำใหม่", confirmText: "จัดเส้นทางแนะนำ", action });
  else action();
}
function buildManual(state, elements) {
  if (!validateInputs(state, elements, true)) return;
  runPlan(state, elements, { mode: "manual", criteria: getDraftCriteria(state, elements), selectedIds: [...state.selected], manualSelectionOrder: state.manualSelectionOrder });
}
async function runPlan(state, elements, options) {
  if (state.pending) return;
  const request = state.planRequests.start();
  const submitted = copy({ ...options, token: ++state.requestToken, version: state.draftVersion, revision: state.revision });
  state.pending = true; state.failed = false; state.lastRequest = options;
  status(elements, options.restore ? "กำลังตรวจข้อมูลแผนบนอุปกรณ์นี้" : "กำลังจัดเส้นทาง…");
  paint(state, elements);
  let accepted = false;
  try {
    const payload = await requestPlannerPlan({ mode: options.mode, criteria: submitted.criteria, selectedIds: submitted.selectedIds, manualSelectionOrder: submitted.manualSelectionOrder, revision: submitted.revision }, { signal: request.signal });
    if (!request.isCurrent() || !responseIsCurrent(state, submitted)) {
      if (request.isCurrent()) status(elements, "เงื่อนไขเปลี่ยนแล้ว โปรดจัดแผนอีกครั้ง");
      return;
    }
    const committed = validatePlan(payload, submitted, state.itemById);
    accepted = true;
    state.committed = committed;
    state.plan = committed.items;
    state.planDetails = committed.details;
    state.tripCriteria = committed.criteria;
    if (!options.restore) {
      elements.recoveryNotice.hidden = true;
      state.selected = [...committed.planIds];
      state.manualSelectionOrder = true;
      observeDraft(state, getDraftCriteria(state, elements));
      state.view = state.view === "both" ? "both" : options.mode === "manual" ? "both" : "plan";
    }
    state.workspaceOpened = true;
    elements.setup.open = state.view !== "plan";
    renderCommitted(state, elements);
    elements.routeDisclosure.open = innerWidth >= 900;
    status(elements, "จัดแผน " + state.plan.length + " สถานที่แล้ว");
    persistState(state, elements);
  } catch (error) {
    if (!request.isCurrent()) return;
    if (error.payload?.code === "CATALOG_CHANGED") {
      applyCatalog(state, elements, error.payload.catalog);
      status(elements, "ข้อมูลสถานที่เปลี่ยนแล้ว โปรดทบทวนรายการและจัดเส้นทางใหม่");
    } else { state.failed = true; status(elements, error.message || "จัดแผนไม่สำเร็จ รายการที่คุณเลือกยังอยู่ ลองอีกครั้งได้"); }
  } finally {
    if (request.isCurrent()) {
      state.pending = false;
      paint(state, elements);
      if (accepted && !options.restore) jump(elements, "plan");
    }
  }
}
function cancelRequest(state, elements) {
  state.planRequests.cancel(); state.requestToken++; state.pending = false;
  status(elements, "ยกเลิกการคำนวณแล้ว รายการที่เลือกยังอยู่");
  paint(state, elements);
}
function canExport(state, elements) { return !state.pending && !state.failed && freshness(state, getDraftCriteria(state, elements)) === "synced"; }
function renderCommitted(state, elements) {
  if (!state.committed) { elements.summary.innerHTML = ""; elements.timeline.innerHTML = ""; elements.warnings.hidden = true; elements.tripSource.hidden = true; return; }
  const details = { ...state.planDetails, stops: state.planDetails.stops.map((stop, index) => ({ ...stop, item: state.plan[index] })) };
  elements.summary.innerHTML = results.renderSummary(details);
  const budget = Number(state.tripCriteria.budget);
  details.warnings = (details.warnings || []).map(warning => warning.startsWith("แผนยาวกว่าเวลาที่เลือก") ? "เวลาประมาณมากกว่างบเวลาอ้างอิง " + formatMinutes(budget) + " อยู่ " + formatMinutes(details.totalMinutes - budget) : warning);
  results.renderWarnings(details, elements);
  elements.timeline.innerHTML = state.plan.map((item, index) => results.renderTimelineItem(item, index, details, state.plan.length)).join("");
  const c = state.tripCriteria;
  elements.tripSource.hidden = false;
  elements.tripSource.querySelector("div").textContent = state.plan.length + "/" + c.count + " สถานที่ · " + (c.provinces.join(", ") || c.regions.join(", ") || "ทุกพื้นที่") + " · " + (c.purposes.join(", ") || "ทุกความสนใจ") + " · " + formatDate(c.startDate) + " · เริ่ม " + c.startTime + " · งบเวลา " + formatMinutes(Number(c.budget)) + " · " + (state.plan.find(item => item.id === c.start)?.name || "เริ่มที่จุดแรก");
  root.querySelector("[data-planner-maps-limit]").hidden = state.plan.length <= 4;
  if (state.routeMap) maps.renderRouteMap(state, elements);
}

async function openMap(state, elements, kind) {
  if (state.mapLoading?.has(kind)) return;
  state.mapLoading ||= new Set(); state.mapLoading.add(kind);
  const errorNode = root.querySelector('[data-planner-map-error="' + kind + '"]');
  try {
    if (kind === "picker") await maps.ensureSelectionMap(state, elements);
    else { await maps.ensureLeaflet(); maps.renderRouteMap(state, elements); }
    errorNode.hidden = true;
  } catch {
    errorNode.hidden = false;
    errorNode.textContent = "โหลดแผนที่ไม่สำเร็จ ยังใช้รายการสถานที่ได้ ";
    const retry = document.createElement("button");
    retry.type = "button"; retry.dataset.plannerMapRetry = kind; retry.textContent = "ลองอีกครั้ง";
    errorNode.append(retry);
  } finally { state.mapLoading.delete(kind); }
}

function applyCatalog(state, elements, catalog) {
  const oldNames = new Map(state.items.map(item => [item.id, item.name]));
  state.items = catalog.items; state.itemById = new Map(catalog.items.map(item => [item.id, item])); state.revision = catalog.revision;
  const removed = state.selected.filter(id => !state.itemById.has(id));
  state.selected = state.selected.filter(id => state.itemById.has(id));
  state.replacement = null;
  state.selectionMap?.remove(); state.selectionMap = null; state.selectionCluster = null; state.selectionMarkers.clear();
  delete elements.selectionMap._plannerContext;
  resolveOrigin(state, elements);
  observeDraft(state, getDraftCriteria(state, elements));
  paint(state, elements);
  if (state.pickerSurface === "map" && !elements.pickSection.hidden) openMap(state, elements, "picker");
  persistState(state, elements);
  return removed.map(id => oldNames.get(id) || id);
}
function bindCatalogRefresh(state, elements) {
  let appliedRevision = window.MongkolWelaCMS?.content?.plannerDataRevision, refreshing = false;
  document.addEventListener("mw:cms-content-checked", async event => {
    const revision = event.detail?.content?.plannerDataRevision;
    if (!revision || revision === appliedRevision || refreshing) return;
    refreshing = true;
    const before = state.revision;
    try {
      const catalog = await loadPlannerCatalog(root.dataset.plannerDataSrc, { revision: before });
      if (state.revision !== before) return;
      if (!catalog.unchanged && catalog.revision !== state.revision) {
        const removed = applyCatalog(state, elements, catalog);
        status(elements, "ข้อมูลสถานที่อัปเดตแล้ว โปรดทบทวนและจัดแผนอีกครั้ง" + (removed.length ? " · นำออกจากระบบ: " + removed.join(", ") : ""));
      }
      delete root.dataset.plannerRefreshError;
      appliedRevision = revision;
    } catch { root.dataset.plannerRefreshError = "true"; status(elements, "ไม่สามารถยืนยันข้อมูลสถานที่ล่าสุดได้ กำลังรอตรวจสอบอีกครั้ง"); }
    finally { refreshing = false; }
  });
}

function openDialog(state, elements, options) {
  state.dialogTrigger = document.activeElement;
  elements.dialogTitle.textContent = options.title;
  elements.dialogMessage.textContent = options.message;
  elements.dialogOptions.replaceChildren();
  elements.dialogConfirm.textContent = options.confirmText || "ยืนยัน";
  elements.dialogConfirm.disabled = Boolean(options.choices);
  for (const choice of options.choices || []) {
    const label = document.createElement("label"), input = document.createElement("input");
    input.type = "checkbox"; input.value = choice.id;
    label.append(input, document.createTextNode(choice.name));
    elements.dialogOptions.append(label);
  }
  const chosen = () => [...elements.dialogOptions.querySelectorAll("input:checked")].map(input => input.value);
  elements.dialogOptions.onchange = () => elements.dialogConfirm.disabled = chosen().length !== options.limit;
  const close = () => {
    elements.dialog.hidden = true; elements.dialog.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-planner-dialog");
    document.removeEventListener("keydown", keydown);
    state.dialogTrigger?.focus({ preventScroll: true });
  };
  const keydown = event => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key !== "Tab") return;
    const nodes = [...elements.dialog.querySelectorAll("button:not(:disabled),input")].filter(node => !node.hidden);
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
    if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
  };
  elements.dialogCancel.onclick = close;
  elements.dialogConfirm.onclick = () => { const ids = chosen(); close(); options.action(ids); };
  elements.dialog.hidden = false; elements.dialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-planner-dialog");
  document.addEventListener("keydown", keydown);
  elements.dialogCancel.focus();
}

function getStartPoint(state, elements) { return state.currentLocation || state.itemById.get(elements.start.value); }
function haversineKm(left, right) {
  if (!left || !right) return Infinity;
  const radians = value => Number(value) * Math.PI / 180;
  const dlat = radians(right.latitude - left.latitude), dlon = radians(right.longitude - left.longitude);
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function buildGoogleMapsUrl(state) {
  if (!state.plan.length) return "#";
  const origin = state.tripCriteria.currentLocation || state.plan[0];
  const waypoints = state.tripCriteria.currentLocation ? state.plan.slice(0, -1) : state.plan.slice(1, -1);
  const coords = item => item.latitude + "," + item.longitude;
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({ api: "1", origin: coords(origin), destination: coords(state.plan.at(-1)), travelmode: "driving", ...(waypoints.length ? { waypoints: waypoints.map(coords).join("|") } : {}) }).toString();
  return url.href;
}
function buildSingleMapUrl(item) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(item.latitude + "," + item.longitude); }
function formatDate(value) { return value ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(value + "T00:00:00+07:00")) : "ระบุวันที่เดินทาง"; }
