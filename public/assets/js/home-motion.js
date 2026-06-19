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

function setupHomeHeroTextMotion() {
  const root = document.documentElement;
  const hero = document.querySelector(".home-aura-hero");
  if (!hero) return;

  const startTextMotion = () => {
    if (root.classList.contains("home-hero-text-ready")) return;
    root.classList.add("home-hero-text-ready");
    root.classList.remove("home-text-motion-pending");
  };

  if (reduceMotionQuery.matches) {
    root.classList.remove("home-text-motion-pending");
    return;
  }

  const loaderIsActive = () => root.classList.contains("is-loading") || root.classList.contains("is-navigating");

  if (!loaderIsActive()) {
    window.requestAnimationFrame(startTextMotion);
    return;
  }

  const observer = new MutationObserver(() => {
    if (loaderIsActive()) return;
    observer.disconnect();
    window.setTimeout(startTextMotion, 80);
  });

  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
}

function revealTarget(target) {
  target.classList.add("is-home-revealed");
}

function targetIsInRevealRange(target) {
  const rect = target.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  return rect.top <= viewportHeight * 0.92 && rect.bottom >= viewportHeight * -0.08;
}

function setupHomeReveals() {
  const targets = Array.from(new Set(
    revealSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))),
  ));
  if (!targets.length) return;

  targets.forEach((target, index) => {
    target.dataset.homeReveal = "true";
    target.style.setProperty("--home-reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
  });

  document.documentElement.classList.add("home-motion-ready");

  if (reduceMotionQuery.matches || !("IntersectionObserver" in window)) {
    targets.forEach(revealTarget);
    return;
  }

  const revealVisibleTargets = () => {
    targets.forEach((target) => {
      if (target.classList.contains("is-home-revealed")) return;
      if (targetIsInRevealRange(target)) revealTarget(target);
    });
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      revealTarget(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });

  targets.forEach((target) => observer.observe(target));

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(revealVisibleTargets);
  });
  window.addEventListener("load", revealVisibleTargets, { once: true });
  window.addEventListener("pageshow", revealVisibleTargets);
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

setupHomeHeroTextMotion();
setupHomeReveals();
setupHomeScrollMotion();
