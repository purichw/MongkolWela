import { onCLS, onINP, onLCP } from "web-vitals";

export function initObservability() {
  trackPageLoad();
  trackCoreWebVitals();
  trackImageErrors();
  trackCustomEvents();
}

function trackPageLoad() {
  window.addEventListener("load", () => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const payload = navigation
      ? {
          path: window.location.pathname,
          domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
          loadMs: Math.round(navigation.loadEventEnd),
        }
      : { path: window.location.pathname };
    sendEvent("page_load", payload);
  }, { once: true });
}

function trackCoreWebVitals() {
  const report = (metric) => sendEvent(`web_vital_${metric.name.toLowerCase()}`, {
    id: metric.id,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
  });
  onLCP(report);
  onCLS(report);
  onINP(report);
}

function trackImageErrors() {
  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;

    const fallbackSrc = image.dataset.fallbackSrc;
    if (fallbackSrc && image.dataset.fallbackApplied !== "true") {
      image.dataset.fallbackApplied = "true";
      image.src = fallbackSrc;
    }

    sendEvent("image_error", {
      path: window.location.pathname,
      src: image.currentSrc || image.src,
      alt: image.alt || "",
    });
  }, true);
}

function trackCustomEvents() {
  document.addEventListener("mw:map-open", (event) => sendEvent("map_open", event.detail || {}));
  document.addEventListener("mw:filter-change", (event) => sendEvent("filter_change", event.detail || {}));
  document.addEventListener("mw:map-load-error", (event) => sendEvent("map_load_error", event.detail || {}));
}

function sendEvent(name, payload = {}) {
  const detail = { ...payload, page: window.location.pathname };
  if (typeof window.va === "function") {
    window.va("event", name, detail);
  }
  window.dispatchEvent(new CustomEvent("mw:observability", { detail: { name, data: detail } }));
}
