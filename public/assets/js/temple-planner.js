const root = document.querySelector("[data-temple-planner]");
const payloadNode = document.getElementById("templePlannerData");

if (root && payloadNode) initializeTemplePlanner(root, JSON.parse(payloadNode.textContent || "{}"));

function initializeTemplePlanner(planner, payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const itemById = new Map(items.map((item) => [item.id, item]));
  const elements = collectElements(planner);
  const state = {
    items,
    itemById,
    selected: [],
    plan: [],
    visibleCount: 36,
    currentLocation: null,
    selectionMap: null,
    selectionCluster: null,
    selectionMarkers: new Map(),
    routeMap: null,
    routeLayer: null,
  };

  planner._plannerState = { state, elements };
  restoreState(state, elements);
  bindControls(state, elements);
  updateProvinceOptions(state, elements);
  renderPicker(state, elements);
  renderSelected(state, elements);
  updateTargetCount(state, elements);

  if (state.plan.length) {
    renderPlan(state, elements, { scroll: false });
  }
}

function collectElements(planner) {
  return {
    countInputs: [...planner.querySelectorAll('input[name="planner-count"]')],
    budget: planner.querySelector("[data-planner-budget]"),
    startTime: planner.querySelector("[data-planner-start-time]"),
    region: planner.querySelector("[data-planner-region]"),
    province: planner.querySelector("[data-planner-province]"),
    purpose: planner.querySelector("[data-planner-purpose]"),
    start: planner.querySelector("[data-planner-start]"),
    locationButton: planner.querySelector("[data-planner-location]"),
    locationStatus: planner.querySelector("[data-planner-location-status]"),
    autoButton: planner.querySelector("[data-planner-auto]"),
    pickerTabs: [...planner.querySelectorAll("[data-planner-picker-tab]")],
    pickerPanels: [...planner.querySelectorAll("[data-planner-picker-panel]")],
    search: planner.querySelector("[data-planner-search]"),
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
    summary: planner.querySelector("[data-planner-summary]"),
    warnings: planner.querySelector("[data-planner-warnings]"),
    resultTabs: [...planner.querySelectorAll("[data-planner-result-tab]")],
    resultPanels: [...planner.querySelectorAll("[data-planner-result-panel]")],
    timeline: planner.querySelector("[data-planner-timeline]"),
    routeMap: planner.querySelector("[data-planner-route-map]"),
    saveButton: planner.querySelector("[data-planner-save]"),
    googleLink: planner.querySelector("[data-planner-google]"),
    pickSection: planner.querySelector("#planner-pick"),
  };
}

