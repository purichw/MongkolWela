import { sitePlaceholderImage } from "../lib/image-placeholder.js";
const TEMPLE_MAP_CONFIG = {
  thailandBounds: [[5.2, 96.6], [21.2, 106.5]],
  thailandCenter: [13.7563, 100.5018],
  initialZoom: 6,
  focusedZoom: 14,
  minZoom: 6,
  maxZoom: 19,
  maxBoundsPad: 0.04,
  maxBoundsViscosity: 1,
  tileUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  tileAttribution: "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ",
  boundaryUrl: "/assets/data/thailand-boundary.geojson",
  clusterRadius: 48,
};

const leafletAssets = {
  css: [
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
  ],
  js: [
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
  ],
};

const mapStates = new WeakMap();
let leafletPromise;

document.querySelectorAll("[data-temple-map-root]").forEach(initializeTempleMapWidget);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll("[data-temple-map-modal-element].is-open").forEach((modal) => closeTempleMap(modal));
});

function initializeTempleMapWidget(root) {
  const modal = document.getElementById(root.dataset.templeMapModal);
  const openButton = root.querySelector("[data-temple-map-open]");
  const closeButtons = root.querySelectorAll("[data-temple-map-close]");
  const payloadNode = document.getElementById(root.dataset.templeMapPayload);
  const searchInput = root.querySelector("[data-temple-map-search]");
  const searchResults = root.querySelector("[data-temple-map-search-results]");
  if (!modal || !openButton || !payloadNode) return;

  const payload = readPayload(payloadNode);
  const cardData = collectTempleCardData();
  payload.items = payload.items.map((item) => ({ ...(cardData.get(item.detailUrl) || {}), ...item }));
  mapStates.set(modal, {
    root,
    payload,
    cardData,
    map: null,
    clusterGroup: null,
    markers: [],
    activeMarker: null,
    searchInput,
    searchResults,
    status: root.querySelector("[data-temple-map-status]"),
    openButton,
    previousFocus: null,
  });

  openButton.disabled = !payload.items.length;
  openButton.addEventListener("click", () => openTempleMap(modal));
  closeButtons.forEach((button) => button.addEventListener("click", () => closeTempleMap(modal)));
  searchInput?.addEventListener("input", () => updateTempleMapSearch(modal));
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const first = searchResults?.querySelector("[data-temple-map-result]");
    first?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function openTempleMap(modal) {
  const state = mapStates.get(modal);
  if (!state) return;
  state.previousFocus = document.activeElement;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.dispatchEvent(new CustomEvent("mw:map-open", {
    detail: { collection: state.payload.collection, mappedCount: state.payload.mappedCount },
  }));

  try {
    await ensureLeaflet();
  } catch (error) {
    setMapStatus(state, "โหลดแผนที่ไม่สำเร็จ ลองเชื่อมต่ออินเทอร์เน็ตอีกครั้ง");
    modal.querySelector(".temple-map-modal__panel")?.classList.add("has-map-error");
    document.dispatchEvent(new CustomEvent("mw:map-load-error", {
      detail: { collection: state.payload.collection, reason: error?.message || "leaflet_load_failed" },
    }));
    state.searchInput?.focus({ preventScroll: true });
    return;
  }

  modal.querySelector(".temple-map-modal__panel")?.classList.remove("has-map-error");
  if (!state.map) initTempleMap(modal, state);
  setTimeout(() => {
    state.map?.invalidateSize();
    fitThailand(state.map);
  }, 120);
  state.searchInput?.focus({ preventScroll: true });
}

function closeTempleMap(modal) {
  const state = mapStates.get(modal);
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  state?.searchInput?.setAttribute("aria-expanded", "false");
  state?.searchResults?.classList.remove("is-open");
  state?.previousFocus?.focus?.({ preventScroll: true });
}

function initTempleMap(modal, state) {
  const mapElement = document.getElementById(state.root.dataset.templeMapId);
  if (!mapElement || !window.L) return;

  const bounds = window.L.latLngBounds(TEMPLE_MAP_CONFIG.thailandBounds[0], TEMPLE_MAP_CONFIG.thailandBounds[1]);
  const map = window.L.map(mapElement, {
    zoomControl: true,
    scrollWheelZoom: true,
    minZoom: TEMPLE_MAP_CONFIG.minZoom,
    worldCopyJump: false,
    maxBounds: bounds.pad(TEMPLE_MAP_CONFIG.maxBoundsPad),
    maxBoundsViscosity: TEMPLE_MAP_CONFIG.maxBoundsViscosity,
  }).setView(TEMPLE_MAP_CONFIG.thailandCenter, TEMPLE_MAP_CONFIG.initialZoom);

  window.L.tileLayer(TEMPLE_MAP_CONFIG.tileUrl, {
    attribution: TEMPLE_MAP_CONFIG.tileAttribution,
    maxZoom: TEMPLE_MAP_CONFIG.maxZoom,
  }).addTo(map);

  fetch(TEMPLE_MAP_CONFIG.boundaryUrl)
    .then((response) => response.json())
    .then((geojson) => {
      window.L.geoJSON(geojson, {
        style: {
          color: "#204b3f",
          weight: 4,
          opacity: 0.88,
          fillColor: "#c28d35",
          fillOpacity: 0.08,
          className: "temple-map-country-border",
        },
      }).addTo(map);
    })
    .catch(() => {
      setMapStatus(state, "แสดงแผนที่ได้ แต่โหลดเส้นขอบประเทศไม่สำเร็จ");
    });

  const icons = createTempleMarkerIcons();
  const clusterGroup = window.L.markerClusterGroup({
    maxClusterRadius: TEMPLE_MAP_CONFIG.clusterRadius,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    iconCreateFunction(cluster) {
      return window.L.divIcon({
        html: `<div>${cluster.getChildCount().toLocaleString("th-TH")}</div>`,
        className: "temple-map-cluster",
        iconSize: window.L.point(46, 46),
      });
    },
  });

  state.payload.items.forEach((item) => {
    const cardImages = state.cardData.get(item.detailUrl);
    const marker = window.L.marker([item.latitude, item.longitude], { icon: icons.defaultIcon })
      .bindPopup(renderTemplePopup(item, cardImages, state.payload.placeholderImage), {
        maxWidth: 300,
        minWidth: 250,
        autoPan: true,
        className: "temple-map-popup-shell",
      });
    marker._templeItem = item;
    marker._defaultIcon = icons.defaultIcon;
    marker._activeIcon = icons.activeIcon;
    bindTempleMarkerHover(marker, state);
    clusterGroup.addLayer(marker);
    state.markers.push(marker);
  });

  clusterGroup.addTo(map);
  state.map = map;
  state.clusterGroup = clusterGroup;
  fitThailand(map);
  setMapStatus(state, `แสดง ${state.payload.mappedCount.toLocaleString("th-TH")} จาก ${state.payload.totalCount.toLocaleString("th-TH")} พิกัด`);
}

function fitThailand(map) {
  if (!map || !window.L) return;
  map.fitBounds(window.L.latLngBounds(TEMPLE_MAP_CONFIG.thailandBounds[0], TEMPLE_MAP_CONFIG.thailandBounds[1]), {
    padding: [26, 26],
  });
}

function createTempleMarkerIcons() {
  const defaultHtml = `
    <div class="temple-map-marker-pulse"></div>
    <div class="temple-map-marker-dot">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M4 10h16M6 10v11M18 10v11M8 14v3M12 14v3M16 14v3M5 7l7-4 7 4"/></svg>
    </div>`;
  const activeHtml = `
    <div class="temple-map-marker-dot is-active">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M4 10h16M6 10v11M18 10v11M8 14v3M12 14v3M16 14v3M5 7l7-4 7 4"/></svg>
    </div>`;
  return {
    defaultIcon: window.L.divIcon({ className: "temple-map-marker", html: defaultHtml, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18] }),
    activeIcon: window.L.divIcon({ className: "temple-map-marker is-active", html: activeHtml, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -22] }),
  };
}

