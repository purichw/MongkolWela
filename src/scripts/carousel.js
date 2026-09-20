const intervalMs = 8000;

export function initHeroCarousel() {
  const carousel = document.querySelector("[data-carousel]");
  const hero = carousel?.closest(".hero");
  if (!hero) return;
  const slides = [...carousel.querySelectorAll(".hero-slide")];
  if (slides.length < 2) return;
  const dots = [...hero.querySelectorAll("[data-carousel-dot]")];
  const pauseButton = hero.querySelector("[data-carousel-pause]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let index = Math.max(0, slides.findIndex(slide => slide.classList.contains("is-active")));
  let paused = false;
  let timer;
  let pointerStart;

  function show(next) {
    index = (next + slides.length) % slides.length;
    const image = slides[index].querySelector("img");
    // A published CMS src always wins over the deferred build-time image.
    if (image && !image.hasAttribute("src") && image.dataset.carouselSrc) {
      image.src = image.dataset.carouselSrc;
    }
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === index);
      slide.setAttribute("aria-hidden", String(i !== index));
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
      dot.setAttribute("aria-pressed", String(i === index));
    });
    const current = hero.querySelector("[data-carousel-current]");
    if (current) current.textContent = String(index + 1);
  }

  function stop() {
    window.clearInterval(timer);
    timer = undefined;
  }

  function restart() {
    stop();
    const stopped = paused || reduced.matches;
    if (pauseButton) {
      pauseButton.setAttribute("aria-pressed", String(stopped));
      pauseButton.disabled = reduced.matches;
      const label = reduced.matches ? "ปิดการเปลี่ยนภาพตามการตั้งค่าลดการเคลื่อนไหว"
        : paused ? "เริ่มเปลี่ยนภาพอัตโนมัติ" : "หยุดเปลี่ยนภาพอัตโนมัติ";
      pauseButton.setAttribute("aria-label", label);
      pauseButton.setAttribute("title", label);
      pauseButton.querySelector("[data-carousel-pause-icon]").hidden = stopped;
      pauseButton.querySelector("[data-carousel-play-icon]").hidden = !stopped;
    }
    if (stopped || document.hidden || hero.matches(":hover") || hero.contains(document.activeElement)) return;
    timer = window.setInterval(() => show(index + 1), intervalMs);
  }

  function move(offset) {
    show(index + offset);
    restart();
  }
  hero.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-carousel-prev]")) move(-1);
    if (target?.closest("[data-carousel-next]")) move(1);
    const dot = target?.closest("[data-carousel-dot]");
    if (dot) { show(dots.indexOf(dot)); restart(); }
    if (target?.closest("[data-carousel-pause]")) { paused = !paused; restart(); }
  });
  hero.querySelector(".hero-controls")?.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });
  hero.addEventListener("pointerdown", (event) => {
    pointerStart = undefined;
    if (event.target.closest("a, button, input, textarea, select, [contenteditable]")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  hero.addEventListener("pointerup", (event) => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = undefined;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  });
  hero.addEventListener("pointercancel", () => { pointerStart = undefined; });
  hero.addEventListener("mouseenter", stop);
  hero.addEventListener("mouseleave", restart);
  hero.addEventListener("focusin", stop);
  hero.addEventListener("focusout", () => window.setTimeout(restart, 0));
  document.addEventListener("visibilitychange", restart);
  reduced.addEventListener("change", restart);
  show(index);
  restart();
}
