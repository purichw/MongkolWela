import { siteConfig } from "../config/site.js";
import { navigationModel, navigationForDevice, navigationUtilities, drawerUtilities, renderDesktopNavigation, renderMobileNavigation, renderMobileHub, renderUtilityNavigation, findNavigationLink, navEscape } from "../lib/site-navigation.js";
import { renderIcon } from "../lib/ui-markup.js";

let controller;

/* Keyed navigation-only reconciliation: retain live details, focus, and scroll.
   Request ordering and revision ownership remain in cms-runtime/content-refresh. */
function reconcile(parent, markup) {
  const template = document.createElement("template");
  template.innerHTML = markup;
  const sync = (target, source) => {
    const previous = [...target.childNodes];
    const keyed = new Map(previous.filter(node => node.nodeType === 1 && node.hasAttribute("data-nav-key")).map(node => [node.getAttribute("data-nav-key"), node]));
    const used = new Set();
    let cursor = target.firstChild;
    for (const incoming of [...source.childNodes]) {
      const id = incoming.nodeType === 1 ? incoming.getAttribute("data-nav-key") : null;
      let node = id ? keyed.get(id) : previous.find(candidate => !used.has(candidate) && candidate.nodeType === incoming.nodeType && (candidate.nodeType !== 1 || (!candidate.hasAttribute("data-nav-key") && candidate.tagName === incoming.tagName)));
      if (node && node.nodeType === 1 && node.tagName !== incoming.tagName) node = null;
      if (!node) node = incoming.cloneNode(true);
      else if (node.nodeType === 1) {
        const retain = name => (node.tagName === "DETAILS" && name === "open") || name === "aria-expanded" || (node.classList.contains("mw-panel") && name === "style");
        for (const attr of [...node.attributes]) if (!retain(attr.name) && !incoming.hasAttribute(attr.name)) node.removeAttribute(attr.name);
        for (const attr of [...incoming.attributes]) if (!retain(attr.name) && node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name, attr.value);
        sync(node, incoming);
      } else if (node.textContent !== incoming.textContent) node.textContent = incoming.textContent;
      used.add(node);
      if (node !== cursor) {
        if (target.moveBefore && node.parentNode === target) target.moveBefore(node, cursor);
        else target.insertBefore(node, cursor);
      }
      cursor = node.nextSibling;
    }
    for (const node of previous) if (!used.has(node)) node.remove();
  };
  sync(parent, template.content);
}

