export function createPlannerStorage({ getTargetCount }) {
function persistState(state, elements) {
  try {
    localStorage.setItem(
      "mongkolwela.templePlanner.v1",
      JSON.stringify({
        selected: state.selected,
        plan: state.plan.map((item) => item.id),
        count: getTargetCount(elements),
        budget: elements.budget.value,
        startDate: elements.startDate?.value,
        startTime: elements.startTime.value,
        radius: elements.radius?.value,
        regions: [...state.activeRegions],
        provinces: [...state.activeProvinces],
        purposes: [...state.activePurposes],
        start: elements.start.value,
        originText: elements.originText?.value || "",
        tripCriteria: state.tripCriteria,
        manualSelectionOrder: state.manualSelectionOrder,
        workspace: { view: state.view, query: elements.pickerSearch?.value || "", trayExpanded: state.trayExpanded, visibleCount: state.visibleCount },
      }),
    );
    return true;
  } catch { return false; }
}

function restoreState(state, elements) {
  try {
    const saved = JSON.parse(localStorage.getItem("mongkolwela.templePlanner.v1") || "{}");
    const countInput = elements.countInputs.find((input) => Number(input.value) === Number(saved.count));
    if (countInput) countInput.checked = true;
    if (saved.budget) elements.budget.value = saved.budget;
    if (saved.startDate && elements.startDate) elements.startDate.value = saved.startDate;
    if (saved.startTime) elements.startTime.value = saved.startTime;
    if ("radius" in saved && elements.radius) elements.radius.value = saved.radius ?? "100";
    if (saved.regions || saved.region) state.activeRegions = new Set(saved.regions || [saved.region]);
    if (saved.purposes || saved.purpose) state.activePurposes = new Set(saved.purposes || [saved.purpose]);
    if (saved.start && state.itemById.has(saved.start)) elements.start.value = saved.start;
    if (saved.originText && elements.originText) elements.originText.value = saved.originText;
    if (saved.provinces || saved.province) state.activeProvinces = new Set(saved.provinces || [saved.province]);
    state.selected = [...new Set(saved.selected || [])].filter((id) => state.itemById.has(id));
    state.plan = (saved.plan || []).map((id) => state.itemById.get(id)).filter(Boolean);
    state.manualSelectionOrder = Boolean(saved.manualSelectionOrder);
    if (saved.tripCriteria) state.tripCriteria = saved.tripCriteria;
    return saved;
  } catch {
    return {};
  }
}

return { persistState, restoreState };
}
