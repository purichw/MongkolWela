const selectors = {
  carousel: "[data-carousel]",
  slide: ".hero-slide",
  dot: "[data-carousel-dot]",
  previous: "[data-carousel-prev]",
  next: "[data-carousel-next]",
};

const intervalMs = 6500;

export function initHeroCarousel() {
  const carousel = document.querySelector(selectors.carousel);
  if (!carousel) return;

  const hero = carousel.closest(".hero");
  const slides = Array.from(carousel.querySelectorAll(selectors.slide));
  const dots = Array.from(document.querySelectorAll(selectors.dot));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (slides.length < 2) return;

  let activeIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));
  let timerId;
  let pointerStartX;

  function setActiveSlide(index) {
    activeIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
    });

    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-pressed", String(isActive));
    });

    hero?.style.setProperty("--active-slide", String(activeIndex + 1));
  }

  function moveBy(offset) {
    setActiveSlide(activeIndex + offset);
    restart();
  }

  function start() {
    if (prefersReducedMotion) return;
    stop();
    timerId = window.setInterval(() => setActiveSlide(activeIndex + 1), intervalMs);
  }

  function stop() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = undefined;
    }
  }

  function restart() {
    stop();
    start();
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !hero?.contains(target)) return;

    const previousTrigger = target.closest(selectors.previous);
    const nextTrigger = target.closest(selectors.next);
    const dotTrigger = target.closest(selectors.dot);

    if (previousTrigger) {
      moveBy(-1);
      return;
    }

    if (nextTrigger) {
      moveBy(1);
      return;
    }

    if (dotTrigger) {
      const dotIndex = dots.indexOf(dotTrigger);
      if (dotIndex >= 0) {
        setActiveSlide(dotIndex);
        restart();
      }
    }
  });

  hero?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveBy(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveBy(1);
    }
  });

  hero?.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerStartX = event.clientX;
  });

  hero?.addEventListener("pointerup", (event) => {
    if (typeof pointerStartX !== "number") return;

    const deltaX = event.clientX - pointerStartX;
    pointerStartX = undefined;

    if (Math.abs(deltaX) < 48) return;
    moveBy(deltaX < 0 ? 1 : -1);
  });

  hero?.addEventListener("pointercancel", () => {
    pointerStartX = undefined;
  });

  hero?.addEventListener("mouseenter", stop);
  hero?.addEventListener("mouseleave", start);
  hero?.addEventListener("focusin", stop);
  hero?.addEventListener("focusout", start);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  setActiveSlide(activeIndex);
  start();
}