export function updateHeaderNavigation(navigation) {
  const header = document.querySelector(".mw-header");
  if (!header || !navigation) return;
  const model = navigationModel(navigation);
  const assets = JSON.parse(header.dataset.headerAssets || "{}");
  const options = { location: location.pathname + location.hash, assets };
  let focus = document.activeElement;
  const parentId = focus?.closest("[data-nav-item-id]")?.dataset.navItemId;
  const scroll = header.querySelector(".mw-drawer-scroll");
  const scrollTop = scroll?.scrollTop || 0;
  const utility = navigationUtilities(model, siteConfig.th.topbar);
  const survivingIds = new Set();
  const collectIds = items => items.forEach(item => { survivingIds.add(item.id); collectIds(item.items || []); });
  collectIds([...model.tabs, ...utility]);
  const focusedId = focus?.closest("[data-nav-id]")?.dataset.navId;
  if (focusedId && !survivingIds.has(focusedId)) {
    const parent = focus.closest(".mw-mobile-group")?.querySelector("summary");
    const safeTarget = header.querySelector("dialog[open] .mw-drawer-close") || (survivingIds.has(parentId) ? focus.closest(".mw-nav-item")?.querySelector("summary") : null) || parent || header.querySelector(".mw-brand");
    safeTarget?.focus({ preventScroll: true });
    focus = document.activeElement;
  }
  const updates = [
    ["[data-header-desktop]", renderDesktopNavigation(model, options)],
    ["[data-header-mobile]", renderMobileNavigation(model, options)],
    ["[data-header-mobile-hub]", renderMobileHub(model, options)],
    ["[data-header-utility-links]", renderUtilityNavigation(utility, options)],
    ["[data-header-mobile-utility]", renderUtilityNavigation(drawerUtilities(model, utility), { ...options, device: "mobile" })],
  ];
  const planner = findNavigationLink(navigationForDevice(model, "desktop").tabs, "/temples/planner/");
  updates.push(["[data-header-cta]", planner ? `<a class="mw-planner-cta" data-nav-key="planner-cta" data-nav-cta="temple-planner" href="${navEscape(planner.href)}" aria-label="${navEscape(planner.label)}"><span class="mw-cta-full">${navEscape(planner.label)}</span><span class="mw-cta-short" aria-hidden="true">วางแผน</span>${renderIcon("arrow-right")}</a>` : ""]);
  for (const [selector, markup] of updates) {
    const parent = document.querySelector(selector);
    if (parent) reconcile(parent, markup);
  }
  if (focus instanceof HTMLElement && focus !== document.body) {
    if (focus.isConnected && document.activeElement !== focus) focus.focus({ preventScroll: true });
    else if (!focus.isConnected) {
      const parent = [...header.querySelectorAll("[data-nav-item-id]")].find(item => item.dataset.navItemId === parentId);
      (header.querySelector("dialog[open] .mw-drawer-close") || parent?.querySelector("summary") || header.querySelector(".mw-brand"))?.focus({ preventScroll: true });
    }
  }
  if (scroll) scroll.scrollTop = scrollTop;
  controller?.refresh();
}

