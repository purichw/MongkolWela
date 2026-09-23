import { applyImageFallback, normalizePlaceholderImage } from "../lib/image-placeholder.js";

export function initImageFallbacks() {
  const selector = 'img[data-fallback-src], img[src*="/temple-placeholder-auspicious.png"], img[src*="/site-placeholder-20260923.webp"]';
  const repair = image => {
    const src = image.getAttribute("src");
    const normalized = normalizePlaceholderImage(src);
    if (normalized !== src) image.src = normalized;
    // Carousel images without src are deliberately deferred until their slide opens.
    if (!image.hasAttribute("src") && image.hasAttribute("data-carousel-src")) return;
    if (!image.getAttribute("src") || (image.complete && !image.naturalWidth)) applyImageFallback(image);
  };
  const scan = root => {
    if (root instanceof HTMLImageElement && root.matches(selector)) repair(root);
    root.querySelectorAll?.(selector).forEach(repair);
  };
  document.addEventListener("error", event => {
    if (event.target instanceof HTMLImageElement && event.target.matches(selector)) applyImageFallback(event.target);
  }, true);
  scan(document);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") scan(record.target);
      else record.addedNodes.forEach(scan);
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset"] });
}
