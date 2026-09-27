import { applyImageFallback } from "../lib/image-placeholder.js";
import { coordinates, esc, icon } from "../lib/place-detail-view.js";

const root = document.querySelector("[data-place-detail]");
const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
let leafletPromise;
let toastTimer;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

if (root) {
  root.querySelectorAll("[data-pd-enhanced]").forEach(node => { node.hidden = false; });
  initializeImages(root);
  initializeTravel(root);
  initializeRelated(root);
  initializeMaps(root);
  root.querySelector("[data-temple-detail-copy]")?.addEventListener("click", () => copyUrl());
  root.querySelectorAll(".pd-confidence-help").forEach(details => {
    let hoverOpened = false;
    details.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse" && matchMedia("(min-width: 768px) and (hover: hover)").matches && !details.open) { hoverOpened = true; details.open = true; }
    });
    details.addEventListener("pointerleave", event => {
      hoverOpened = false;
      if (event.pointerType === "mouse" && !details.contains(document.activeElement)) details.open = false;
    });
    details.querySelector("summary").addEventListener("click", event => {
      if (hoverOpened) { event.preventDefault(); hoverOpened = false; details.open = true; }
    });
    details.querySelector("summary").addEventListener("focus", event => { if (event.target.matches(":focus-visible")) details.open = true; });
    details.addEventListener("focusout", event => { if (!details.contains(event.relatedTarget)) details.open = false; });
  });
  root.querySelector("[data-temple-detail-share]")?.addEventListener("click", async () => {
    if (navigator.share) {
      try { await navigator.share({ title: document.title, url: canonicalUrl() }); return; }
      catch (error) { if (error.name === "AbortError") return; }
    }
    await copyUrl();
  });
  document.addEventListener("click", event => {
    if (event.target instanceof Element && !event.target.closest(".pd-confidence-help")) root.querySelectorAll(".pd-confidence-help[open]").forEach(d => { d.open = false; });
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") root.querySelectorAll(".pd-confidence-help[open]").forEach(d => { d.open = false; d.querySelector("summary").focus(); });
  });
}

function initializeImages(page) {
  const credit = page.querySelector(".pd-image-credit");
  const photoOpen = page.querySelector("[data-photo-open]");
  let photoDialog;
  let photoSource;
  const imageSignature = () => {
    const picture = page.querySelector("[data-place-media] picture");
    return JSON.stringify([picture.querySelector("img").getAttribute("src"), picture.querySelector("source")?.getAttribute("srcset"), picture.querySelector("img").alt, credit.innerHTML]);
  };
  function updateCredit(image) {
    if (!image.closest("[data-place-media]")) return;
    credit.hidden = image.currentSrc === new URL(image.dataset.fallbackSrc, location.href).href;
    photoOpen.hidden = credit.hidden;
  }
  function fallback(image) {
    if (!(image instanceof HTMLImageElement) || !image.dataset.fallbackSrc) return;
    applyImageFallback(image);
    if (image.closest("[data-place-media]")) { credit.hidden = true; photoOpen.hidden = true; }
  }
  page.addEventListener("error", event => fallback(event.target), true);
  page.addEventListener("load", event => { if (event.target instanceof HTMLImageElement && event.target.dataset.fallbackSrc) updateCredit(event.target); }, true);
  page.querySelectorAll("img[data-fallback-src]").forEach(image => {
    if (image.complete && !image.naturalWidth) fallback(image);
    else if (image.complete) updateCredit(image);
  });
  photoOpen.addEventListener("click", () => {
    const source = page.querySelector("[data-place-media] img");
    const dialog = createDialog(source.alt || "ภาพสถานที่");
    photoDialog = dialog;
    photoSource = imageSignature();
    dialog.classList.add("pd-photo-dialog");
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
    figure.append(image);
    const caption = document.createElement("figcaption");
    caption.innerHTML = credit.innerHTML;
    figure.append(caption);
    dialog.append(figure);
    dialog.addEventListener("close", () => { photoDialog = null; }, { once: true });
    dialog.showModal();
    dialog.querySelector("[data-dialog-close]").focus();
  });
  page.addEventListener("mw:place-detail-updated", () => { if (photoSource !== imageSignature()) photoDialog?.close(); });
  page.addEventListener("mw:place-detail-unavailable", () => { photoDialog?.close(); });
}

