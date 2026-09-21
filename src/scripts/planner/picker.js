import { renderIcon } from "../../lib/ui-markup.js";
import { renderPlannerPlaceCard } from "./place-card.js";

export function createPlannerPicker({ getPickerItems, renderPickerContext, escapeHtml, prefersReducedMotion }) {
  function renderPicker(state, elements) {
    const filtered = getPickerItems(state, elements);
    const before = new Set([...elements.grid.children].map(node => node.dataset.plannerPlaceCard));
    const target = Number(elements.countInputs.find(input => input.checked)?.value || 3);
    renderPickerContext(state, elements, filtered.length);
    elements.grid.innerHTML = filtered.slice(0, state.visibleCount).map(item => {
      const selected = state.selected.includes(item.id);
      return renderPlannerPlaceCard(item, { selected, disabled: !selected && state.selected.length >= target && !state.replacement });
    }).join("");
    for (const card of elements.grid.children) {
      if (!before.has(card.dataset.plannerPlaceCard) && !prefersReducedMotion()) card.classList.add("is-new");
    }
    elements.moreButton.hidden = filtered.length <= state.visibleCount;
    elements.empty.hidden = filtered.length > 0;
  }

  function renderSelected(state, elements) {
    elements.selectedCount.textContent = state.selected.length;
    const ids = state.trayExpanded ? state.selected : state.selected.slice(0,3);
    elements.selectedTray.dataset.expanded = String(state.trayExpanded);
    elements.selectedTray.innerHTML = ids.map((id, index) => {
      const item = state.itemById.get(id);
      if (!item) return "";
      const name = escapeHtml(item.name), safeId = escapeHtml(id);
      const move = (direction, label, disabled) => '<button type="button" data-planner-move-selected="' + direction + '" data-planner-id="' + safeId + '" aria-label="' + label + ' ' + name + '" title="' + label + '" ' + (disabled ? "disabled" : "") + '>' + renderIcon(direction < 0 ? "arrow-left" : "arrow-right", "planner-order-icon") + '</button>';
      return `<div class="planner-selected-chip" data-planner-selected-id="${safeId}"><b>${index + 1}</b><span class="planner-selected-chip__label" title="${name}">${name}${state.outsideIds?.includes(id) ? '<small>นอกตัวกรองปัจจุบัน</small>' : ""}</span>
      ${state.trayExpanded ? move(-1, "เลื่อนขึ้น", index === 0) + move(1, "เลื่อนลง", index === state.selected.length - 1) : ""}
      <button type="button" data-planner-remove-selected="${safeId}" aria-label="นำ ${name} ออกจากรายการที่เลือก" title="นำออก">${renderIcon("x")}</button></div>`;
    }).join("");
  }
  return { renderPicker, renderSelected };
}
