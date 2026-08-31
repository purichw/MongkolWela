const selectors = {
  carousel: "[data-carousel]",
  slide: ".hero-slide",
  dot: "[data-carousel-dot]",
  previous: "[data-carousel-prev]",
  next: "[data-carousel-next]",
};

const intervalMs = 8000;
const transitionMs = 860;

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
  let transitionTimerId;

  slides.forEach((slide, slideIndex) => {
    slide.style.setProperty("--slide-index", String(slideIndex));
  });

  function setActiveSlide(index, direction = "forward") {
    const nextIndex = (index + slides.length) % slides.length;
    const previousIndex = activeIndex;

    if (nextIndex === previousIndex) return;

    slides.forEach((slide, slideIndex) => {
      slide.classList.remove(
        "is-entering-forward",
        "is-entering-backward",
        "is-exiting-forward",
        "is-exiting-backward",
      );

      if (slideIndex !== previousIndex && slideIndex !== nextIndex) {
        slide.classList.remove("is-active");
      }
    });

    const previousSlide = slides[previousIndex];
    const nextSlide = slides[nextIndex];
    const enteringClass = direction === "backward" ? "is-entering-backward" : "is-entering-forward";
    const exitingClass = direction === "backward" ? "is-exiting-backward" : "is-exiting-forward";

    nextSlide.classList.add(enteringClass);
    nextSlide.setAttribute("aria-hidden", "false");

    window.requestAnimationFrame(() => {
      previousSlide.classList.add(exitingClass);
      previousSlide.classList.remove("is-active");
      nextSlide.classList.add("is-active");
      nextSlide.classList.remove(enteringClass);
      activeIndex = nextIndex;
      syncControls();
    });

    if (transitionTimerId) window.clearTimeout(transitionTimerId);
    transitionTimerId = window.setTimeout(() => {
      previousSlide.classList.remove(exitingClass);
      previousSlide.setAttribute("aria-hidden", "true");
    }, transitionMs);
  }

  function moveBy(offset) {
    setActiveSlide(activeIndex + offset, offset < 0 ? "backward" : "forward");
    restart();
  }

  function start() {
    if (prefersReducedMotion) return;
    stop();
    timerId = window.setInterval(() => setActiveSlide(activeIndex + 1, "forward"), intervalMs);
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
        setActiveSlide(dotIndex, dotIndex < activeIndex ? "backward" : "forward");
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

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  function syncControls() {
    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-pressed", String(isActive));
    });

    slides.forEach((slide, slideIndex) => {
      slide.setAttribute("aria-hidden", String(slideIndex !== activeIndex));
    });

    hero?.style.setProperty("--active-slide", String(activeIndex + 1));
  }

  syncControls();
  start();
}
