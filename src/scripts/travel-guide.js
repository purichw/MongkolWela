const checklist = document.querySelector("[data-travel-checklist]");
const compactLayout = window.matchMedia("(max-width: 900px)");
const disclosures = document.querySelectorAll("[data-guide-mobile-disclosure]");
const syncDisclosures = () => {
  disclosures.forEach(disclosure => { disclosure.open = !compactLayout.matches; });
};
const revealChecklist = () => {
  if (location.hash === "#guide-checklist") {
    const disclosure = checklist?.querySelector("details");
    if (disclosure) disclosure.open = true;
  }
};

syncDisclosures();
revealChecklist();
compactLayout.addEventListener("change", () => { syncDisclosures(); revealChecklist(); });
window.addEventListener("hashchange", revealChecklist);
document.querySelector('.guide-text-link[href="#guide-checklist"]')?.addEventListener("click", () => {
  checklist.querySelector("details").open = true;
});

if (checklist) {
  const storageKey = "mongkolwela.travel-guide.checklist.v1";
  const inputs = [...checklist.querySelectorAll('input[type="checkbox"]')];
  const reset = checklist.querySelector("[data-guide-reset]");
  const count = checklist.querySelector("[data-guide-count]");
  const percent = checklist.querySelector("[data-guide-percent]");
  const progress = checklist.querySelector("progress");
  const note = checklist.querySelector("[data-guide-storage-note]");
  const complete = checklist.querySelector("[data-guide-complete]");

  const update = () => {
    const selected = inputs.filter(input => input.checked).map(input => input.value);
    count.textContent = `${selected.length} / ${inputs.length}`;
    percent.textContent = `${Math.round(selected.length / inputs.length * 100)}%`;
    progress.value = selected.length;
    reset.disabled = selected.length === 0;
    complete.hidden = selected.length !== inputs.length;
    return selected;
  };
  const storageUnavailable = () => {
    note.textContent = "เช็กได้ในหน้านี้ แต่ยังบันทึกบนอุปกรณ์ไม่ได้";
  };

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const selected = new Set(Array.isArray(stored) ? stored.filter(value => typeof value === "string") : []);
    inputs.forEach(input => { input.checked = selected.has(input.value); });
  } catch {
    storageUnavailable();
  }
  update();
  count.hidden = false;
  checklist.querySelector("[data-guide-progress]").hidden = false;
  checklist.querySelector("[data-guide-checklist-footer]").hidden = false;

  checklist.addEventListener("change", () => {
    const selected = update();
    try {
      localStorage.setItem(storageKey, JSON.stringify(selected));
      note.textContent = "บันทึกไว้เฉพาะบนอุปกรณ์นี้";
    } catch {
      storageUnavailable();
    }
  });
  reset.addEventListener("click", () => {
    inputs.forEach(input => { input.checked = false; });
    update();
    try {
      localStorage.removeItem(storageKey);
      note.textContent = "บันทึกไว้เฉพาะบนอุปกรณ์นี้";
    } catch {
      storageUnavailable();
    }
    inputs[0]?.focus({ preventScroll: true });
  });
}
