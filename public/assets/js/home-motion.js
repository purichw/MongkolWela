const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const revealSelectors = [
  ".home-intent-panel > div:first-child",
  ".home-intent-grid > a",
  "#temple-routes .section-heading",
  ".home-route-card",
  ".home-map-band .feature-copy",
  ".home-map-preview",
  "#directory .section-heading",
  ".home-directory-grid .tool-card",
  ".home-guide-section > img",
  ".home-guide-section > div",
  ".learn-strip > *",
];

function setupHomeReveals() {
  const targets = revealSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  if (!targets.length) return;

  document.documentElement.classList.add("home-motion-ready");

  targets.forEach((target, index) => {
    target.dataset.homeReveal = "true";
    target.style.setProperty("--home-reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
  });

  if (reduceMotionQuery.matches || !("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-home-revealed"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-home-revealed");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });

  targets.forEach((target) => observer.observe(target));
}

function setupHomeScrollMotion() {
  const root = document.documentElement;
  const hero = document.querySelector(".home-aura-hero");
  const mapBand = document.querySelector(".home-map-band");
  let ticking = false;

  const update = () => {
    ticking = false;

    if (reduceMotionQuery.matches) {
      root.style.setProperty("--home-page-progress", "0");
      hero?.style.setProperty("--home-hero-progress", "0");
      mapBand?.style.setProperty("--home-map-progress", "0");
      return;
    }

    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    root.style.setProperty("--home-page-progress", clamp(window.scrollY / maxScroll).toFixed(3));

    if (hero) {
      const heroProgress = clamp(window.scrollY / Math.max(1, hero.offsetHeight));
      hero.style.setProperty("--home-hero-progress", heroProgress.toFixed(3));
    }

    if (mapBand) {
      const rect = mapBand.getBoundingClientRect();
      const distance = Math.max(1, window.innerHeight + rect.height);
      const mapProgress = clamp((window.innerHeight - rect.top) / distance);
      mapBand.style.setProperty("--home-map-progress", mapProgress.toFixed(3));
    }
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  reduceMotionQuery.addEventListener?.("change", requestUpdate);
}

setupHomeReveals();
setupHomeScrollMotion();
