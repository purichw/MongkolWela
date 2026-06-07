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

let leafletPromise;
let toastTimer;

document.querySelectorAll("[data-temple-detail-pin]").forEach(bindHeroPin);
document.querySelectorAll("[data-temple-detail-map]").forEach(initializeDetailMap);
document.querySelector("[data-temple-detail-copy]")?.addEventListener("click", copyCurrentUrl);
document.querySelector("[data-temple-detail-share]")?.addEventListener("click", shareCurrentPage);

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

  element.addEventListener("click", () => openMapUrl(element));
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openMapUrl(element);
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
    .bindTooltip(element.dataset.title || "พิกัด", {
      direction: "top",
      offset: [0, -12],
      opacity: 0.94,
    })
    .addTo(map);

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

function openMapUrl(element) {
  const url = element.dataset.mapUrl;
  if (url) window.open(url, "_blank", "noopener");
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
