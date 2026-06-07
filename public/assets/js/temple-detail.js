const DETAIL_MAP_CONFIG = {
  thailandBounds: [[5.2, 96.6], [21.2, 106.5]],
  minZoom: 6,
  maxZoom: 19,
  focusedZoom: 15,
  maxBoundsPad: 0.04,
  tileUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  tileAttribution: "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ",
};

const leafletAssets = {
  css: ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"],
  js: ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"],
};

const detailMapStates = new WeakMap();
let leafletPromise;
let toastTimer;

document.querySelectorAll("[data-temple-detail-pin]").forEach(bindHeroPin);
document.querySelectorAll("[data-temple-detail-map]").forEach(initializeDetailMap);
document.querySelector("[data-temple-detail-copy]")?.addEventListener("click", copyCurrentUrl);
document.querySelector("[data-temple-detail-share]")?.addEventListener("click", shareCurrentPage);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll("[data-temple-detail-map-modal].is-open").forEach((modal) => closeDetailMapModal(modal));
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-temple-detail-pin]")) return;
  document.querySelectorAll("[data-temple-detail-pin].is-active").forEach((pin) => pin.classList.remove("is-active"));
});

function bindHeroPin(pin) {
  pin.addEventListener("click", (event) => {
    event.stopPropagation();
    const isActive = pin.classList.contains("is-active");
    document.querySelectorAll("[data-temple-detail-pin].is-active").forEach((item) => item.classList.remove("is-active"));
    if (!isActive) pin.classList.add("is-active");
  });
}

async function initializeDetailMap(element) {
  const lat = Number(element.dataset.lat);
  const lng = Number(element.dataset.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const state = {
    lat,
    lng,
    title: element.dataset.title || "พิกัด",
    mapUrl: element.dataset.mapUrl || "",
    miniMap: null,
    modal: null,
    modalMap: null,
    lastFocusedElement: null,
  };
  detailMapStates.set(element, state);

  element.addEventListener("click", () => openDetailMapModal(element));
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDetailMapModal(element);
  });

  await ensureLeaflet();
  if (!window.L) return;

  const bounds = window.L.latLngBounds(DETAIL_MAP_CONFIG.thailandBounds[0], DETAIL_MAP_CONFIG.thailandBounds[1]);
  const map = window.L.map(element, {
    zoomControl: false,
    attributionControl: true,
    dragging: false,
    tap: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    minZoom: DETAIL_MAP_CONFIG.minZoom,
    maxBounds: bounds.pad(DETAIL_MAP_CONFIG.maxBoundsPad),
    maxBoundsViscosity: 1,
  }).setView([lat, lng], DETAIL_MAP_CONFIG.focusedZoom);

  window.L.tileLayer(DETAIL_MAP_CONFIG.tileUrl, {
    attribution: DETAIL_MAP_CONFIG.tileAttribution,
    maxZoom: DETAIL_MAP_CONFIG.maxZoom,
  }).addTo(map);

  window.L.marker([lat, lng], { icon: createMiniTempleIcon() })
    .bindTooltip(state.title, {
      direction: "top",
      offset: [0, -12],
      opacity: 0.94,
    })
    .addTo(map);

  state.miniMap = map;
  setTimeout(() => map.invalidateSize(), 120);
}