export function initMobileNavigation() {
  const header = document.querySelector(".mw-header");
  if (!header || header.dataset.headerReady) return;
  const desktop = header.querySelector("[data-header-desktop]");
  const toggle = header.querySelector(".mw-menu-toggle");
  const dialog = header.querySelector(".mw-drawer");
  const scroll = header.querySelector(".mw-drawer-scroll");
  const closeButton = header.querySelector(".mw-drawer-close");
  const content = header.querySelector("[data-header-drawer-content]");
  if (!(dialog instanceof HTMLDialogElement) || !toggle || !desktop || !content) return;

  let input = "keyboard";
  let hoverTimer, exitTimer, frame;
  let suppressed = null;
  let savedScroll = 0;
  let savedBody = null;
  let drawerScroll = 0;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const root = document.documentElement;
  const summaries = () => desktop.querySelectorAll(".mw-disclosure > summary");
  const owner = node => node?.closest?.(".mw-nav-item");
  const detailsFor = item => item?.querySelector(":scope > .mw-disclosure");
  const clearTimers = () => { clearTimeout(hoverTimer); clearTimeout(exitTimer); };
  const focusSearch = () => {
    const search = document.querySelector("#site-search");
    if (!(search instanceof HTMLInputElement)) return false;
    search.focus({ preventScroll: true });
    search.scrollIntoView({ block: "center", behavior: "instant" });
    return true;
  };

  function measure() {
    const rect = header.getBoundingClientRect();
    root.style.setProperty("--site-header-sticky-height", `${Math.ceil(rect.height)}px`);
    root.style.setProperty("--site-header-visible-bottom", `${Math.max(0, Math.ceil(rect.bottom))}px`);
    for (const detail of desktop.querySelectorAll(".mw-disclosure[open]")) positionPanel(detail);
  }
  function positionPanel(detail) {
    const panel = detail.querySelector(".mw-panel");
    if (!panel) return;
    panel.style.setProperty("--mw-panel-left", "0px");
    const rect = panel.getBoundingClientRect();
    const shift = Math.max(16 - rect.left, Math.min(0, innerWidth - 16 - rect.right));
    panel.style.setProperty("--mw-panel-left", `${shift}px`);
  }
  function setOpen(detail, open, focus = false) {
    if (!detail) return;
    detail.open = open;
    detail.querySelector("summary")?.setAttribute("aria-expanded", String(open));
    if (open) {
      positionPanel(detail);
      if (focus) detail.querySelector(".mw-panel a")?.focus({ preventScroll: true });
    }
  }
  function closePanels(except) {
    clearTimers();
    for (const detail of desktop.querySelectorAll(".mw-disclosure[open]")) if (detail !== except) setOpen(detail, false);
  }
  function openPanel(item, focus = false) {
    const detail = detailsFor(item);
    if (!detail || header.dataset.headerMode !== "wide") return;
    closePanels(detail);
    setOpen(detail, true, focus);
  }

  function openDrawer() {
    closePanels();
    measure();
    savedScroll = window.scrollY;
    savedBody = Object.fromEntries(["position", "top", "width", "overflow"].map(prop => [prop, document.body.style[prop]]));
    dialog.showModal();
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScroll}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.body.classList.add("has-open-mobile-nav");
    toggle.setAttribute("aria-expanded", "true");
    closeButton.focus({ preventScroll: true });
    scroll.scrollTop = drawerScroll;
  }
  function closeDrawer(restoreFocus = true) {
    if (!dialog.open) return;
    drawerScroll = scroll.scrollTop;
    dialog.close();
    if (savedBody) Object.assign(document.body.style, savedBody);
    savedBody = null;
    document.body.classList.remove("has-open-mobile-nav");
    toggle.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: savedScroll, behavior: "instant" });
    if (restoreFocus) toggle.focus({ preventScroll: true });
    measure();
  }

  // Measure the actual wide row, even while compact. Never shrink text to make it fit.
  function fit() {
    const previous = header.dataset.headerMode;
    let wide = false;
    if (innerWidth >= 1280) {
      const probe = document.createElement("div");
      probe.className = "site-header mw-header mw-fit-probe";
      probe.dataset.headerMode = "wide";
      probe.dataset.headerReady = "true";
      probe.setAttribute("aria-hidden", "true");
      probe.inert = true;
      probe.append(header.querySelector(".mw-header-row").cloneNode(true));
      for (const element of probe.querySelectorAll("[id]")) element.removeAttribute("id");
      for (const detail of probe.querySelectorAll("details")) detail.open = false;
      document.body.append(probe);
      const required = probe.firstElementChild.getBoundingClientRect().width;
      probe.remove();
      const row = header.querySelector(".mw-header-row");
      const style = getComputedStyle(row);
      const available = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      wide = required + (previous === "wide" ? 16 : 32) <= available;
    }
    const next = wide ? "wide" : "compact";
    if (next !== previous) {
      const focusedId = document.activeElement?.closest("[data-nav-id]")?.dataset.navId;
      const hadHeaderFocus = header.contains(document.activeElement);
      closePanels();
      if (dialog.open) closeDrawer(false);
      header.dataset.headerMode = next;
      if (hadHeaderFocus) {
        const equivalent = wide ? [...desktop.querySelectorAll("[data-nav-id]")].find(node => node.dataset.navId === focusedId && node.matches(".mw-top-link")) || desktop.querySelector(".mw-top-link") : toggle;
        equivalent?.focus({ preventScroll: true });
      }
    }
    const row = header.querySelector(".mw-header-row");
    const rowStyle = getComputedStyle(row);
    const available = row.clientWidth - parseFloat(rowStyle.paddingLeft) - parseFloat(rowStyle.paddingRight);
    const brand = header.querySelector(".mw-brand");
    const brandWidth = [...brand.children].reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) + parseFloat(getComputedStyle(brand).columnGap);
    const required = brandWidth + header.querySelector(".mw-header-actions").scrollWidth + parseFloat(rowStyle.columnGap);
    header.toggleAttribute("data-actions-wrap", !wide && required > available);
    measure();
  }
  const scheduleFit = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  };

  document.addEventListener("pointerdown", () => { input = "pointer"; }, true);
  document.addEventListener("keydown", event => {
    input = "keyboard";
    if (event.key === "Escape") {
      if (dialog.open) { event.preventDefault(); closeDrawer(); return; }
      const detail = desktop.querySelector(".mw-disclosure[open]");
      if (detail) {
        event.preventDefault();
        suppressed = detail.closest(".mw-nav-item");
        closePanels();
        detail.querySelector("summary").focus({ preventScroll: true });
      }
    }
  });
  desktop.addEventListener("click", event => {
    const summary = event.target.closest(".mw-disclosure > summary");
    if (!summary) return;
    event.preventDefault();
    const detail = summary.parentElement;
    const wasOpen = detail.open;
    suppressed = null;
    closePanels();
    if (!wasOpen) openPanel(owner(summary), true);
  });
  desktop.addEventListener("keydown", event => {
    if (event.key !== "ArrowDown") return;
    const item = owner(event.target);
    if (item && detailsFor(item)) {
      event.preventDefault();
      suppressed = null;
      openPanel(item, true);
    }
  });
  desktop.addEventListener("focusin", event => {
    const item = owner(event.target);
    if (input === "keyboard" && item !== suppressed) {
      closePanels(detailsFor(item));
      openPanel(item);
    }
  });
  desktop.addEventListener("focusout", () => setTimeout(() => {
    if (!desktop.contains(document.activeElement)) closePanels();
  }, 0));
  desktop.addEventListener("pointerover", event => {
    if (!finePointer.matches || event.pointerType === "touch") return;
    const item = owner(event.target);
    if (!item || item.contains(event.relatedTarget)) return;
    clearTimers();
    if (item === suppressed) return;
    const focused = owner(document.activeElement);
    if (focused && focused !== item) return;
    hoverTimer = setTimeout(() => openPanel(item), 120);
  });
  desktop.addEventListener("pointerout", event => {
    const item = owner(event.target);
    if (!item || item.contains(event.relatedTarget)) return;
    if (suppressed === item) suppressed = null;
    clearTimers();
    exitTimer = setTimeout(() => {
      if (!item.contains(document.activeElement)) setOpen(detailsFor(item), false);
    }, 220);
  });
  document.addEventListener("click", event => {
    if (!desktop.contains(event.target)) closePanels();
    const searchLink = event.target.closest?.("[data-header-search]");
    if (searchLink) {
      if (dialog.open) closeDrawer(false);
    }
  });
  toggle.addEventListener("click", openDrawer);
  closeButton.addEventListener("click", () => closeDrawer());
  dialog.addEventListener("cancel", event => { event.preventDefault(); closeDrawer(); });
  dialog.addEventListener("click", event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) closeDrawer();
    else if (event.target.closest("a")) closeDrawer(false);
  });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll('a[href], button, summary, input')].filter(node => node.getClientRects().length && !node.closest("[inert]"));
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  dialog.addEventListener("toggle", event => {
    const group = event.target;
    if (group instanceof HTMLDetailsElement && !group.open && group.contains(document.activeElement)) group.querySelector("summary")?.focus({ preventScroll: true });
  }, true);
  scroll.append(content);
  header.dataset.headerReady = "true";
  const refresh = () => {
    for (const summary of summaries()) summary.setAttribute("aria-expanded", String(summary.parentElement.open));
    scheduleFit();
  };
  controller = { refresh };
  new ResizeObserver(scheduleFit).observe(header.querySelector(".mw-header-row"));
  window.addEventListener("resize", scheduleFit, { passive: true });
  window.addEventListener("scroll", measure, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleFit);
  document.fonts?.ready.then(scheduleFit);
  document.fonts?.addEventListener("loadingdone", scheduleFit);
  refresh();
  if (location.hash === "#site-search") focusSearch();
}
