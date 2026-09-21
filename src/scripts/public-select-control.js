import Choices from "choices.js";
import { autoUpdate, computePosition, flip, offset, shift, size } from "@floating-ui/dom";

const controls = new Map();
const defaultSelections = new WeakMap();
let nextId = 0;

class PublicChoices extends Choices {
  _onFormReset() {
    // Let the browser restore native defaults; the shared reset handler syncs after it.
    this.clearInput();
    this.hideDropdown(true);
  }

  showDropdown(preventInputFocus) {
    if (this.containerOuter.isDisabled) return this;
    // Enter the top layer before Choices focuses its search input, including on iOS.
    if (!this.dropdown.element.matches(":popover-open")) this.dropdown.element.showPopover();
    return super.showDropdown(preventInputFocus);
  }
}

function rememberDefaults(select) {
  for (const option of select.options) if (!defaultSelections.has(option)) defaultSelections.set(option, option.defaultSelected);
}

function restoreDefaults(select) {
  const value = select.value;
  for (const option of select.options) {
    const original = defaultSelections.get(option);
    if (original !== undefined && option.defaultSelected !== original) option.defaultSelected = original;
  }
  select.value = value;
}

function searchable(select) {
  if (select.dataset.selectSearch) return select.dataset.selectSearch === "on";
  const options = [...select.options].filter(option => option.value && !option.disabled);
  const shortNumbers = options.every(option => /^\d{1,2}$/.test(option.label));
  return options.length >= 8 && !shortNumbers;
}

function labelFor(select) {
  const labelledBy = select.getAttribute("aria-labelledby");
  if (labelledBy) return labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || "").join(" ").trim();
  if (select.getAttribute("aria-label")) return select.getAttribute("aria-label");
  return [...select.labels].map(label => {
    const copy = label.cloneNode(true);
    copy.querySelectorAll("select, input, button, .mw-select").forEach(node => node.remove());
    return copy.textContent.trim();
  }).join(" ") || select.name || "เลือกตัวเลือก";
}

function optionsKey(select) {
  return JSON.stringify([...select.children].map(node => node.outerHTML));
}

