const selectors = {
  root: "[data-scroll-progress]",
  bar: "[data-scroll-progress-bar]",
};

let frame = 0;

export function initScrollProgress() {
  const root = document.querySelector(selectors.root);
  const bar = root?.querySelector(selectors.bar);
  if (!root || !bar) return;

  const state = { root, bar };
  updateProgress(state);

  window.addEventListener("scroll", () => scheduleProgressUpdate(state), { passive: true });
  window.addEventListener("resize", () => scheduleProgressUpdate(state));
  window.addEventListener("load", () => updateProgress(state), { once: true });
}

function scheduleProgressUpdate(state) {
  window.cancelAnimationFrame(frame);
  frame = window.requestAnimationFrame(() => updateProgress(state));
}

function updateProgress({ root, bar }) {
  const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  root.classList.toggle("is-active", scrollRange > 24);
  bar.style.transform = `scaleX(${clampedProgress})`;
}
