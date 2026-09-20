import { createPlaceModel, renderIdentity, renderImageCredit, renderHighlights, renderLocation, renderVisit } from "../lib/place-detail-view.js";

const seeds = new WeakMap();
const rendered = new WeakMap();

// Patch content domains independently: a CMS update must not replace maps or reset disclosure state.
function patchDomain(root, name, html) {
  const node = root.querySelector(`[data-pd-domain="${name}"]`);
  if (!node || rendered.get(node) === html) return;
  const open = new Set([...node.querySelectorAll("details[open]")].map(d => d.dataset.pdDisclosure));
  const focused = node.contains(document.activeElement) ? document.activeElement : null;
  const focusKey = focused?.closest("[data-pd-disclosure]")?.dataset.pdDisclosure;
  const focusHref = focused?.getAttribute("href");
  node.innerHTML = html;
  rendered.set(node, html);
  node.querySelectorAll("details").forEach(d => { d.open = open.has(d.dataset.pdDisclosure); });
  if (focused) {
    const target = focusHref ? [...node.querySelectorAll("a")].find(a => a.getAttribute("href") === focusHref) : [...node.querySelectorAll("details")].find(d => d.dataset.pdDisclosure === focusKey)?.querySelector("summary");
    if (target) target.focus({ preventScroll: true });
    else { node.tabIndex = -1; node.focus({ preventScroll: true }); }
  }
}

const imageUrl = value => {
  const url = typeof value === "string" ? value : value?.url;
  return typeof url === "string" && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : "";
};

export function applyPlaceDetailOverride(root, override = {}) {
  if (!root?.matches("[data-place-detail]")) return false;
  if (!seeds.has(root)) {
    try { seeds.set(root, JSON.parse(root.querySelector("[data-place-seed]").textContent)); }
    catch { return true; }
  }
  const seed = seeds.get(root);
  if (seed.key !== root.dataset.placeKey) return true;
  const vm = createPlaceModel(seed, override);
  patchDomain(root, "identity", renderIdentity(vm));
  patchDomain(root, "imageCredit", renderImageCredit(vm));
  patchDomain(root, "highlights", renderHighlights(vm));
  patchDomain(root, "location", renderLocation(vm));
  patchDomain(root, "visit", renderVisit(vm));
  root.querySelector("[data-place-breadcrumb]").textContent = vm.record.name;
  document.title = `${vm.record.name} | ${seed.collectionLabel} | มงคลเวลา`;
  const rank = Number(vm.record.rank), badge = root.querySelector("[data-place-rank]");
  badge.hidden = !Number.isFinite(rank) || rank <= 0;
  badge.textContent = `#${String(rank).padStart(2, "0")} ${seed.collectionLabel}`;
  root.querySelectorAll("[data-place-map-link]").forEach(a => { a.hidden = !vm.mapHref; if (vm.mapHref) a.href = vm.mapHref; else a.removeAttribute("href"); });

  const picture = root.querySelector("[data-place-media] picture");
  const img = picture.querySelector("img");
  const hero = override.images?.hero;
  const hasImage = Object.prototype.hasOwnProperty.call(override.fields || {}, "imageUrl");
  const desktop = hero && Object.prototype.hasOwnProperty.call(hero, "desktop") ? imageUrl(hero.desktop) : hasImage ? imageUrl(override.fields.imageUrl) : imageUrl(seed.record.detailImageUrl || seed.record.imageUrl);
  const mobile = hero && Object.prototype.hasOwnProperty.call(hero, "mobile") ? imageUrl(hero.mobile) : hero || hasImage ? desktop : imageUrl(seed.record.detailImageMobileUrl) || desktop;
  const nextSrc = desktop || seed.placeholderImage;
  if (img.getAttribute("src") !== nextSrc) { img.src = nextSrc; delete img.dataset.fallbackApplied; }
  img.alt = override.fields?.imageAlt ?? hero?.desktop?.alt ?? seed.record.imageAlt ?? vm.record.name;
  let source = picture.querySelector("source");
  if (mobile && mobile !== desktop) {
    if (!source) { source = document.createElement("source"); source.media = "(max-width: 767px)"; picture.prepend(source); }
    source.srcset = mobile;
  } else source?.remove();
  // Current temple image variants have no focal-point field; retain the established centered crop.
  const map = root.querySelector("[data-temple-detail-map]");
  Object.assign(map.dataset, { lat: vm.coords?.[0] ?? "", lng: vm.coords?.[1] ?? "", title: vm.record.name, mapUrl: vm.mapHref, address: vm.record.coordinateAddress || "" });
  root.dispatchEvent(new CustomEvent("mw:place-detail-updated", { detail: { key: seed.key } }));
  return true;
}