function bindTempleMarkerHover(marker, state) {
  const activate = () => {
    if (state.activeMarker && state.activeMarker !== marker) state.activeMarker.setIcon(state.activeMarker._defaultIcon);
    state.activeMarker = marker;
    marker.setIcon(marker._activeIcon);
    marker.openPopup();
  };
  marker.on("mouseover click", activate);
  marker.on("popupclose", () => {
    marker.setIcon(marker._defaultIcon);
    if (state.activeMarker === marker) state.activeMarker = null;
  });
}

function collectTempleCardData() {
  return new Map(
    [...document.querySelectorAll("[data-popular-temple-card]")]
      .map((card) => {
        const detailUrl = card.getAttribute("href") || card.querySelector("[data-popular-temple-detail]")?.getAttribute("href") || "";
        return [
          detailUrl,
          {
            name: card.dataset.name || "",
            region: card.dataset.region || "",
            province: card.dataset.province || "",
            district: card.dataset.district || "",
            imageAlt: card.querySelector("picture img")?.getAttribute("alt") || card.dataset.name || "",
            desktop: card.querySelector("picture img")?.getAttribute("src") || "",
            mobile: card.querySelector("picture source")?.getAttribute("srcset") || "",
          },
        ];
      })
      .filter(([detailUrl]) => detailUrl),
  );
}

