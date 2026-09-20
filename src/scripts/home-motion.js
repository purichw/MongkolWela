const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const targets = document.querySelectorAll([
  ".home-hero-copy > *", ".home-today-card", ".home-stat-ticker dl > div",
  ".home-section-heading", ".home-intent-card", ".home-planner-copy",
  ".home-sample-plan", ".home-collection-card", ".home-database-panel", ".learn-strip > *",
].join(","));
const seen = new WeakSet();

// Content is visible by default. Animation is an enhancement, not a visibility gate.
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
  }, { threshold: 0, rootMargin: "0px 0px -4% 0px" });
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
