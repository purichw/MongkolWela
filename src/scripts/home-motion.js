const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const targets = document.querySelectorAll([
  ".home-hero-copy > *", ".home-today-card", ".home-stat-ticker dl > div",
  ".home-section-heading", ".home-intent-card", ".home-planner-copy",
  ".home-sample-plan", ".home-collection-card", ".home-database-panel", ".learn-strip > *",
].join(","));
const seen = new WeakSet();

// Never rewind already-visible content to opacity zero after first paint.
targets.forEach(target => {
  const bounds = target.getBoundingClientRect();
  if (bounds.top < window.innerHeight && bounds.bottom > 0) seen.add(target);
});

// Content stays visible without JS; start offscreen reveals before they enter view.
function reveal(target) {
  if (seen.has(target)) return;
  seen.add(target);
  if (!reduced.matches) target.classList.add("home-entered");
}
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal(entry.target);
      observer.unobserve(entry.target);
    }
  }, { threshold: 0, rootMargin: "0px 0px 64px 0px" });
  targets.forEach(target => observer.observe(target));
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    targets.forEach(target => {
      seen.add(target);
      target.classList.remove("home-entered");
    });
    observer.disconnect();
  });
}
