import { thaiMonthNames, toIsoDate, weekdayNames } from "./thai-calendar-core.js";
import { renderIconMedallion } from "../lib/ui-markup.js";
import { syncPublicSelects } from "./public-select.js";
import { calendarUrl, createCalendarStore, eventTypes, getImportantDays, getPeriodSummary, monthShortNames, readCalendarState, shiftMonth } from "./calendar-view-model.js";

export function mountCalendar(root) {
  const yearSelect = root.querySelector("[data-calendar-year]");
  const summary = root.querySelector("[data-calendar-summary]");
  const workspace = root.querySelector("[data-calendar-workspace]");
  const overview = root.querySelector("[data-calendar-overview]");
  const status = root.querySelector("[data-calendar-status]");
  const guide = root.querySelector("[data-calendar-guide]");
  const symbols = Object.fromEntries([...root.querySelectorAll("template[data-calendar-symbol]")].map(template => [template.dataset.calendarSymbol, template.innerHTML]));
  let monthExpanded = false;
  let yearExpanded = false;
  const mobile = window.matchMedia("(max-width: 600px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const store = createCalendarStore();
  let state = readCalendarState(location.href);
  let selectedIso = history.state?.calendarSelectedDate || "";
  let renderVersion = 0;
  let renderedToday = "";
  const initialAnchor = /^#month-\d+$/.test(location.hash);

  function updateControls() {
    yearSelect.value = String(state.year);
    root.querySelector("[data-calendar-view]").value = state.view;
    syncPublicSelects(root);
    root.dataset.view = state.view;
    root.querySelector("[data-calendar-title]").textContent = `ปฏิทินไทย พ.ศ. ${state.year}`;
    root.querySelector("[data-calendar-today]").href = `/calendar/day/?date=${toIsoDate(new Date())}`;
    for (const button of root.querySelectorAll("[data-month]")) button.setAttribute("aria-pressed", String(Number(button.dataset.month) === state.month));
    for (const button of root.querySelectorAll(".cal-view-switch [data-view]")) button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
    const nav = root.querySelector("[data-calendar-months]");
    const activeMonth = nav.querySelector('[aria-pressed="true"]');
    if (activeMonth) nav.scrollLeft += activeMonth.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - activeMonth.offsetWidth) / 2;
    document.title = `${thaiMonthNames[state.month - 1]} ${state.year} | ปฏิทินไทย มงคลเวลา`;
  }

  function focusWorkspace() {
    const target = state.view === "events" ? root.querySelector(`#cal-events-${state.month}`) : root.querySelector("#cal-month-title");
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "instant" : "smooth" });
  }

  async function render({ focus = false } = {}) {
    const version = ++renderVersion;
    const focusKey = document.activeElement?.getAttribute("data-focus-key");
    root.dataset.state = "loading";
    workspace.setAttribute("aria-busy", "true");
    summary.setAttribute("aria-busy", "true");
    updateControls();
    // Let the loading shell paint before calculating a distant year.
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (version !== renderVersion) return;
    try {
      const now = new Date();
      renderedToday = toIsoDate(now);
      const year = store.getYear(state.year);
      const month = year.months[state.month - 1];
      if (!month.days.some(day => day.iso === selectedIso)) selectedIso = "";
      summary.innerHTML = renderSummaries(month, getPeriodSummary(store, state, now), symbols);
      summary.hidden = state.view === "events";
      // Keep CMS-owned media in the DOM even while the events view replaces the rail.
      if (guide) { guide.hidden = true; overview.after(guide); }
      workspace.innerHTML = state.view === "events" ? renderEvents(year, state) : renderMonthWorkspace(month, state, selectedIso, renderedToday, mobile.matches, symbols, monthExpanded);
      const guideSlot = workspace.querySelector("[data-calendar-guide-slot]");
      if (guideSlot && guide) { guideSlot.replaceWith(guide); guide.hidden = false; }
      overview.innerHTML = renderYearOverview(year, state, yearExpanded);
      overview.hidden = false;
      root.dataset.state = "ready";
      status.textContent = `${month.name} ${state.year} · ${state.view === "events" ? "รายการวันสำคัญทั้งปี" : state.view === "month" ? "มุมมองรายเดือน" : "ภาพรวม"}`;
      if (focus) focusWorkspace();
      else if (focusKey) root.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
    } catch (error) {
      root.dataset.state = "error";
      summary.hidden = true;
      overview.hidden = true;
      workspace.innerHTML = `<div class="cal-error" role="alert"><h2>ไม่สามารถแสดงข้อมูลปฏิทินช่วงนี้ได้ในขณะนี้</h2><p>${thaiMonthNames[state.month - 1]} ${state.year}</p><div><button type="button" class="cal-button" data-calendar-retry>ลองอีกครั้ง</button><button type="button" class="cal-button cal-button-secondary" data-current-month>กลับไปเดือนปัจจุบัน</button></div></div>`;
      status.textContent = "ไม่สามารถแสดงข้อมูลปฏิทินได้";
      console.warn("Calendar calculation unavailable", error);
    } finally {
      workspace.setAttribute("aria-busy", "false");
      summary.setAttribute("aria-busy", "false");
    }
  }

  function navigate(next, { focus = false, replace = false } = {}) {
    if (!next) return;
    state = next;
    monthExpanded = false;
    history[replace ? "replaceState" : "pushState"](null, "", calendarUrl(location.href, state));
    render({ focus });
  }

  yearSelect.addEventListener("change", () => navigate({ ...state, year: Number(yearSelect.value) }));
  root.querySelector("[data-calendar-view]").addEventListener("change", event => navigate({ ...state, view: event.target.value }));
  root.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;
    const expand = event.target.closest("[data-expand-month]");
    if (expand) {
      monthExpanded = !monthExpanded;
      expand.closest(".cal-month-panel").dataset.expanded = String(monthExpanded);
      expand.setAttribute("aria-expanded", String(monthExpanded));
      expand.querySelector("span").textContent = monthExpanded ? "แสดงปฏิทินแบบย่อ" : "ดูปฏิทินเดือนนี้ทั้งหมด";
      return;
    }
    const expandYear = event.target.closest("[data-expand-year]");
    if (expandYear) {
      yearExpanded = !yearExpanded;
      overview.classList.toggle("is-expanded", yearExpanded);
      expandYear.setAttribute("aria-expanded", String(yearExpanded));
      expandYear.textContent = yearExpanded ? "ย่อรายการ" : "ดูทั้งหมด";
      return;
    }
    const monthButton = event.target.closest("[data-month]");
    if (monthButton) {
      navigate({ ...state, month: Number(monthButton.dataset.month) }, { focus: Boolean(monthButton.dataset.monthTile) || state.view === "events" });
      return;
    }
    const viewButton = event.target.closest("button[data-view]");
    if (viewButton) {
      navigate({ ...state, view: viewButton.dataset.view }, { focus: Boolean(viewButton.dataset.focusWorkspace) });
      return;
    }
    const step = event.target.closest("[data-month-step]");
    if (step) { navigate(shiftMonth(state, Number(step.dataset.monthStep))); return; }
    const dayLink = event.target.closest("a.cal-day");
    if (dayLink && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
      // Keep the last opened date when returning, without intercepting native links.
      selectedIso = dayLink.dataset.date;
      history.replaceState({ ...history.state, calendarSelectedDate: selectedIso }, "");
      for (const link of root.querySelectorAll("a.cal-day")) link.classList.toggle("is-selected", mobile.matches && link.dataset.date === selectedIso);
      return;
    }
    if (event.target.closest("[data-calendar-retry]")) { store.invalidate(state.year); render({ focus: true }); }
    if (event.target.closest("[data-current-month]")) { selectedIso = ""; navigate(readCalendarState("/calendar/"), { focus: true }); }
  });

  window.addEventListener("popstate", () => { state = readCalendarState(location.href); selectedIso = history.state?.calendarSelectedDate || ""; render(); });
  window.addEventListener("hashchange", () => {
    if (!/^#month-\d+$/.test(location.hash)) return;
    const legacy = new URL(location.href);
    legacy.searchParams.delete("month");
    navigate(readCalendarState(legacy.href), { replace: true, focus: true });
  });
  mobile.addEventListener("change", () => render());
  document.addEventListener("visibilitychange", () => { if (!document.hidden && renderedToday !== toIsoDate(new Date())) render(); });
  window.addEventListener("pageshow", () => { if (renderedToday && renderedToday !== toIsoDate(new Date())) render(); });

  const header = document.querySelector(".site-header");
  const toolbar = root.querySelector("[data-calendar-toolbar]");
  const resizeObserver = new ResizeObserver(() => {
    root.style.setProperty("--cal-header-height", `${Math.ceil(header?.getBoundingClientRect().height || 0)}px`);
    root.style.setProperty("--cal-toolbar-height", `${Math.ceil(toolbar.getBoundingClientRect().height)}px`);
  });
  if (header) resizeObserver.observe(header);
  resizeObserver.observe(toolbar);
  history.replaceState(history.state, "", calendarUrl(location.href, state));
  render({ focus: initialAnchor || state.view === "events" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function badge(event, extraClass = "") {
  const category = eventTypes[event.type];
  return `<span class="cal-badge is-${event.type} ${extraClass}" title="${escapeHtml(`${category.label}: ${event.label}`)}"><span class="cal-event-symbol" aria-hidden="true">${category.symbol}</span><span class="cal-badge-label">${escapeHtml(event.label)}</span></span>`;
}

function renderLegend(month) {
  const present = new Set(month.days.flatMap(day => day.events.map(event => event.type)));
  return Object.entries(eventTypes).filter(([key]) => present.has(key)).map(([key, value]) => badge({ type: key, label: value.label })).join("");
}

function renderSummaries(month, period, symbols) {
  const { holyDay, importantDay, currentPeriod } = period;
  const importantEvents = importantDay?.events.filter(event => !event.belief && event.type !== "holy-day") || [];
  const shortDate = day => `${day.weekdayName} ${day.day} ${monthShortNames[day.date.getMonth()]} ${day.beYear}`;
  const media = name => renderIconMedallion(symbols[name], "cal-summary-symbol");
  const card = (label, value, secondary, icon, href, extra = "") => {
    const tag = href ? "a" : "div";
    return `<${tag} class="cal-summary-card ${extra}" ${href ? `href="${href}"` : ""}>${icon}<div class="cal-summary-copy"><p>${label}</p><strong>${escapeHtml(value)}</strong><small>${escapeHtml(secondary)}</small></div>${href ? '<span class="cal-summary-arrow" aria-hidden="true">→</span>' : ""}</${tag}>`;
  };
  return [
    card(currentPeriod ? "วันพระถัดไป" : "วันพระในเดือนนี้", holyDay ? shortDate(holyDay) : "ยังไม่พบวันพระ", holyDay ? `${holyDay.lunarShort} เดือน ${holyDay.lunar.month}` : "", media("lotus"), holyDay?.href, "cal-summary-holy"),
    card(currentPeriod ? "วันสำคัญใกล้ถึง" : "วันสำคัญในเดือนนี้", importantEvents[0]?.label || "ยังไม่พบวันสำคัญ", importantDay ? `${shortDate(importantDay)}${importantEvents.length > 1 ? ` · +${importantEvents.length - 1} รายการ` : ""}` : "", media("stupa"), importantDay?.href),
    card("เดือนที่กำลังดู", `${month.name} ${month.year}`, `ค.ศ. ${month.year - 543} · ${month.days.length} วัน`, media("calendar-days"), null, "cal-summary-month"),
    `<div class="cal-summary-card cal-legend"><p>ความหมายสี / ป้ายกำกับ</p><div>${renderLegend(month)}</div></div>`,
  ].join("");
}

function renderMonthWorkspace(month, state, selectedIso, today, mobile, symbols, expanded) {
  const previous = shiftMonth(state, -1);
  const next = shiftMonth(state, 1);
  const stepButton = (target, direction, glyph, key) => {
    const label = target ? `${direction < 0 ? "เดือนก่อนหน้า" : "เดือนถัดไป"} ${thaiMonthNames[target.month - 1]} ${target.year}` : "สิ้นสุดช่วงปีที่รองรับ";
    return `<button type="button" class="cal-icon-button" data-focus-key="${key}" data-month-step="${direction}" ${target ? "" : "disabled"} title="${label}" aria-label="${label}">${glyph}</button>`;
  };
  const rows = [];
  const focusWeek = Math.floor(month.cells.findIndex(day => day?.iso === (selectedIso || today)) / 7);
  const previewStart = Math.max(0, Math.min(focusWeek - 1, month.cells.length / 7 - 3));
  for (let i = 0; i < month.cells.length; i += 7) {
    const week = i / 7;
    rows.push(`<tr${week < previewStart || week >= previewStart + 3 ? ' class="cal-week-overflow"' : ""}>${month.cells.slice(i, i + 7).map((day, offset) => {
      const neighbor = new Date(state.year - 543, state.month - 1, i + offset - month.cells.findIndex(Boolean) + 1);
      return `<td${day ? "" : ' class="cal-empty-cell"'}>${day ? renderDay(day, selectedIso, today, mobile) : `<span class="cal-neighbor-day" aria-hidden="true">${neighbor.getDate()}</span>`}</td>`;
    }).join("")}</tr>`);
  }
  const shortWeekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const days = getImportantDays(month);
  return `<div class="cal-month-panel" data-expanded="${expanded}">
    <header class="cal-month-heading"><div class="cal-month-arrows">${stepButton(previous, -1, symbols["chevron-left"], "previous-month")}${stepButton(next, 1, symbols["chevron-right"], "next-month")}</div>
      <div><h2 id="cal-month-title" tabindex="-1">${month.name} ${month.year}</h2><p>ค.ศ. ${month.year - 543} · ${month.days.length} วัน</p></div>
      <button type="button" class="cal-text-action cal-month-events" data-view="events" data-focus-workspace="true">ดูรายละเอียดเดือนนี้ ${symbols["arrow-right"]}</button>
    </header>
    <table class="cal-month-table" id="cal-month-table" aria-labelledby="cal-month-title"><thead><tr>${weekdayNames.map((name, i) => `<th scope="col"><span class="cal-weekday-full">${name}</span><abbr class="cal-weekday-short" title="${name}">${shortWeekdays[i]}</abbr></th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>
    <button type="button" class="cal-expand-month" data-expand-month aria-controls="cal-month-table" aria-expanded="${expanded}"><span>${expanded ? "แสดงปฏิทินแบบย่อ" : "ดูปฏิทินเดือนนี้ทั้งหมด"}</span>${symbols["arrow-right"]}</button>
  </div>
  <aside class="cal-context" aria-label="ข้อมูลประกอบเดือน"><section class="cal-important-panel">
    <header class="cal-rail-heading"><h2>วันสำคัญเดือน${month.name} ${month.year}</h2><button class="cal-text-action" type="button" data-view="events" data-focus-workspace="true">ดูทั้งหมด <span aria-hidden="true">→</span></button></header>
    ${days.length ? `<ul class="cal-event-list">${days.slice(0, 5).map(day => renderEventRow(day)).join("")}</ul>` : '<p class="cal-empty-copy">ยังไม่พบวันสำคัญในข้อมูลเดือนนี้</p>'}
  </section><div data-calendar-guide-slot></div>${renderDataNote()}</aside>`;
}

function renderDay(day, selectedIso, today, mobile) {
  const isToday = day.iso === today;
  const selected = day.iso === selectedIso;
  const events = day.events;
  const label = `${day.weekdayName} ${day.fullDate} ${day.lunarLabel}${events.length ? ` · ${events.map(event => event.label).join(" · ")}` : ""}${isToday ? " · วันนี้" : ""}${mobile && selected ? " · วันที่เปิดล่าสุด" : ""}`;
  const compactLabel = type => ({ favorable: "เกื้อหนุน", caution: "ควรระวัง" })[type] || eventTypes[type].label;
  return `<a class="cal-day${isToday ? " is-today" : ""}${mobile && selected ? " is-selected" : ""}${day.isWanPhra ? " is-holy-day" : ""}" href="${day.href}" ${isToday ? 'aria-current="date"' : ""} data-date="${day.iso}" data-focus-key="day-${day.iso}" aria-label="${escapeHtml(label)}">
    <span class="cal-day-top"><strong>${day.day}</strong><i class="cal-moon moon-${day.lunar.moon}" aria-hidden="true"></i></span>
    ${isToday ? '<span class="cal-today-label">วันนี้</span>' : ""}<span class="cal-lunar-line">${day.lunar.phase} ${day.lunar.day} ค่ำ</span>
    <span class="cal-day-badges" aria-hidden="true">${events.slice(0, 2).map((event, i) => badge(event, i === 1 ? "cal-second-badge" : "")).join("")}${events.length > 2 ? `<span class="cal-more cal-more-desktop">+${events.length - 2}</span>` : ""}${events.length > 1 ? `<span class="cal-more cal-more-tablet">+${events.length - 1}</span>` : ""}</span>
    <span class="cal-mobile-indicators" aria-hidden="true">${events.length ? badge({ type: events[0].type, label: compactLabel(events[0].type) }) : ""}${events.length > 1 ? `<small>+${events.length - 1}</small>` : ""}</span>
  </a>`;
}

function renderEventRow(day) {
  const events = day.events.filter(event => !event.belief);
  return `<li><a href="${day.href}"><time datetime="${day.iso}">${day.day} ${monthShortNames[day.date.getMonth()]} ${day.beYear}</time><div class="cal-event-copy">${events.map(event => `<span class="cal-event-name">${escapeHtml(event.label)}</span>`).join("")}<span class="cal-event-lunar">${day.lunarShort}</span></div><span class="cal-event-category">${badge({ type: events[0].type, label: eventTypes[events[0].type].label })}</span><span class="cal-event-chevron" aria-hidden="true">›</span></a></li>`;
}

function renderDataNote() {
  return `<section class="cal-data-note" aria-labelledby="cal-note-title"><h2 id="cal-note-title"><span aria-hidden="true">i</span>ข้อควรทราบ</h2><p>ข้อมูลคำนวณเบื้องต้น วันพระและวันสำคัญควรตรวจสอบกับปฏิทินหรือประกาศทางการก่อนใช้วางแผน</p></section>`;
}

function renderEvents(year, state) {
  return `<div class="cal-events-view"><header class="cal-events-heading"><div><p>วันพระและวันสำคัญ</p><h2>วันสำคัญทั้งปี ${year.year}</h2></div><button type="button" class="cal-text-action" data-view="overview" data-focus-workspace="true">กลับปฏิทิน <span aria-hidden="true">→</span></button></header>
    <div class="cal-events-months">${year.months.map(month => {
      const days = getImportantDays(month);
      return `<section class="cal-events-group${month.month === state.month ? " is-current-month" : ""}" id="cal-events-${month.month}" tabindex="-1"><h3>${month.name} ${month.year}</h3>${days.length ? `<ul class="cal-event-list">${days.map(day => renderEventRow(day)).join("")}</ul>` : '<p class="cal-empty-copy">ยังไม่พบวันสำคัญในข้อมูลเดือนนี้</p>'}</section>`;
    }).join("")}</div>${renderDataNote()}</div>`;
}

function renderYearOverview(year, state, expanded) {
  const first = year.days[0];
  const last = year.days.at(-1);
  return `<header class="cal-year-heading"><h2 id="calendar-year-title">ปฏิทินทั้งปี ${year.year}</h2><p>เลือกเดือนเพื่อดูรายละเอียด หรือวางแผนล่วงหน้าตลอดทั้งปี</p><button type="button" class="cal-text-action cal-expand-year" data-expand-year aria-controls="cal-month-tiles cal-year-facts" aria-expanded="${expanded}">${expanded ? "ย่อรายการ" : "ดูทั้งหมด"}</button></header>
    <div class="cal-month-tiles" id="cal-month-tiles">${year.months.map(month => `<button type="button" id="month-${month.month}" class="cal-month-tile" data-month="${month.month}" data-month-tile="true" aria-pressed="${month.month === state.month}"><strong>${month.name}</strong><span>${month.days.length} วัน</span><small>วันพระ ${month.holyDayCount} วัน</small><span class="cal-tile-arrow" aria-hidden="true">→</span></button>`).join("")}</div>
    <details class="cal-year-facts" id="cal-year-facts"><summary>ข้อมูลปีและระบบศักราช</summary><p>พ.ศ. ${year.year} / ค.ศ. ${year.year - 543} · จ.ศ. ${first.chulaSakarat}${first.chulaSakarat !== last.chulaSakarat ? `–${last.chulaSakarat}` : ""}</p><p>ต้นปี: ปี${first.zodiac.name} · ${first.yearType} / ปลายปี: ปี${last.zodiac.name} · ${last.yearType}</p></details>`;
}
