const CORE_WEB_VITALS = {
  lcpMs: 2500,
  cls: 0.1,
  inpMs: 200,
};

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
  let cls = 0;

  observePerformance("largest-contentful-paint", (entries) => {
    const latest = entries.at(-1);
    if (!latest) return;
    sendEvent("web_vital_lcp", {
      valueMs: Math.round(latest.startTime),
      targetMs: CORE_WEB_VITALS.lcpMs,
      status: latest.startTime <= CORE_WEB_VITALS.lcpMs ? "pass" : "needs_attention",
    });
  });

  observePerformance("layout-shift", (entries) => {
    entries.forEach((entry) => {
      if (!entry.hadRecentInput) cls += entry.value;
    });
  });

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    sendEvent("web_vital_cls", {
      value: Number(cls.toFixed(4)),
      target: CORE_WEB_VITALS.cls,
      status: cls <= CORE_WEB_VITALS.cls ? "pass" : "needs_attention",
    });
  });

  observePerformance("event", (entries) => {
    const slowestInteraction = entries
      .filter((entry) => entry.interactionId)
      .sort((a, b) => b.duration - a.duration)[0];
    if (!slowestInteraction) return;
    sendEvent("web_vital_inp_candidate", {
      valueMs: Math.round(slowestInteraction.duration),
      targetMs: CORE_WEB_VITALS.inpMs,
      status: slowestInteraction.duration <= CORE_WEB_VITALS.inpMs ? "pass" : "needs_attention",
    });
  }, { durationThreshold: 40 });
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

function observePerformance(type, callback, options = {}) {
  if (!("PerformanceObserver" in window)) return;
  try {
    const observer = new PerformanceObserver((list) => callback(list.getEntries()));
    observer.observe({ type, buffered: true, ...options });
  } catch {
    // Some metrics are not implemented in every major browser yet.
  }
}

function sendEvent(name, payload = {}) {
  const detail = { ...payload, page: window.location.pathname };
  if (typeof window.va === "function") {
    window.va("event", name, detail);
  }
  window.dispatchEvent(new CustomEvent("mw:observability", { detail: { name, data: detail } }));
}
