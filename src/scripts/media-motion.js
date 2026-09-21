export function initMediaMotion() {
  const main = document.querySelector("main");
  if (!main) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const shown = new WeakSet();
  const active = new Set();

  // Cached images are already painted; do not make them disappear again.
  main.querySelectorAll('img[loading="lazy"]').forEach(image => {
    if (image.complete && image.naturalWidth > 0) shown.add(image);
  });

  main.addEventListener("load", event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.loading !== "lazy" || !image.naturalWidth || shown.has(image)) return;
    shown.add(image);
    if (reduced.matches || !image.animate) return;
    const animation = image.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 800,
      easing: "ease-in-out",
    });
    active.add(animation);
    const cleanup = () => active.delete(animation);
    animation.addEventListener("finish", cleanup, { once: true });
    animation.addEventListener("cancel", cleanup, { once: true });
  }, true);

  reduced.addEventListener("change", () => {
    if (reduced.matches) active.forEach(animation => animation.cancel());
  });
}