function renderTemplePopup(item, cardImages = {}, placeholderImage = sitePlaceholderImage) {
  const desktopImage = item.imageUrl || cardImages.desktop || placeholderImage || sitePlaceholderImage;
  const mobileImage = item.imageMobileUrl || cardImages.mobile || desktopImage;
  const img = `<picture class="temple-responsive-picture">
        ${mobileImage && mobileImage !== desktopImage ? `<source media="(max-width: 767px)" srcset="${escapeHtml(mobileImage)}">` : ""}
        <img src="${escapeHtml(desktopImage)}" alt="${escapeHtml(item.imageAlt || item.name)}" loading="lazy" data-fallback-src="${sitePlaceholderImage}">
      </picture>`;
  const place = [item.province, item.district].filter(Boolean).join(" / ");
  return `
    <article class="temple-map-popup">
      <figure>${img}<figcaption>#${String(item.rank).padStart(2, "0")}</figcaption></figure>
      <div class="temple-map-popup__body">
        <span>${escapeHtml(item.region)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(place)}</p>
        <a href="${escapeHtml(item.detailUrl)}">ดูรายละเอียด</a>
      </div>
    </article>`;
}

function updateTempleMapSearch(modal) {
  const state = mapStates.get(modal);
  if (!state?.searchInput || !state.searchResults) return;
  const query = normalize(state.searchInput.value);
  if (!query) {
    state.searchResults.classList.remove("is-open");
    state.searchResults.innerHTML = "";
    state.searchInput.setAttribute("aria-expanded", "false");
    return;
  }
  const matches = state.payload.items
    .filter((item) => normalize(`${item.name} ${item.region} ${item.province} ${item.district}`).includes(query))
    .slice(0, 8);
  state.searchResults.innerHTML = matches.length
    ? matches.map((item) => `
      <button type="button" role="option" data-temple-map-result data-rank="${item.rank}">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.province)}</span>
      </button>`).join("")
    : `<p>ไม่พบพิกัดที่ตรงกับคำค้นหา</p>`;
  state.searchResults.classList.add("is-open");
  state.searchInput.setAttribute("aria-expanded", "true");
  state.searchResults.querySelectorAll("[data-temple-map-result]").forEach((button) => {
    button.addEventListener("click", () => focusTempleMarker(state, Number(button.dataset.rank)));
  });

  document.dispatchEvent(new CustomEvent("mw:filter-change", {
    detail: { scope: "map_search", queryLength: query.length, resultCount: matches.length },
  }));
}

function focusTempleMarker(state, rank) {
  const marker = state.markers.find((candidate) => candidate._templeItem.rank === rank);
  if (!marker || !state.map) return;
  state.searchResults?.classList.remove("is-open");
  state.searchInput?.setAttribute("aria-expanded", "false");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  state.map.flyTo(marker.getLatLng(), TEMPLE_MAP_CONFIG.focusedZoom, { duration: prefersReducedMotion ? 0 : 0.65 });
  setTimeout(() => {
    if (state.clusterGroup?.zoomToShowLayer) {
      state.clusterGroup.zoomToShowLayer(marker, () => marker.fire("click"));
    } else {
      marker.fire("click");
    }
  }, 500);
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const modal = document.querySelector("[data-temple-map-modal-element].is-open");
  if (!modal) return;
  trapFocus(event, modal);
});

function trapFocus(event, modal) {
  const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setMapStatus(state, text) {
  if (state?.status) state.status.textContent = text;
}

function readPayload(node) {
  try {
    return JSON.parse(node.textContent || "{}");
  } catch {
    return { items: [], totalCount: 0, mappedCount: 0 };
  }
}

function ensureLeaflet() {
  if (window.L?.markerClusterGroup) return Promise.resolve();
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

function normalize(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}