function createControl(select) {
  rememberDefaults(select);
  const name = labelFor(select);
  const search = searchable(select);
  const originalClasses = [...select.classList];
  const events = new AbortController();
  const on = (node, type, listener, options = {}) => node.addEventListener(type, listener, { ...options, signal: events.signal });
  const choices = new PublicChoices(select, {
    allowHTML: false,
    allowHtmlUserInput: false,
    shouldSort: false,
    searchEnabled: search,
    searchFields: ["label"],
    searchResultLimit: select.options.length,
    searchPlaceholderValue: "ค้นหา...",
    itemSelectText: "",
    noResultsText: "ไม่พบรายการที่ตรงกับคำค้น",
    noChoicesText: "ไม่มีรายการให้เลือก",
    loadingText: "กำลังโหลด...",
    position: "bottom",
    fuseOptions: { threshold: 0, ignoreLocation: true },
    classNames: { containerOuter: ["choices", "mw-select"], input: ["choices__input"], loadingState: ["is-select-loading"] },
    callbackOnCreateTemplates() {
      return { item: (...args) => {
        const item = Choices.defaults.templates.item.call(this, ...args);
        item.removeAttribute("role");
        item.removeAttribute("aria-selected");
        return item;
      } };
    },
  });
  const outer = choices.containerOuter.element;
  const dropdown = choices.dropdown.element;
  const list = choices.choiceList.element;
  const input = choices.input.element;
  const id = `mw-select-${++nextId}`;
  let cleanupPosition;
  let options = optionsKey(select);
  let optionNodes = [...select.options];
  let syncing = false;
  let destroyed = false;

  outer.classList.add(...originalClasses);
  outer.dataset.searchable = String(search);
  outer.setAttribute("role", "combobox");
  outer.setAttribute("aria-haspopup", "listbox");
  outer.setAttribute("aria-label", name);
  outer.setAttribute("aria-controls", `${id}-options`);
  if (select.required) outer.setAttribute("aria-required", "true");
  if (select.getAttribute("aria-describedby")) outer.setAttribute("aria-describedby", select.getAttribute("aria-describedby"));
  list.id = `${id}-options`;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", name);
  choices.itemList.element.removeAttribute("role");
  dropdown.setAttribute("popover", "manual");
  dropdown.removeAttribute("aria-expanded");
  input.setAttribute("aria-label", `ค้นหา${name}`);
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("role", "searchbox");
  const status = document.createElement("span");
  status.className = "mw-select-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  dropdown.append(status);

  function closePopover() {
    dropdown.removeAttribute("aria-expanded");
    cleanupPosition?.();
    cleanupPosition = undefined;
    if (dropdown.matches(":popover-open")) dropdown.hidePopover();
  }

  async function position() {
    if (destroyed || !dropdown.matches(":popover-open")) return;
    const result = await computePosition(outer, dropdown, {
      strategy: "fixed",
      placement: "bottom-start",
      middleware: [offset(6), flip({ padding: 10 }), shift({ padding: 10 }), size({
        padding: 10,
        apply({ availableHeight, availableWidth, rects }) {
          dropdown.style.width = `${Math.min(Math.max(rects.reference.width, 230), availableWidth)}px`;
          dropdown.style.setProperty("--mw-select-list-height", `${Math.max(60, Math.min(280, availableHeight - (search ? 78 : 16)))}px`);
        },
      })],
    });
    if (!destroyed && dropdown.matches(":popover-open")) Object.assign(dropdown.style, { left: `${result.x}px`, top: `${result.y}px` });
  }

  function syncControl() {
    if (syncing || destroyed) return;
    if (searchable(select) !== search) {
      const hadFocus = outer.contains(document.activeElement);
      destroy();
      const replacement = createControl(select);
      if (hadFocus && !select.disabled) replacement.outer.focus();
      return;
    }
    syncing = true;
    observer.disconnect();
    rememberDefaults(select);
    const value = select.value;
    const currentOptions = optionsKey(select);
    const currentNodes = [...select.options];
    if (currentOptions !== options || currentNodes.length !== optionNodes.length || currentNodes.some((node, index) => node !== optionNodes[index])) {
      choices.config.searchResultLimit = select.options.length;
      choices.refresh(false, false, true);
      choices.setChoiceByValue(value);
    } else if (choices.getValue(true) !== value) {
      choices.removeActiveItems();
      choices.setChoiceByValue(value);
    }
    if (select.disabled) {
      choices.hideDropdown(true);
      closePopover();
      choices.disable();
    } else choices.enable();
    outer.setAttribute("aria-disabled", String(select.disabled));
    outer.setAttribute("aria-required", String(select.required));
    outer.classList.toggle("is-invalid", select.getAttribute("aria-invalid") === "true");
    outer.setAttribute("aria-invalid", select.getAttribute("aria-invalid") || "false");
    restoreDefaults(select);
    options = optionsKey(select);
    optionNodes = [...select.options];
    observer.observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "selected", "value", "label", "required", "aria-invalid", "data-select-search"] });
    syncing = false;
  }

  function destroy() {
    destroyed = true;
    closePopover();
    observer.disconnect();
    events.abort();
    choices.destroy();
    controls.delete(select);
  }

  const observer = new MutationObserver(syncControl);
  const record = { outer, choices, sync: syncControl, destroy };
  controls.set(select, record);

  on(select, "showDropdown", () => {
    if (destroyed) return;
    dropdown.removeAttribute("aria-expanded");
    for (const record of controls.values()) if (record.outer !== outer) record.choices.hideDropdown(true);
    cleanupPosition?.();
    cleanupPosition = autoUpdate(outer, dropdown, position);
    const selected = dropdown.querySelector(".is-selected");
    if (selected) list.scrollTop = selected.offsetTop - list.offsetTop - list.clientHeight / 2 + selected.clientHeight / 2;
  });
  on(select, "hideDropdown", closePopover);
  on(select, "search", event => { status.textContent = event.detail.resultCount ? `พบ ${event.detail.resultCount} รายการ` : "ไม่พบรายการที่ตรงกับคำค้น"; });
  on(select, "change", () => {
    outer.classList.remove("is-invalid");
    outer.setAttribute("aria-invalid", "false");
    restoreDefaults(select);
    options = optionsKey(select);
  });
  on(select, "invalid", event => {
    event.preventDefault();
    outer.setAttribute("aria-invalid", "true");
    outer.classList.add("is-invalid");
    outer.focus();
    choices.showDropdown();
  });
  on(outer, "keydown", event => {
    if (event.isComposing) return;
    if (["Home", "End"].includes(event.key) && event.target !== input) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const available = [...list.querySelectorAll("[data-choice-selectable]")];
      const target = event.key === "Home" ? available[0] : available.at(-1);
      target?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      target?.scrollIntoView({ block: "nearest" });
    }
  }, { capture: true });
  // Wrapped labels must not forward a second click to the concealed select.
  on(outer, "click", event => { if (event.target !== input) event.preventDefault(); });
  for (const label of select.labels) on(label, "click", event => {
    if (!outer.contains(event.target) && !event.target.closest("a, button, summary") && !select.disabled) {
      event.preventDefault();
      outer.focus();
      choices.showDropdown();
    }
  });
  syncControl();
  return record;
}

export function sync(root = document) {
  for (const [select, record] of controls) if (root === select || root.contains(select)) record.sync();
}

export function enhance(root) {
  if (!("showPopover" in HTMLElement.prototype)) return;
  for (const [select, record] of controls) if (!select.isConnected) record.destroy();
  for (const select of root.querySelectorAll("select:not([multiple]):not([data-native-select])")) {
    if (controls.has(select) || select.closest("[hidden]") || select.size > 1) continue;
    createControl(select);
  }
}