function bindControls(state, elements) {
  elements.countInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const target = getTargetCount(elements);
      if (state.selected.length > target) state.selected = state.selected.slice(0, target);
      state.visibleCount = 36;
      renderSelected(state, elements);
      renderPicker(state, elements);
      updateTargetCount(state, elements);
      persistState(state, elements);
    });
  });

  [elements.region, elements.province, elements.purpose].forEach((control) => {
    control?.addEventListener("change", () => {
      state.visibleCount = 36;
      if (control === elements.region) updateProvinceOptions(state, elements);
      renderPicker(state, elements);
      refreshSelectionMap(state, elements);
      persistState(state, elements);
    });
  });

  [elements.budget, elements.startTime, elements.start].forEach((control) => {
    control?.addEventListener("change", () => persistState(state, elements));
  });

  elements.search?.addEventListener("input", () => {
    state.visibleCount = 36;
    renderPicker(state, elements);
    refreshSelectionMap(state, elements);
  });

  elements.moreButton?.addEventListener("click", () => {
    state.visibleCount += 36;
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
  elements.autoButton?.addEventListener("click", () => buildAutomaticPlan(state, elements));
  elements.buildButton?.addEventListener("click", () => buildSelectedPlan(state, elements));
  elements.clearSelection?.addEventListener("click", () => {
    state.selected = [];
    state.plan = [];
    renderSelected(state, elements);
    renderPicker(state, elements);
    refreshSelectionMap(state, elements);
    elements.result.hidden = true;
    persistState(state, elements);
  });
  elements.editButton?.addEventListener("click", () => {
    elements.pickSection?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  });
  elements.saveButton?.addEventListener("click", () => {
    persistState(state, elements);
    elements.saveButton.textContent = "บันทึกแล้ว";
    setTimeout(() => {
      elements.saveButton.textContent = "บันทึกแผน";
    }, 1600);
  });
  elements.timeline?.addEventListener("click", (event) => handleTimelineAction(event, state, elements));
  bindTimelineDrag(state, elements);
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

function renderPicker(state, elements) {
  const filtered = getFilteredItems(state, elements);
  const visible = filtered.slice(0, state.visibleCount);
  const selectedIds = new Set(state.selected);

  elements.grid.innerHTML = visible
    .map((item) => {
      const selected = selectedIds.has(item.id);
      return `
        <article class="planner-place-card${selected ? " is-selected" : ""}">
          <figure>
            <picture>
              ${item.imageMobileUrl && item.imageMobileUrl !== item.imageUrl ? `<source media="(max-width: 767px)" srcset="${escapeHtml(item.imageMobileUrl)}">` : ""}
              <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy" decoding="async">
            </picture>
            <span>${escapeHtml(item.region)}</span>
          </figure>
          <div class="planner-place-card__body">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml([item.province, item.district].filter(Boolean).join(" / "))}</p>
            </div>
            <p class="planner-place-card__blessing">${escapeHtml(item.blessings.slice(0, 2).join(" · ") || "ไหว้พระและเสริมสิริมงคล")}</p>
            <button
              type="button"
              class="${selected ? "planner-remove-button" : "planner-add-button"}"
              data-planner-toggle-place="${escapeHtml(item.id)}"
              aria-pressed="${selected}"
            >${selected ? "นำออก" : "เพิ่มในทริป"}</button>
          </div>
        </article>`;
    })
    .join("");

  elements.moreButton.hidden = filtered.length <= state.visibleCount;
  elements.empty.hidden = filtered.length > 0;
}

function renderSelected(state, elements) {
  elements.selectedCount.textContent = state.selected.length.toLocaleString("th-TH");
  if (!state.selected.length) {
    elements.selectedTray.innerHTML = "<p>ยังไม่ได้เลือกสถานที่ ระบบสามารถแนะนำให้ครบตามจำนวนได้</p>";
    return;
  }

  elements.selectedTray.innerHTML = state.selected
    .map((id, index) => {
      const item = state.itemById.get(id);
      if (!item) return "";
      return `
        <span class="planner-selected-chip">
          <b>${(index + 1).toLocaleString("th-TH")}</b>
          ${escapeHtml(item.name)}
          <button type="button" data-planner-remove-selected="${escapeHtml(id)}" aria-label="นำ ${escapeHtml(item.name)} ออกจากทริป">×</button>
        </span>`;
    })
    .join("");
}

function toggleSelection(state, elements, id, force) {
  if (!state.itemById.has(id)) return;
  const index = state.selected.indexOf(id);
  const shouldSelect = force ?? index === -1;
  if (!shouldSelect && index !== -1) state.selected.splice(index, 1);
  if (shouldSelect && index === -1) {
    const target = getTargetCount(elements);
    if (state.selected.length >= target) {
      elements.locationStatus.textContent = `เลือกได้สูงสุด ${target.toLocaleString("th-TH")} แห่งสำหรับทริปนี้`;
      return;
    }
    state.selected.push(id);
  }
  renderSelected(state, elements);
  renderPicker(state, elements);
  refreshSelectionMap(state, elements);
  persistState(state, elements);
}

function getFilteredItems(state, elements) {
  const query = normalize(elements.search?.value);
  const region = elements.region?.value || "";
  const province = elements.province?.value || "";
  const purpose = elements.purpose?.value || "";

  return state.items.filter((item) => {
    if (region && item.region !== region) return false;
    if (province && item.province !== province) return false;
    if (purpose && !item.blessings.includes(purpose)) return false;
    if (!query) return true;
    return normalize(
      `${item.name} ${item.region} ${item.province} ${item.district} ${item.blessings.join(" ")} ${item.objectHero.join(" ")}`,
    ).includes(query);
  });
}

function updateProvinceOptions(state, elements) {
  const current = elements.province.dataset.restoreValue || elements.province.value;
  const region = elements.region.value;
  const provinces = Array.from(
    new Set(state.items.filter((item) => !region || item.region === region).map((item) => item.province)),
  ).sort((left, right) => left.localeCompare(right, "th"));

  elements.province.innerHTML =
    '<option value="">ทุกจังหวัด</option>' +
    provinces.map((province) => `<option value="${escapeHtml(province)}">${escapeHtml(province)}</option>`).join("");
  elements.province.value = provinces.includes(current) ? current : "";
  delete elements.province.dataset.restoreValue;
}

function updateTargetCount(state, elements) {
  elements.targetCount.textContent = getTargetCount(elements).toLocaleString("th-TH");
}

function getTargetCount(elements) {
  return Number(elements.countInputs.find((input) => input.checked)?.value || 9);
}

function buildAutomaticPlan(state, elements) {
  const target = getTargetCount(elements);
  const candidates = getAutomaticCandidates(state, elements);
  const selectedItems = state.selected.map((id) => state.itemById.get(id)).filter(Boolean);
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  const anchor = getStartPoint(state, elements);
  const chosen = [...selectedItems];

  if (!chosen.length && candidates.length) {
    chosen.push(pickFirstCandidate(candidates, anchor, elements.purpose.value));
    selectedIds.add(chosen[0].id);
  }

  while (chosen.length < target) {
    const current = chosen.at(-1) || anchor;
    const next = candidates
      .filter((item) => !selectedIds.has(item.id))
      .map((item) => ({ item, score: automaticCandidateScore(current, item, elements.purpose.value) }))
      .sort((left, right) => left.score - right.score)[0]?.item;
    if (!next) break;
    chosen.push(next);
    selectedIds.add(next.id);
  }

  if (!chosen.length) {
    elements.locationStatus.textContent = "ไม่พบสถานที่ที่ตรงกับพื้นที่และจุดประสงค์ที่เลือก";
    return;
  }

  state.selected = chosen.map((item) => item.id);
  state.plan = optimizeOrder(chosen, anchor);
  renderSelected(state, elements);
  renderPicker(state, elements);
  refreshSelectionMap(state, elements);
  renderPlan(state, elements);
}

function buildSelectedPlan(state, elements) {
  if (!state.selected.length) {
    buildAutomaticPlan(state, elements);
    return;
  }
  const anchor = getStartPoint(state, elements);
  const items = state.selected.map((id) => state.itemById.get(id)).filter(Boolean);
  state.plan = optimizeOrder(items, anchor);
  renderPlan(state, elements);
}

function getAutomaticCandidates(state, elements) {
  const filtered = getFilteredItems(state, { ...elements, search: { value: "" } });
  if (filtered.length) return filtered;
  return state.items;
}

function pickFirstCandidate(candidates, anchor, purpose) {
  if (anchor) {
    return [...candidates].sort((left, right) => haversineKm(anchor, left) - haversineKm(anchor, right))[0];
  }
  return [...candidates].sort((left, right) => {
    const purposeDifference = Number(right.blessings.includes(purpose)) - Number(left.blessings.includes(purpose));
    return purposeDifference || left.globalRank - right.globalRank || right.globalMentions - left.globalMentions;
  })[0];
}

function automaticCandidateScore(current, item, purpose) {
  const leg = current ? estimateLeg(current, item) : { midpointMinutes: 0, directKm: 0 };
  const distancePenalty = leg.midpointMinutes > 180 ? 10000 : leg.midpointMinutes > 90 ? 900 : leg.midpointMinutes;
  const purposeBonus = purpose && item.blessings.includes(purpose) ? -45 : 0;
  const rankPenalty = Math.min(item.globalRank, 200) * 0.45;
  return distancePenalty + rankPenalty + purposeBonus + leg.directKm * 0.2;
}

function optimizeOrder(items, anchor) {
  const remaining = [...items];
  const ordered = [];
  let current = anchor;

  if (!current && remaining.length) {
    remaining.sort((left, right) => left.globalRank - right.globalRank);
    current = remaining.shift();
    ordered.push(current);
  }

  while (remaining.length) {
    const nextIndex = remaining
      .map((item, index) => ({ index, distance: haversineKm(current, item) }))
      .sort((left, right) => left.distance - right.distance)[0].index;
    const [next] = remaining.splice(nextIndex, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

function renderPlan(state, elements, options = {}) {
  if (!state.plan.length) return;
  const details = calculatePlan(state, elements);
  elements.result.hidden = false;
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

function calculatePlan(state, elements) {
  const startPoint = getStartPoint(state, elements);
  const startMinutes = parseTime(elements.startTime.value || "08:00");
  const legs = [];
  let cursor = startMinutes;
  let previous = startPoint;
  let totalTravel = 0;
  let totalVisit = 0;

  const stops = state.plan.map((item, index) => {
    const before = previous && previous.id !== item.id ? estimateLeg(previous, item) : null;
    if (before) {
      cursor += before.midpointMinutes;
      totalTravel += before.midpointMinutes;
      legs.push({ from: previous, to: item, ...before });
    }
    const arrival = cursor;
    const visitMinutes = Number(item.visitMinutes || 45);
    cursor += visitMinutes;
    totalVisit += visitMinutes;
    const nextItem = state.plan[index + 1];
    const nextLeg = nextItem ? estimateLeg(item, nextItem) : null;
    previous = item;
    return { item, arrival, departure: cursor, visitMinutes, before, nextLeg };
  });

  const totalMinutes = totalTravel + totalVisit;
  const totalRoadKm = legs.reduce((sum, leg) => sum + leg.roadKm, 0);
  const warnings = buildWarnings(legs, totalTravel, totalMinutes, Number(elements.budget.value || 600), state.plan.length);

  return { startMinutes, endMinutes: cursor, stops, legs, totalTravel, totalVisit, totalMinutes, totalRoadKm, warnings };
}

function renderSummary(details) {
  return [
    ["จำนวนสถานที่", `${details.stops.length.toLocaleString("th-TH")} แห่ง`],
    ["ระยะทางประมาณ", formatDistance(details.totalRoadKm)],
    ["เวลาเดินทาง", formatMinutes(details.totalTravel)],
    ["เวลารวมทั้งทริป", `${formatMinutes(details.totalMinutes)} · ถึงประมาณ ${formatClock(details.endMinutes)}`],
  ]
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderWarnings(details, elements) {
  if (!details.warnings.length) {
    elements.warnings.hidden = true;
    elements.warnings.innerHTML = "";
    return;
  }
  elements.warnings.hidden = false;
  elements.warnings.innerHTML = `
    <strong>ควรตรวจแผนนี้อีกครั้ง</strong>
    <ul>${details.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`;
}

function renderTimelineItem(item, index, details, totalStops) {
  const stop = details.stops[index];
  const leg = stop.nextLeg;
  const reason = item.blessings.slice(0, 2).join(" · ") || "ไหว้พระและเสริมสิริมงคล";
  const legText = leg
    ? `
      <div class="planner-timeline__leg">
        <span>ไปจุดถัดไป</span>
        <strong>${formatDistanceRange(leg)} · ${formatMinutesRange(leg)}</strong>
      </div>`
    : "";
  const startLeg = index === 0 && stop.before
    ? `<p class="planner-timeline__start-leg">จากจุดเริ่มต้นประมาณ ${formatDistanceRange(stop.before)} · ${formatMinutesRange(stop.before)}</p>`
    : "";

  return `
    <li class="planner-timeline__item" draggable="true" data-planner-stop="${escapeHtml(item.id)}">
      <div class="planner-timeline__rail">
        <span>${(index + 1).toLocaleString("th-TH")}</span>
      </div>
      <article>
        <div class="planner-timeline__time">
          <span>คาดว่าจะถึง</span>
          <strong>${formatClock(stop.arrival)}</strong>
        </div>
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy" decoding="async">
        <div class="planner-timeline__copy">
          <span>${escapeHtml(item.region)} · ${escapeHtml(item.province)}</span>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(reason)}</p>
          ${startLeg}
          <div class="planner-timeline__meta">
            <span>ใช้เวลาประมาณ ${formatMinutes(stop.visitMinutes)}</span>
            <span>ออกประมาณ ${formatClock(stop.departure)}</span>
          </div>
          <div class="planner-timeline__links">
            <a href="${escapeHtml(item.detailUrl)}">ดูรายละเอียด</a>
            <a href="${buildSingleMapUrl(item)}" target="_blank" rel="noopener">เปิดพิกัด</a>
          </div>
        </div>
        <div class="planner-timeline__controls" aria-label="จัดลำดับ ${escapeHtml(item.name)}">
          <button type="button" data-planner-move="up" aria-label="เลื่อนขึ้น" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-planner-move="down" aria-label="เลื่อนลง" ${index === totalStops - 1 ? "disabled" : ""}>↓</button>
          <button type="button" data-planner-replace aria-label="เปลี่ยนสถานที่">เปลี่ยน</button>
        </div>
        ${legText}
      </article>
    </li>`;
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
    renderSelected(state, elements);
    renderPlan(state, elements, { scroll: false });
    return;
  }
  if (event.target.closest("[data-planner-replace]")) {
    const [removed] = state.plan.splice(index, 1);
    state.selected = state.plan.map((item) => item.id);
    renderSelected(state, elements);
    renderPicker(state, elements);
    refreshSelectionMap(state, elements);
    elements.result.hidden = true;
    elements.locationStatus.textContent = `นำ ${removed.name} ออกจากทริปแล้ว เลือกสถานที่ใหม่ได้เลย`;
    elements.pickSection?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }
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
    renderSelected(state, elements);
    renderPlan(state, elements, { scroll: false });
  });
}

function buildWarnings(legs, totalTravel, totalMinutes, budget, stopCount) {
  const warnings = [];
  const longLegs = legs.filter((leg) => leg.midpointMinutes > 90);
  const veryLongLegs = legs.filter((leg) => leg.midpointMinutes > 180);
  if (veryLongLegs.length) warnings.push(`มี ${veryLongLegs.length.toLocaleString("th-TH")} ช่วงที่ใช้เวลาเกิน 3 ชั่วโมง เหมาะกับการแยกวันมากกว่า`);
  else if (longLegs.length) warnings.push(`มี ${longLegs.length.toLocaleString("th-TH")} ช่วงที่ใช้เวลาเกิน 1 ชั่วโมง 30 นาที`);
  if (totalTravel > 240) warnings.push("เวลาเดินทางรวมเกิน 4 ชั่วโมง ควรลดจำนวนสถานที่หรือจำกัดพื้นที่ให้แคบลง");
  if (totalMinutes > budget) warnings.push(`แผนยาวกว่าเวลาที่เลือกประมาณ ${formatMinutes(totalMinutes - budget)}`);
  if (stopCount < 3) warnings.push("จำนวนสถานที่น้อยกว่า 3 แห่ง ลองขยายพื้นที่หรือลดตัวกรอง");
  return warnings;
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
  return state.itemById.get(elements.start.value) || null;
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
      elements.locationStatus.textContent = `ใช้ตำแหน่งปัจจุบันแล้ว ความแม่นยำประมาณ ${Math.round(position.coords.accuracy).toLocaleString("th-TH")} เมตร`;
      elements.locationButton.disabled = false;
    },
    () => {
      elements.locationStatus.textContent = "ไม่สามารถอ่านตำแหน่งได้ เลือกสถานที่เริ่มต้นจากรายการแทนได้";
      elements.locationButton.disabled = false;
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

function refreshSelectionMap(state, elements) {
  if (!state.selectionMap || !state.selectionCluster) return;
  const filteredIds = new Set(getFilteredItems(state, elements).map((item) => item.id));
  state.selectionCluster.clearLayers();
  state.selectionMarkers.forEach((marker, id) => {
    if (!filteredIds.has(id)) return;
    updateSelectionMarker(marker, state.selected.indexOf(id));
    state.selectionCluster.addLayer(marker);
  });
  if (state.selectionCluster.getLayers().length) {
    state.selectionMap.fitBounds(state.selectionCluster.getBounds(), { padding: [30, 30], maxZoom: 13 });
  }
}

async function ensureSelectionMap(state, elements) {
  if (state.selectionMap || !elements.selectionMap) {
    state.selectionMap?.invalidateSize();
    return;
  }
  await ensureLeaflet();
  const map = window.L.map(elements.selectionMap, { minZoom: 5, maxZoom: 18, scrollWheelZoom: true }).setView([13.7563, 100.5018], 6);
  addTiles(map);
  const cluster = window.L.markerClusterGroup({ maxClusterRadius: 48, showCoverageOnHover: false });
  state.items.forEach((item) => {
    const marker = window.L.marker([item.latitude, item.longitude], {
      icon: createSelectionIcon(state.selected.indexOf(item.id)),
    });
    marker._plannerItem = item;
    marker.bindPopup(renderSelectionPopup(item, state.selected.includes(item.id)), { minWidth: 230, maxWidth: 280 });
    marker.on("popupopen", (event) => {
      const popup = event.popup.getElement();
      popup?.querySelector("[data-planner-map-toggle]")?.addEventListener("click", () => {
        toggleSelection(state, elements, item.id);
        marker.setPopupContent(renderSelectionPopup(item, state.selected.includes(item.id)));
        marker.openPopup();
      });
    });
    state.selectionMarkers.set(item.id, marker);
    cluster.addLayer(marker);
  });
  cluster.addTo(map);
  map.fitBounds(cluster.getBounds(), { padding: [30, 30], maxZoom: 7 });
  state.selectionMap = map;
  state.selectionCluster = cluster;
  elements.selectionMap._plannerContext = { state, elements };
  refreshSelectionMap(state, elements);
}

function updateSelectionMarker(marker, selectedIndex) {
  marker.setIcon(createSelectionIcon(selectedIndex));
  marker.setPopupContent(renderSelectionPopup(marker._plannerItem, selectedIndex >= 0));
}

function createSelectionIcon(selectedIndex) {
  const selected = selectedIndex >= 0;
  return window.L.divIcon({
    className: `planner-leaflet-marker${selected ? " is-selected" : ""}`,
    html: `<span>${selected ? (selectedIndex + 1).toLocaleString("th-TH") : ""}</span>`,
    iconSize: selected ? [38, 38] : [28, 28],
    iconAnchor: selected ? [19, 19] : [14, 14],
    popupAnchor: [0, selected ? -20 : -15],
  });
}

function renderSelectionPopup(item, selected) {
  return `
    <article class="planner-map-popup">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml([item.province, item.district].filter(Boolean).join(" / "))}</span>
      <p>${escapeHtml(item.blessings.slice(0, 2).join(" · ") || "ไหว้พระและเสริมสิริมงคล")}</p>
      <button type="button" data-planner-map-toggle>${selected ? "นำออกจากทริป" : "เพิ่มในทริป"}</button>
    </article>`;
}

function renderRouteMap(state, elements) {
  if (!window.L || !elements.routeMap || !state.plan.length) return;
  if (!state.routeMap) {
    state.routeMap = window.L.map(elements.routeMap, { minZoom: 5, maxZoom: 18, scrollWheelZoom: true }).setView([13.7563, 100.5018], 6);
    addTiles(state.routeMap);
  }
  if (state.routeLayer) state.routeLayer.remove();
  const group = window.L.layerGroup();
  const coordinates = state.plan.map((item) => [item.latitude, item.longitude]);
  state.plan.forEach((item, index) => {
    window.L.marker([item.latitude, item.longitude], { icon: createSelectionIcon(index) })
      .bindPopup(`<strong>${(index + 1).toLocaleString("th-TH")}. ${escapeHtml(item.name)}</strong>`)
      .addTo(group);
  });
  window.L.polyline(coordinates, { color: "#8e2d24", weight: 4, opacity: 0.78, dashArray: "8 10" }).addTo(group);
  group.addTo(state.routeMap);
  state.routeLayer = group;
  setTimeout(() => {
    state.routeMap.invalidateSize();
    state.routeMap.fitBounds(window.L.latLngBounds(coordinates), { padding: [36, 36], maxZoom: 13 });
  }, 40);
}

function addTiles(map) {
  window.L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ",
      maxZoom: 18,
    },
  ).addTo(map);
}

let leafletPromise;
function ensureLeaflet() {
  if (window.L?.markerClusterGroup) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  const styles = [
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
  ];
  const scripts = [
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
  ];
  leafletPromise = Promise.all([
    ...styles.map(loadStylesheet),
    scripts.reduce((promise, src) => promise.then(() => loadScript(src)), Promise.resolve()),
  ]).then(() => {
    if (!window.L?.markerClusterGroup) throw new Error("Leaflet failed to initialize");
  });
  return leafletPromise;
}

function loadStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) {
    if (src.includes("markercluster") ? window.L?.markerClusterGroup : window.L) return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function buildGoogleMapsUrl(state, elements) {
  const plan = state.plan;
  if (!plan.length) return "#";
  const start = getStartPoint(state, elements);
  const origin = start || plan[0];
  const destination = plan.at(-1);
  const waypointItems = start ? plan.slice(0, -1) : plan.slice(1, -1);
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

function persistState(state, elements) {
  try {
    localStorage.setItem(
      "mongkolwela.templePlanner.v1",
      JSON.stringify({
        selected: state.selected,
        plan: state.plan.map((item) => item.id),
        count: getTargetCount(elements),
        budget: elements.budget.value,
        startTime: elements.startTime.value,
        region: elements.region.value,
        province: elements.province.value,
        purpose: elements.purpose.value,
        start: elements.start.value,
      }),
    );
  } catch {}
}

function restoreState(state, elements) {
  try {
    const saved = JSON.parse(localStorage.getItem("mongkolwela.templePlanner.v1") || "{}");
    const countInput = elements.countInputs.find((input) => Number(input.value) === Number(saved.count));
    if (countInput) countInput.checked = true;
    if (saved.budget) elements.budget.value = saved.budget;
    if (saved.startTime) elements.startTime.value = saved.startTime;
    if (saved.region) elements.region.value = saved.region;
    if (saved.purpose) elements.purpose.value = saved.purpose;
    if (saved.start && state.itemById.has(saved.start)) elements.start.value = saved.start;
    elements.province.dataset.restoreValue = saved.province || "";
    state.selected = (saved.selected || []).filter((id) => state.itemById.has(id)).slice(0, getTargetCount(elements));
    state.plan = (saved.plan || []).map((id) => state.itemById.get(id)).filter(Boolean);
  } catch {}
}

function parseTime(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 8) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function formatClock(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} น.`;
}

function formatMinutes(minutes) {
  const rounded = Math.max(0, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (!hours) return `${remainder.toLocaleString("th-TH")} นาที`;
  if (!remainder) return `${hours.toLocaleString("th-TH")} ชม.`;
  return `${hours.toLocaleString("th-TH")} ชม. ${remainder.toLocaleString("th-TH")} นาที`;
}

function formatMinutesRange(leg) {
  return `${formatMinutes(leg.lowMinutes)}–${formatMinutes(leg.highMinutes)}`;
}

function formatDistance(kilometers) {
  if (kilometers < 1) return `${Math.round(kilometers * 1000).toLocaleString("th-TH")} ม.`;
  return `${kilometers.toLocaleString("th-TH", { maximumFractionDigits: kilometers < 10 ? 1 : 0 })} กม.`;
}

function formatDistanceRange(leg) {
  return `${formatDistance(leg.lowKm)}–${formatDistance(leg.highKm)}`;
}

function normalize(value) {
  return String(value || "").normalize("NFC").trim().toLocaleLowerCase("th");
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
