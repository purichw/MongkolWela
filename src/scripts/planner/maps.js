export function createPlannerMaps({ getPickerItems, getStartPoint, toggleSelection, haversineKm, formatDistance, escapeHtml }) {
function refreshSelectionMap(state, elements) {
  if (!state.selectionMap || !state.selectionCluster) return;
  const filteredIds = new Set(getPickerItems(state, elements).map((item) => item.id));
  const filterKey = JSON.stringify([...filteredIds].sort());
  const origin = getStartPoint(state, elements);
  state.selectionCluster.clearLayers();
  state.selectionMarkers.forEach((marker, id) => {
    if (!filteredIds.has(id)) return;
    updateSelectionMarker(marker, state.selected.indexOf(id), origin);
    state.selectionCluster.addLayer(marker);
  });
  if (state.selectionCluster.getLayers().length && filterKey !== state.selectionFilterKey) {
    state.selectionMap.fitBounds(state.selectionCluster.getBounds(), { padding: [30, 30], maxZoom: 13, animate: false });
  }
  state.selectionFilterKey = filterKey;
}

async function ensureSelectionMap(state, elements) {
  if (state.selectionMap || !elements.selectionMap) {
    state.selectionMap?.invalidateSize();
    return;
  }
  await ensureLeaflet();
  if (state.selectionMap) return;
  const map = window.L.map(elements.selectionMap, { minZoom: 5, maxZoom: 18, scrollWheelZoom: false }).setView([13.7563, 100.5018], 6);
  addTiles(map, elements.selectionMap);
  const cluster = window.L.markerClusterGroup({ maxClusterRadius: 48, showCoverageOnHover: false, animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
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
  if (cluster.getLayers().length) map.fitBounds(cluster.getBounds(), { padding: [30, 30], maxZoom: 7, animate: false });
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
  if (state.routeMap && state.renderedRoute === state.plan) {
    state.routeMap.invalidateSize();
    return;
  }
  if (!state.routeMap) {
    // This canvas moves into a dialog; a pending zoom transition must not overwrite its restored view.
    state.routeMap = window.L.map(elements.routeMap, { minZoom: 5, maxZoom: 18, scrollWheelZoom: false, zoomAnimation: false }).setView([13.7563, 100.5018], 6);
    addTiles(state.routeMap, elements.routeMap);
  }
  if (state.routeLayer) state.routeLayer.remove();
  const group = window.L.layerGroup();
  const coordinates = state.plan.map((item) => [item.latitude, item.longitude]);
  state.plan.forEach((item, index) => {
    window.L.marker([item.latitude, item.longitude], { icon: createSelectionIcon(index) })
      .bindPopup(`<strong>${(index + 1).toLocaleString("th-TH")}. ${escapeHtml(item.name)}</strong>`)
      .on("click", () => {
        const stop = [...elements.timeline.querySelectorAll("[data-planner-stop]")].find(node => node.dataset.plannerStop === item.id);
        if (!stop) return;
        elements.timeline.querySelectorAll(".is-map-focused").forEach(node => node.classList.remove("is-map-focused"));
        stop.classList.add("is-map-focused");
        stop.setAttribute("tabindex", "-1");
        if (!elements.routeDialog?.open) stop.focus({ preventScroll: true });
      })
      .addTo(group);
  });
  window.L.polyline(coordinates, { color: "#8e2d24", weight: 4, opacity: 0.78, dashArray: "8 10" }).addTo(group);
  group.addTo(state.routeMap);
  state.routeLayer = group;
  state.renderedRoute = state.plan;
  setTimeout(() => {
    state.routeMap.invalidateSize();
    state.routeMap.fitBounds(window.L.latLngBounds(coordinates), { padding: [36, 36], maxZoom: 15, animate: false });
  }, 40);
}

function bindRouteDialog(state, elements, ensureRoute) {
  const dialog = elements.routeDialog;
  const content = elements.routeMapContent;
  const home = content.parentElement;
  const next = content.nextSibling;
  let previousView;

  elements.mapExpand.addEventListener("click", async () => {
    if (!state.plan.length || dialog.open) return;
    previousView = state.routeMap ? { center: state.routeMap.getCenter(), zoom: state.routeMap.getZoom() } : null;
    // Reparent the existing map so its markers, popups and retry state stay intact.
    elements.routeDialogBody.append(content);
    dialog.showModal();
    document.body.classList.add("has-planner-dialog");
    elements.mapExpand.setAttribute("aria-expanded", "true");
    elements.mapClose.focus();
    await ensureRoute();
    if (!dialog.open || !state.routeMap) return;
    state.routeMap.invalidateSize();
    state.routeMap.fitBounds(window.L.latLngBounds(state.plan.map(item => [item.latitude, item.longitude])), { padding: [36, 36], maxZoom: 15, animate: false });
  });
  elements.mapClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const controls = [...dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(node => node.getClientRects().length && !node.closest("[hidden]"));
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
  });
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => {
    state.routeMap?.stop();
    home.insertBefore(content, next);
    if (elements.dialog.hidden) document.body.classList.remove("has-planner-dialog");
    state.routeMap?.closePopup();
    state.routeMap?.invalidateSize({ pan: false });
    if (previousView && state.routeMap) state.routeMap.setView(previousView.center, previousView.zoom, { animate: false });
    elements.mapExpand.setAttribute("aria-expanded", "false");
    elements.mapExpand.focus({ preventScroll: true });
  });
}

function addTiles(map, container) {
  const tiles = window.L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ",
      maxZoom: 18,
    },
  ).addTo(map);
  let failed = false;
  tiles.on("tileerror", () => {
    if (failed || !container) return;
    failed = true;
    const note = document.createElement("p");
    note.className = "planner-map-tile-error";
    note.textContent = "โหลดพื้นแผนที่บางส่วนไม่ได้ ยังใช้รายการสถานที่ได้ ";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "ลองอีกครั้ง";
    retry.onclick = () => { failed = false; note.remove(); tiles.redraw(); };
    note.append(retry);
    container.append(note);
  });
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
    link.dataset.pageNonblocking = "";
    link.href = href;
    link.onload = resolve;
    link.onerror = event => { link.remove(); reject(event); };
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
    script.onerror = event => { script.remove(); reject(event); };
    document.head.appendChild(script);
  });
}

return { refreshSelectionMap, ensureSelectionMap, updateSelectionMarker, createSelectionIcon, renderSelectionPopup, renderRouteMap, bindRouteDialog, addTiles, ensureLeaflet, loadStylesheet, loadScript };
}
