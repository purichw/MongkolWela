import { iconAttributes } from "./ui-markup.js";

export function choiceChipClass(kind = "button", className = "") {
  return ["ui-choice-chip", kind === "checkbox" ? "ui-choice-chip--checkbox" : "", className].filter(Boolean).join(" ");
}

// Presentation only: the caller owns selection, grouping and change listeners.
export function createChoiceChip({ label, value = "", kind = "checkbox", selected = false, disabled = false, className = "" }) {
  const chip = document.createElement(kind === "checkbox" ? "label" : "button");
  chip.className = choiceChipClass(kind, className);
  if (kind === "checkbox") {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.checked = selected;
    input.disabled = disabled;
    const check = document.createElement("span");
    for (const [key, attribute] of Object.entries(iconAttributes("check", "ui-choice-chip__check"))) check.setAttribute(key, attribute);
    chip.append(input, check);
  } else {
    chip.type = "button";
    chip.value = value;
    chip.disabled = disabled;
    chip.setAttribute("aria-pressed", String(selected));
  }
  const text = document.createElement("span");
  text.className = "ui-choice-chip__label";
  text.textContent = label;
  chip.append(text);
  return chip;
}
