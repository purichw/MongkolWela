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
  const previous = document.querySelector(selectors.previous);
  const next = document.querySelector(selectors.next);
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

  previous?.addEventListener("click", () => moveBy(-1));
  next?.addEventListener("click", () => moveBy(1));

  dots.forEach((dot, dotIndex) => {
    dot.addEventListener("click", () => {
      setActiveSlide(dotIndex);
      restart();
    });
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
