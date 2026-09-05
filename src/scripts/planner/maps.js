export function createPlannerMaps({ getPickerItems, getStartPoint, toggleSelection, haversineKm, formatDistance, escapeHtml }) {
function refreshSelectionMap(state, elements) {
  if (!state.selectionMap || !state.selectionCluster) return;
  const filteredIds = new Set(getPickerItems(state, elements).map((item) => item.id));
  const origin = getStartPoint(state, elements);
  state.selectionCluster.clearLayers();
  state.selectionMarkers.forEach((marker, id) => {
    if (!filteredIds.has(id)) return;
    updateSelectionMarker(marker, state.selected.indexOf(id), origin);
    state.selectionCluster.addLayer(marker);
  });
  if (state.selectionCluster.getLayers().length) {
    state.selectionMap.fitBounds(state.selectionCluster.getBounds(), { padding: [30, 30], maxZoom: 13 });
  }
}

async function ensureSelectionMap(state, elements) {
  if (state.selectionMap || !elements.selectionMap) {
    state.selectionMap?.invalidateSize();
    return;
  }
  await ensureLeaflet();
  if (state.selectionMap) return;
  const map = window.L.map(elements.selectionMap, { minZoom: 5, maxZoom: 18, scrollWheelZoom: true }).setView([13.7563, 100.5018], 6);
  addTiles(map);
  const cluster = window.L.markerClusterGroup({ maxClusterRadius: 48, showCoverageOnHover: false });
  state.items.forEach((item) => {
    const marker = window.L.marker([item.latitude, item.longitude], {
      icon: createSelectionIcon(state.selected.indexOf(item.id)),
    });
    marker._plannerItem = item;
    marker.bindPopup(renderSelectionPopup(item, state.selected.includes(item.id), getStartPoint(state, elements)), { minWidth: 230, maxWidth: 280 });
    marker.on("popupopen", (event) => {
      const popup = event.popup.getElement();
      popup?.querySelector("[data-planner-map-toggle]")?.addEventListener("click", () => {
        toggleSelection(state, elements, item.id);
        marker.setPopupContent(renderSelectionPopup(item, state.selected.includes(item.id), getStartPoint(state, elements)));
        marker.openPopup();
      });
    });
    state.selectionMarkers.set(item.id, marker);
    cluster.addLayer(marker);
  });
  cluster.addTo(map);
  if (cluster.getLayers().length) map.fitBounds(cluster.getBounds(), { padding: [30, 30], maxZoom: 7 });
  state.selectionMap = map;
  state.selectionCluster = cluster;
  elements.selectionMap._plannerContext = { state, elements };
  refreshSelectionMap(state, elements);
}

function updateSelectionMarker(marker, selectedIndex, origin) {
  marker.setIcon(createSelectionIcon(selectedIndex));
  marker.setPopupContent(renderSelectionPopup(marker._plannerItem, selectedIndex >= 0, origin));
}

function createSelectionIcon(selectedIndex) {
  const selected = selectedIndex >= 0;
  return window.L.divIcon({
    className: `planner-leaflet-marker${selected ? " is-selected" : ""}`,
    html: `<span>${selected ? (selectedIndex + 1).toLocaleString("th-TH") : ""}</span>`,
    iconSize: selected ? [38, 38] : [28, 28],
    iconAnchor: selected ? [19, 19] : [14, 14],
    popupAnchor: [0, selected ? -20 : -15],
  });
}

function renderSelectionPopup(item, selected, origin) {
  const distance = origin ? haversineKm(origin, item) : null;
  const distanceText = Number.isFinite(distance) ? `<span class="planner-map-popup__distance">${formatDistance(distance)} จากจุดเริ่มต้น</span>` : "";
  return `
    <article class="planner-map-popup">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml([item.province, item.district].filter(Boolean).join(" / "))}</span>
      ${distanceText}
      <p>${escapeHtml(item.blessings.slice(0, 2).join(" · ") || "ไหว้พระและเสริมสิริมงคล")}</p>
      <button type="button" data-planner-map-toggle>${selected ? "นำออกจากแผน" : "เพิ่มลงแผน"}</button>
    </article>`;
}

function renderRouteMap(state, elements) {
  if (!window.L || !elements.routeMap || !state.plan.length) return;
  if (!state.routeMap) {
    state.routeMap = window.L.map(elements.routeMap, { minZoom: 5, maxZoom: 18, scrollWheelZoom: true }).setView([13.7563, 100.5018], 6);
    addTiles(state.routeMap);
  }
  if (state.routeLayer) state.routeLayer.remove();
  const group = window.L.layerGroup();
  const coordinates = state.plan.map((item) => [item.latitude, item.longitude]);
  state.plan.forEach((item, index) => {
    window.L.marker([item.latitude, item.longitude], { icon: createSelectionIcon(index) })
      .bindPopup(`<strong>${(index + 1).toLocaleString("th-TH")}. ${escapeHtml(item.name)}</strong>`)
      .addTo(group);
  });
  window.L.polyline(coordinates, { color: "#8e2d24", weight: 4, opacity: 0.78, dashArray: "8 10" }).addTo(group);
  group.addTo(state.routeMap);
  state.routeLayer = group;
  setTimeout(() => {
    state.routeMap.invalidateSize();
    state.routeMap.fitBounds(window.L.latLngBounds(coordinates), { padding: [36, 36], maxZoom: 13 });
  }, 40);
}

function addTiles(map) {
  window.L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ",
      maxZoom: 18,
    },
  ).addTo(map);
}

let leafletPromise;

function ensureLeaflet() {
  if (window.L?.markerClusterGroup) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  const styles = [
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
  ];
  const scripts = [
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
  ];
  leafletPromise = Promise.all([
    ...styles.map(loadStylesheet),
    scripts.reduce((promise, src) => promise.then(() => loadScript(src)), Promise.resolve()),
  ]).then(() => {
    if (!window.L?.markerClusterGroup) throw new Error("Leaflet failed to initialize");
  }).catch((error) => {
    leafletPromise = null;
    throw error;
  });
  return leafletPromise;
}

function loadStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) {
    if (src.includes("markercluster") ? window.L?.markerClusterGroup : window.L) return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

return { refreshSelectionMap, ensureSelectionMap, updateSelectionMarker, createSelectionIcon, renderSelectionPopup, renderRouteMap, addTiles, ensureLeaflet, loadStylesheet, loadScript };
}
