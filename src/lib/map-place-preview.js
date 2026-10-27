import { applyImageFallback, normalizePlaceholderImage, sitePlaceholderImage } from "./image-placeholder.js";
import { escapeHtml } from "./ui-markup.js";

let activePreview;

export function renderMapPlacePreview(item, { compact = false, number } = {}) {
  const image = normalizePlaceholderImage(item.imageUrl) || sitePlaceholderImage;
  const mobile = normalizePlaceholderImage(item.imageMobileUrl) || image;
  const location = [item.province, item.district].filter(Boolean).join(" / ");
  return `<article class="map-place-preview${compact ? " map-place-preview--compact" : ""}">
    <figure class="map-place-preview__media">
      <picture>${mobile !== image ? `<source media="(max-width: 767px)" srcset="${escapeHtml(mobile)}">` : ""}<img src="${escapeHtml(image)}" alt="${escapeHtml(item.imageAlt || item.name)}" width="480" height="300" data-fallback-src="${sitePlaceholderImage}"></picture>
      ${number != null ? `<span class="map-place-preview__number">${escapeHtml(number)}</span>` : ""}
    </figure>
    <div class="map-place-preview__copy"><strong>${escapeHtml(item.name)}</strong>${location ? `<span>${escapeHtml(location)}</span>` : ""}</div>
  </article>`;
}

// Leaflet still owns positioning and tap/click behavior; hover and keyboard share
// one lifecycle, including safe passage from the marker into the preview.
export function bindMapPlacePreview(marker, content, { label, ...options } = {}) {
  let markerEvents;
  let popupEvents;
  let closeTimer;
  let hoverOpened = false;
  let keyboardOpened = false;
  const cancelClose = () => clearTimeout(closeTimer);
  const containsFocus = () => marker.getElement()?.contains(document.activeElement) || marker.getPopup()?.getElement()?.contains(document.activeElement);
  const scheduleClose = () => {
    cancelClose();
    closeTimer = setTimeout(() => {
      if (!containsFocus()) marker.closePopup();
    }, 220);
  };
  const open = (mode = "click") => {
    cancelClose();
    hoverOpened = mode === "hover";
    keyboardOpened = mode === "focus";
    marker.openPopup();
  };
  marker.bindPopup(content, {
    className: "map-place-preview-shell", minWidth: 240, maxWidth: 260,
    autoPanPaddingTopLeft: [52, 12], autoPanPaddingBottomRight: [12, 12], ...options,
  });
  const bindMarker = () => {
    markerEvents?.abort();
    markerEvents = new AbortController();
    const element = marker.getElement();
    if (!element) return;
    element.setAttribute("aria-label", `ดูตัวอย่าง ${typeof label === "function" ? label() : label || "สถานที่"}`);
    element.setAttribute("aria-expanded", String(marker.isPopupOpen()));
    element.removeAttribute("title");
    const listener = { signal: markerEvents.signal };
    element.addEventListener("focus", () => open("focus"), listener);
    element.addEventListener("blur", () => { if (keyboardOpened) scheduleClose(); }, listener);
    element.addEventListener("keydown", event => {
      if (event.key === " ") { event.preventDefault(); open("focus"); }
    }, listener);
  };
  marker.on("add", bindMarker);
  marker.on("mouseover", event => {
    if (event.originalEvent?.sourceCapabilities?.firesTouchEvents || !matchMedia("(any-hover: hover)").matches) return;
    open("hover");
  });
  marker.on("click", () => open());
  marker.on("popupopen", event => {
    if (activePreview && activePreview !== marker) activePreview.closePopup();
    activePreview = marker;
    bindMarker();
    popupEvents?.abort();
    popupEvents = new AbortController();
    const popup = event.popup.getElement();
    const map = popup.closest(".leaflet-container");
    if (map) { popup.style.setProperty("--map-preview-width", `${map.clientWidth - 12}px`); event.popup.update(); }
    popup.querySelector(".leaflet-popup-close-button")?.setAttribute("aria-label", "ปิดตัวอย่างสถานที่");
    const listener = { signal: popupEvents.signal };
    popup.addEventListener("pointerenter", cancelClose, listener);
    popup.addEventListener("focusin", cancelClose, listener);
    popup.addEventListener("focusout", scheduleClose, listener);
    popup.addEventListener("error", event => applyImageFallback(event.target), { ...listener, capture: true });
    popup.querySelectorAll("img[data-fallback-src]").forEach(image => {
      if (image.complete && !image.naturalWidth) applyImageFallback(image);
    });
    // Pointer movement, not a layout-induced mouseout from Leaflet auto-pan,
    // dismisses a hover preview. This avoids flashing at the map's edges.
    document.addEventListener("pointermove", event => {
      if (!hoverOpened || event.pointerType !== "mouse") return;
      if (marker.getElement()?.contains(event.target) || popup.contains(event.target)) cancelClose();
      else scheduleClose();
    }, listener);
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopImmediatePropagation();
      marker.closePopup();
    }, { ...listener, capture: true });
  });
  marker.on("popupclose", () => {
    cancelClose(); popupEvents?.abort();
    if (activePreview === marker) activePreview = null;
    marker.getElement()?.setAttribute("aria-expanded", "false");
  });
  marker.on("remove", () => {
    cancelClose(); markerEvents?.abort(); popupEvents?.abort();
    if (activePreview === marker) activePreview = null;
  });
  if (marker.getElement()) bindMarker();
  return marker;
}
