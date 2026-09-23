export const sitePlaceholderImage = "/assets/images/site-placeholder-camera-20260923.webp";
const legacyPlaceholderImages = new Set([
  "/assets/images/temple-placeholder-auspicious.png",
  "/assets/images/site-placeholder-20260923.webp",
]);

export function normalizePlaceholderImage(src) {
  return typeof src === "string" && legacyPlaceholderImages.has(src.split(/[?#]/)[0]) ? sitePlaceholderImage : src;
}

export function applyImageFallback(image) {
  if (!(image instanceof HTMLImageElement)) return;
  const fallback = normalizePlaceholderImage(image.dataset.fallbackSrc) || sitePlaceholderImage;
  image.removeAttribute("srcset");
  image.closest("picture")?.querySelectorAll("source").forEach(source => source.removeAttribute("srcset"));
  image.dataset.fallbackApplied = "true";
  image.alt = "ภาพประกอบแทนรูปที่ยังไม่มี";
  if (image.getAttribute("src") !== fallback) image.src = fallback;
}