function initializeTravel(page) {
  let selected = "all";
  const expanded = new Map();
  const filters = [...page.querySelectorAll("[data-pd-mode]")];
  const stops = [...page.querySelectorAll("[data-pd-stop]")];
  const more = page.querySelector("[data-pd-stops-more]");
  if (!more) return;
  const mobile = matchMedia("(max-width: 767px)");
  function apply(announce = false) {
    const candidates = stops.filter(s => selected === "all" || s.dataset.mode === selected);
    const firstModes = new Set();
    const initial = selected === "all" ? mobile.matches ? candidates.slice().sort((a, b) => Number(a.dataset.distance) - Number(b.dataset.distance)).slice(0, 1) : candidates.filter(s => {
      if (firstModes.has(s.dataset.mode) || firstModes.size >= 4) return false;
      firstModes.add(s.dataset.mode); return true;
    }) : candidates.slice(0, 2);
    const shown = expanded.get(selected) ? candidates : initial;
    stops.forEach(stop => { stop.hidden = !shown.includes(stop); });
    filters.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.pdMode === selected)));
    more.hidden = candidates.length <= initial.length;
    more.setAttribute("aria-expanded", String(Boolean(expanded.get(selected))));
    more.textContent = expanded.get(selected) ? "แสดงน้อยลง" : `ดูทั้งหมด (${candidates.length})`;
    more.setAttribute("aria-label", expanded.get(selected) ? "แสดงจุดเดินทางน้อยลง" : `ดูจุดเดินทางทั้งหมด (${candidates.length})`);
    if (announce) {
      page.querySelector("[data-pd-travel-status]").textContent = `แสดง ${shown.length} จาก ${candidates.length} จุดเดินทาง`;
      const active = filters.find(button => button.dataset.pdMode === selected);
      const strip = active?.parentElement;
      if (strip && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: strip.scrollLeft + active.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - active.offsetWidth) / 2, behavior: reducedMotion() ? "instant" : "smooth" });
    }
  }
  filters.forEach(button => button.addEventListener("click", () => { selected = button.dataset.pdMode; apply(true); }));
  more.addEventListener("click", () => { expanded.set(selected, !expanded.get(selected)); apply(true); });
  mobile.addEventListener("change", () => apply());
  apply();
}

function initializeRelated(page) {
  const rail = page.querySelector("[data-related-rail]");
  if (!rail) return;
  let cards = [...rail.children].filter(card => !card.hidden);
  const controls = page.querySelector("[data-related-controls]");
  const prev = controls.querySelector("[data-related-prev]");
  const next = controls.querySelector("[data-related-next]");
  let current = 0;
  function update() {
    cards = [...rail.children].filter(card => !card.hidden);
    if (!cards.length) { controls.hidden = true; return; }
    const left = rail.getBoundingClientRect().left;
    current = cards.reduce((best, card, i) => Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[best].getBoundingClientRect().left - left) ? i : best, 0);
    if (rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2 && rail.scrollLeft > 0) current = cards.length - 1;
    controls.hidden = rail.scrollWidth <= rail.clientWidth + 1;
    prev.disabled = rail.scrollLeft <= 1;
    next.disabled = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1;
    controls.querySelector("[data-related-count]").textContent = `${current + 1} / ${cards.length}`;
  }
  function move(delta) {
    if (!cards.length) return;
    const card = cards[Math.max(0, Math.min(cards.length - 1, current + delta))];
    rail.scrollTo({ left: rail.scrollLeft + card.getBoundingClientRect().left - rail.getBoundingClientRect().left, behavior: reducedMotion() ? "instant" : "smooth" });
  }
  prev.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  rail.addEventListener("scroll", update, { passive: true });
  rail.addEventListener("mw:related-updated", update);
  new ResizeObserver(update).observe(rail);
  update();
}

function createDialog(title) {
  const dialog = document.createElement("dialog");
  dialog.className = "pd-dialog";
  dialog.innerHTML = `<header><h2 id="pd-dialog-title">${esc(title)}</h2><button type="button" data-dialog-close aria-label="ปิด">${icon("x")}</button></header>`;
  dialog.setAttribute("aria-labelledby", "pd-dialog-title");
  const lastFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const controls = [...dialog.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')].filter(node => node.getClientRects().length && !node.closest("[hidden]"));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    if (lastFocus?.isConnected && lastFocus.getClientRects().length) lastFocus.focus?.({ preventScroll: true });
    else { const heading = root?.querySelector("h1"); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } }
    dialog.remove();
  }, { once: true });
  document.body.append(dialog);
  document.body.style.overflow = "hidden";
  return dialog;
}

function canonicalUrl() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const url = new URL(canonical || location.pathname, location.origin);
  url.search = ""; url.hash = "";
  return url.href;
}