function createMiniTempleIcon() {
  return window.L.divIcon({
    className: "temple-detail-mini-marker",
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M4 10h16M6 10v11M18 10v11M8 14v3M12 14v3M16 14v3M5 7l7-4 7 4"/></svg>',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

async function openDetailMapModal(element) {
  const state = detailMapStates.get(element);
  if (!state) return;

  state.modal = state.modal || createDetailMapModal(element, state);
  state.lastFocusedElement = document.activeElement;
  state.modal.classList.add("is-open");
  state.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  await ensureLeaflet();
  if (!window.L) return;
  if (!state.modalMap) initializeDetailModalMap(state);

  setTimeout(() => {
    state.modalMap?.invalidateSize();
    state.modalMap?.setView([state.lat, state.lng], DETAIL_MAP_CONFIG.focusedZoom);
    state.modal.querySelector("[data-temple-detail-map-close]")?.focus({ preventScroll: true });
  }, 120);
}

function closeDetailMapModal(modal) {
  const mapElement = document.querySelector(`[data-temple-detail-map][data-modal-id="${modal.id}"]`);
  const state = mapElement ? detailMapStates.get(mapElement) : null;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  state?.lastFocusedElement?.focus?.({ preventScroll: true });
}

function createDetailMapModal(element, state) {
  const modal = document.createElement("div");
  modal.className = "temple-detail-map-modal";
  modal.id = `temple-detail-map-modal-${Math.random().toString(36).slice(2)}`;
  modal.setAttribute("aria-hidden", "true");
  modal.setAttribute("data-temple-detail-map-modal", "");
  element.dataset.modalId = modal.id;
  modal.innerHTML = `
    <div class="temple-detail-map-modal__overlay" data-temple-detail-map-close></div>
    <section class="temple-detail-map-modal__panel" role="dialog" aria-modal="true" aria-label="แผนที่ ${escapeHtml(state.title)}">
      <header class="temple-detail-map-modal__head">
        <h2>${escapeHtml(state.title)}</h2>
        <button type="button" data-temple-detail-map-close aria-label="ปิดแผนที่">×</button>
      </header>
      <div class="temple-detail-map-modal__canvas"></div>
      <footer class="temple-detail-map-modal__foot">
        <span>พิกัด ${state.lat.toFixed(6)}, ${state.lng.toFixed(6)}</span>
        ${state.mapUrl ? `<a href="${escapeHtml(state.mapUrl)}" target="_blank" rel="noopener">เปิดใน Google Maps</a>` : ""}
      </footer>
    </section>`;
  modal.querySelectorAll("[data-temple-detail-map-close]").forEach((button) => {
    button.addEventListener("click", () => closeDetailMapModal(modal));
  });
  document.body.appendChild(modal);
  return modal;
}

function initializeDetailModalMap(state) {
  const canvas = state.modal?.querySelector(".temple-detail-map-modal__canvas");
  if (!canvas || !window.L) return;

  const bounds = window.L.latLngBounds(DETAIL_MAP_CONFIG.thailandBounds[0], DETAIL_MAP_CONFIG.thailandBounds[1]);
  const map = window.L.map(canvas, {
    zoomControl: true,
    scrollWheelZoom: true,
    minZoom: DETAIL_MAP_CONFIG.minZoom,
    maxBounds: bounds.pad(DETAIL_MAP_CONFIG.maxBoundsPad),
    maxBoundsViscosity: 1,
  }).setView([state.lat, state.lng], DETAIL_MAP_CONFIG.focusedZoom);

  window.L.tileLayer(DETAIL_MAP_CONFIG.tileUrl, {
    attribution: DETAIL_MAP_CONFIG.tileAttribution,
    maxZoom: DETAIL_MAP_CONFIG.maxZoom,
  }).addTo(map);

  window.L.marker([state.lat, state.lng], { icon: createMiniTempleIcon() })
    .bindPopup(`<strong>${escapeHtml(state.title)}</strong>`, {
      closeButton: false,
      className: "temple-detail-map-modal__popup",
    })
    .addTo(map)
    .openPopup();

  state.modalMap = map;
}

async function shareCurrentPage(event) {
  const button = event.currentTarget;
  const title = button.dataset.shareTitle || document.title;
  if (navigator.share) {
    try {
      await navigator.share({ title, url: window.location.href });
      return;
    } catch {
      return;
    }
  }
  await copyUrl();
}

async function copyCurrentUrl() {
  await copyUrl();
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showDetailToast("คัดลอกลิงก์แล้ว");
  } catch {
    window.prompt("คัดลอกลิงก์", window.location.href);
  }
}

function showDetailToast(message) {
  let toast = document.querySelector(".temple-detail-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "temple-detail-toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1700);
}

function ensureLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  leafletPromise = Promise.all([
    ...leafletAssets.css.map(loadStylesheet),
    leafletAssets.js.reduce((promise, src) => promise.then(() => loadScript(src)), Promise.resolve()),
  ]);
  return leafletPromise;
}

function loadStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  return Promise.resolve();
}

function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
