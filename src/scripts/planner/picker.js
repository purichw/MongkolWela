export function createPlannerPicker({ getPickerItems, getStartPoint, renderPickerContext, haversineKm, formatDistance, getPickerRecommendationText, escapeHtml, prefersReducedMotion }) {
function renderPicker(state, elements) {
  const filtered = getPickerItems(state, elements);
  const visible = filtered.slice(0, state.visibleCount);
  const selectedIds = new Set(state.selected);
  const origin = getStartPoint(state, elements);
  const previousVisibleIds = new Set(
    [...elements.grid.querySelectorAll("[data-planner-place-card]")].map((card) => card.dataset.plannerPlaceCard),
  );

  renderPickerContext(state, elements, filtered.length);
  elements.grid.innerHTML = visible
    .map((item) => {
      const selected = selectedIds.has(item.id);
      const distance = origin ? haversineKm(origin, item) : null;
      const distanceBadge = Number.isFinite(distance)
        ? `<span class="planner-place-card__distance">${formatDistance(distance)}</span>`
        : "";
      const recommendation = getPickerRecommendationText(state, elements, item);
      return `
        <article class="planner-place-card${selected ? " is-selected" : ""}" data-planner-place-card="${escapeHtml(item.id)}">
          <figure>
            <picture>
              ${item.imageMobileUrl && item.imageMobileUrl !== item.imageUrl ? `<source media="(max-width: 767px)" srcset="${escapeHtml(item.imageMobileUrl)}">` : ""}
              <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy" decoding="async">
            </picture>
            <span>${escapeHtml(item.region)}</span>
            ${distanceBadge}
          </figure>
          <div class="planner-place-card__body">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml([item.province, item.district].filter(Boolean).join(" / "))}</p>
            </div>
            <p class="planner-place-card__blessing">${escapeHtml(item.blessings.slice(0, 2).join(" · ") || "ไหว้พระและเสริมสิริมงคล")}</p>
            ${recommendation ? `<p class="planner-place-card__reason">${escapeHtml(recommendation)}</p>` : ""}
            <button
              type="button"
              class="${selected ? "planner-remove-button" : "planner-add-button"}"
              data-planner-toggle-place="${escapeHtml(item.id)}"
              aria-pressed="${selected}"
            >${selected ? "อยู่ในแผน" : "เพิ่มลงแผน"}</button>
          </div>
        </article>`;
    })
    .join("");

  revealPlannerPlaceCards(elements, previousVisibleIds);
  elements.moreButton.hidden = filtered.length <= state.visibleCount;
  elements.empty.hidden = filtered.length > 0;
}

function revealPlannerPlaceCards(elements, previousVisibleIds) {
  const cards = [...elements.grid.querySelectorAll("[data-planner-place-card]")];
  const revealCards = [];

  cards.forEach((card) => {
    const wasVisible = previousVisibleIds.has(card.dataset.plannerPlaceCard);
    if (wasVisible) {
      card.classList.add("is-revealed");
      return;
    }
    revealCards.push(card);
  });

  queuePlannerCardReveal(revealCards);
}

function queuePlannerCardReveal(revealCards) {
  if (!revealCards.length) return;

  if (prefersReducedMotion()) {
    revealCards.forEach((card) => {
      card.classList.add("is-revealed");
    });
    return;
  }

  revealCards.forEach((card) => {
    card.classList.add("is-reveal-ready");
    card.classList.remove("is-revealed");
  });

  window.requestAnimationFrame(() => {
    assignPlannerRevealDelays(revealCards);
    window.requestAnimationFrame(() => {
      revealCards.forEach((card) => {
        card.classList.add("is-revealed");
      });
    });
  });
}

function assignPlannerRevealDelays(revealCards) {
  const sortedCards = [...revealCards].sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    if (Math.abs(aRect.top - bRect.top) > 8) return aRect.top - bRect.top;
    return aRect.left - bRect.left;
  });
  let rowTop = null;
  let rowIndex = -1;
  let columnIndex = 0;

  sortedCards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    if (rowTop === null || Math.abs(rect.top - rowTop) > 8) {
      rowTop = rect.top;
      rowIndex += 1;
      columnIndex = 0;
    }

    const delay = rowIndex * 120 + columnIndex * 24;
    card.style.setProperty("--planner-card-reveal-delay", `${delay}ms`);
    columnIndex += 1;
  });
}

function renderSelected(state, elements) {
  elements.selectedCount.textContent = state.selected.length.toLocaleString("th-TH");
  elements.selectedTray.classList.toggle("is-empty", !state.selected.length);
  if (!state.selected.length) {
    elements.selectedTray.innerHTML = "<p>ยังไม่ได้เลือกสถานที่ ระบบสามารถแนะนำให้ครบตามจำนวนที่กำหนดได้</p>";
    return;
  }

  elements.selectedTray.innerHTML = state.selected
    .map((id, index) => {
      const item = state.itemById.get(id);
      if (!item) return "";
      return `
        <span class="planner-selected-chip" draggable="true" data-planner-selected-id="${escapeHtml(id)}">
          <b>${(index + 1).toLocaleString("th-TH")}</b>
          <span class="planner-selected-chip__label">${escapeHtml(item.name)}</span>
          <button type="button" draggable="false" data-planner-remove-selected="${escapeHtml(id)}" aria-label="นำ ${escapeHtml(item.name)} ออกจากแผน">×</button>
        </span>`;
    })
    .join("");
}

return { renderPicker, revealPlannerPlaceCards, queuePlannerCardReveal, assignPlannerRevealDelays, renderSelected };
}