async function copyUrl() {
  try { await navigator.clipboard.writeText(canonicalUrl()); toast("คัดลอกลิงก์แล้ว"); }
  catch {
    const dialog = createDialog("คัดลอกลิงก์");
    dialog.insertAdjacentHTML("beforeend", `<div class="pd-dialog-copy"><label for="pd-copy-url">ลิงก์ของสถานที่</label><input id="pd-copy-url" readonly value="${esc(canonicalUrl())}" /></div>`);
    dialog.showModal();
    const input = dialog.querySelector("input"); input.focus(); input.select();
  }
}

function toast(message) {
  let node = document.querySelector(".pd-toast");
  if (!node) { node = document.createElement("div"); node.className = "pd-toast"; node.setAttribute("role", "status"); document.body.append(node); }
  node.hidden = false; node.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2200);
}

function initializeMaps(page) {
  const canvas = page.querySelector("[data-temple-detail-map]");
  const status = page.querySelector("[data-map-status]");
  const open = page.querySelector("[data-map-open]");
  const retry = page.querySelector("[data-map-retry]");
  const state = { coords: null, mini: null, miniMarker: null, miniLayer: null, modal: null, modalMap: null, modalMarker: null, modalLayer: null, loading: false };
  const read = () => ({ coords: coordinates({ latitude: canvas.dataset.lat, longitude: canvas.dataset.lng }), title: canvas.dataset.title || "พิกัด", url: canvas.dataset.mapUrl || "", address: canvas.dataset.address || "" });
  const marker = () => window.L.divIcon({ className: "pd-marker", html: icon("map-pin"), iconSize: [36, 36], iconAnchor: [18, 18] });
  function reportError(scope) { document.dispatchEvent(new CustomEvent("mw:map-load-error", { detail: { scope, title: read().title, reason: "map_load_failed" } })); }
  function tileLayer(map, modal) {
    let loaded = false;
    const layer = window.L.tileLayer(TILE_URL, { maxZoom: 19, attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ" });
    layer.on("tileerror", () => {
      const node = modal ? state.modal?.querySelector("[data-modal-status]") : status;
      if (node) { node.hidden = false; node.textContent = "โหลดแผนที่บางส่วนไม่สำเร็จ ลองโหลดใหม่หรือเปิดใน Google Maps"; }
      if (modal && state.modal) state.modal.querySelector("[data-modal-retry]").hidden = false; else retry.hidden = false;
      reportError(modal ? "detail_modal" : "detail_minimap");
    });
    layer.on("tileload", () => {
      if (loaded) return;
      loaded = true;
      const node = modal ? state.modal?.querySelector("[data-modal-status]") : status;
      if (node) node.hidden = true;
    });
    layer.addTo(map);
    return layer;
  }
  async function loadMini() {
    if (state.loading || !read().coords || !page.isConnected) return;
    state.loading = true; retry.hidden = true; status.hidden = false; status.textContent = "กำลังโหลดแผนที่";
    try {
      await ensureLeaflet();
      const data = read();
      if (!data.coords || !canvas.isConnected) return;
      if (!state.mini) {
        state.mini = window.L.map(canvas, { zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false }).setView(data.coords, 15);
        state.miniLayer = tileLayer(state.mini, false);
      } else { state.miniLayer.redraw(); state.mini.setView(data.coords, 15); }
      if (!state.miniMarker) state.miniMarker = window.L.marker(data.coords, { icon: marker(), interactive: false, keyboard: false }).addTo(state.mini);
      else state.miniMarker.setLatLng(data.coords);
      status.hidden = true;
    } catch {
      status.hidden = false; status.textContent = "โหลดแผนที่ไม่สำเร็จ";
      retry.hidden = false; reportError("detail_minimap");
    } finally { state.loading = false; }
  }
  function update() {
    const data = read();
    const changed = JSON.stringify(data.coords) !== JSON.stringify(state.coords);
    state.coords = data.coords;
    open.hidden = !data.coords;
    open.setAttribute("aria-label", `ขยายแผนที่ ${data.title}`);
    if (!data.coords) {
      if (state.miniMarker) { state.miniMarker.remove(); state.miniMarker = null; }
      if (state.modalMarker) { state.modalMarker.remove(); state.modalMarker = null; }
      status.hidden = false; status.textContent = "ยังไม่มีพิกัดสำหรับแผนที่ภายใน"; retry.hidden = true;
    } else if (state.mini) {
      if (!state.miniMarker) state.miniMarker = window.L.marker(data.coords, { icon: marker(), interactive: false, keyboard: false }).addTo(state.mini);
      state.miniMarker.setLatLng(data.coords);
      if (changed) state.mini.setView(data.coords, 15);
      status.hidden = true;
    } else void loadMini();
    if (state.modal) {
      state.modal.querySelector("h2").textContent = `แผนที่ ${data.title}`;
      state.modal.querySelector("[data-modal-address]").textContent = data.address;
      const external = state.modal.querySelector("[data-modal-external]");
      external.hidden = !data.url; if (data.url) external.href = data.url; else external.removeAttribute("href");
      state.modal.querySelector("[data-modal-coords]").textContent = data.coords ? data.coords.map(v => v.toFixed(6)).join(", ") : "ยังไม่มีพิกัดยืนยัน";
      const recenter = state.modal.querySelector("[data-map-recenter]");
      if (!data.coords) recenter.hidden = true;
      else if (changed) recenter.hidden = false;
      if (data.coords && state.modalMap) {
        if (!state.modalMarker) state.modalMarker = window.L.marker(data.coords, { icon: marker(), keyboard: false }).addTo(state.modalMap);
        state.modalMarker.setLatLng(data.coords);
      }
      if (!data.coords) {
        const note = state.modal.querySelector("[data-modal-status]");
        note.hidden = false; note.textContent = "พิกัดถูกปรับปรุงและยังไม่มีจุดที่ยืนยัน";
      }
    }
  }
  async function loadModal(dialog) {
    const note = dialog.querySelector("[data-modal-status]");
    dialog.querySelector("[data-modal-retry]").hidden = true;
    note.hidden = false; note.textContent = "กำลังโหลดแผนที่";
    try {
      await ensureLeaflet();
      const data = read();
      if (!dialog.open || !data.coords) return;
      if (!state.modalMap) {
        state.modalMap = window.L.map(dialog.querySelector(".pd-dialog-map"), { zoomControl: true, scrollWheelZoom: true }).setView(data.coords, 15);
        state.modalLayer = tileLayer(state.modalMap, true);
        state.modalMarker = window.L.marker(data.coords, { icon: marker(), keyboard: false }).addTo(state.modalMap);
      } else state.modalLayer.redraw();
      state.modalMap.invalidateSize();
      note.hidden = true;
    } catch {
      if (!dialog.isConnected) return;
      note.textContent = "โหลดแผนที่ไม่สำเร็จ"; note.hidden = false;
      dialog.querySelector("[data-modal-retry]").hidden = false;
      reportError("detail_modal");
    }
  }
  open.addEventListener("click", () => {
    const data = read(); if (!data.coords || state.modal?.open) return;
    const dialog = createDialog(`แผนที่ ${data.title}`);
    state.modal = dialog;
    dialog.insertAdjacentHTML("beforeend", `<p class="pd-dialog-status" data-modal-status role="status">กำลังโหลดแผนที่</p><div class="pd-dialog-map" tabindex="0" aria-label="แผนที่ ${esc(data.title)}"></div><footer><div class="pd-dialog-location"><p data-modal-address>${esc(data.address)}</p><span data-modal-coords>${esc(data.coords.join(", "))}</span></div><button class="pd-button" type="button" data-map-recenter hidden>ดูพิกัดที่อัปเดต</button><button class="pd-button" type="button" data-modal-retry hidden>ลองโหลดใหม่</button><a class="pd-button" data-modal-external href="${esc(data.url)}" ${!data.url ? "hidden" : ""} target="_blank" rel="noopener">เปิดใน Google Maps</a></footer>`);
    dialog.querySelector("[data-map-recenter]").addEventListener("click", event => { if (read().coords) state.modalMap?.setView(read().coords, 15); event.currentTarget.hidden = true; });
    dialog.querySelector("[data-modal-retry]").addEventListener("click", () => loadModal(dialog));
    dialog.addEventListener("close", () => { state.modalMap?.remove(); state.modal = null; state.modalMap = null; state.modalMarker = null; state.modalLayer = null; }, { once: true });
    dialog.showModal();
    dialog.querySelector("[data-dialog-close]").focus();
    document.dispatchEvent(new CustomEvent("mw:map-open", { detail: { scope: "detail", title: data.title } }));
    void loadModal(dialog);
  });
  retry.addEventListener("click", loadMini);
  page.addEventListener("mw:place-detail-updated", update);
  page.addEventListener("mw:place-detail-unavailable", () => { state.modal?.close(); state.mini?.remove(); state.mini = null; });
  new ResizeObserver(() => { state.mini?.invalidateSize(); state.modalMap?.invalidateSize(); }).observe(canvas);
  update();
}

function ensureLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-pd-leaflet]")) {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; css.dataset.pdLeaflet = ""; document.head.append(css);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.async = true;
    const timer = setTimeout(() => { script.remove(); reject(new Error("Map load timeout")); }, 15000);
    script.onload = () => { clearTimeout(timer); window.L ? resolve() : reject(new Error("Map unavailable")); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error("Map unavailable")); };
    document.head.append(script);
  }).catch(error => { leafletPromise = null; throw error; });
  return leafletPromise;
}
