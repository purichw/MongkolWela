import { onCmsContent } from "./content-ready.js";
import { settlePageContent } from "./page-content-ready.js";
import { renderIcon, escapeHtml as esc } from "../lib/ui-markup.js";
import { applyImageFallback } from "../lib/image-placeholder.js";
import { renderDirectoryPlaceCard as card } from "../lib/directory-place-card.js";

const root = document.querySelector("[data-directory-places]");
if (root) initialize(root);

function initialize(root) {
  const form = root.querySelector("[data-directory-form]");
  const grid = root.querySelector("[data-directory-results]");
  const count = root.querySelector("[data-directory-count]");
  const more = root.querySelector("[data-directory-more]");
  const search = form.elements.namedItem("name"), region = form.elements.namedItem("region"), province = form.elements.namedItem("province");
  const initial = new URLSearchParams(location.search);
  search.value = initial.get("name") || initial.get("q") || "";
  let rows = [], facets = [], page = null, initialized = false, controller;
  let applied = { name: search.value, region: initial.get("region") || "", province: initial.get("province") || "" };
  let selected = initial.get("place") || "";
  const options = (input, values, label, value) => {
    input.innerHTML = `<option value="">${label}</option>${[...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")).map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join("")}`;
    input.value = [...input.options].some(option => option.value === value) ? value : "";
  };
  function provinces(value = province.value) {
    options(province, facets.filter(row => !region.value || row.region === region.value).map(row => row.province), "ทุกจังหวัด", value);
  }
  async function fetchPage(append = false) {
    controller?.abort();
    const request = controller = new AbortController();
    const params = new URLSearchParams({ view: "directory", ...applied });
    if (selected) params.set("place", selected);
    if (append && page) {
      params.set("offset", String(page.nextOffset));
      params.set("revision", page.revision);
    }
    grid.setAttribute("aria-busy", "true"); more.disabled = true;
    count.textContent = append ? "กำลังโหลดสถานที่เพิ่มเติม…" : "กำลังค้นหาสถานที่…";
    try {
      const response = await fetch(`/api/admin/content?${params}`, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]) });
      if (response.status === 409 && append) { await fetchPage(); return; }
      if (!response.ok) throw new Error("Directory unavailable");
      const payload = await response.json();
      if (!payload.ok || !Array.isArray(payload.page?.places)) throw new Error("Invalid directory response");
      if (request.signal.aborted) return;
      page = payload.page;
      rows = append ? [...rows, ...page.places] : page.places;
      render(append);
    } catch {
      if (!request.signal.aborted) unavailable(append);
    } finally {
      if (controller === request) { grid.removeAttribute("aria-busy"); more.disabled = false; }
    }
  }
  function render(append = false) {
    count.textContent = `แสดง ${rows.length.toLocaleString("th-TH")} จาก ${page.total.toLocaleString("th-TH")} สถานที่`;
    if (append) grid.insertAdjacentHTML("beforeend", page.places.map(card).join(""));
    else grid.innerHTML = rows.length ? rows.map(card).join("") : `<div class="directory-empty">${renderIcon("map-pin")}<h3>${selected ? "ไม่พบสถานที่นี้" : "ยังไม่มีสถานที่ที่ตรงกับการค้นหา"}</h3><p>${selected ? "สถานที่อาจถูกนำออกหรือยังไม่ได้เผยแพร่" : "ลองเปลี่ยนชื่อวัดหรือเลือกจังหวัดอื่น"}</p><button type="button" class="directory-button" data-directory-reset>ดูสถานที่ทั้งหมด</button></div>`;
    more.hidden = page.nextOffset === null;
    if (selected) grid.querySelector("article")?.setAttribute("aria-label", "สถานที่ที่เลือก");
    settlePageContent(root);
  }
  function submit() {
    applied = { name: search.value.trim(), region: region.value, province: province.value };
    selected = "";
    const params = new URLSearchParams(Object.entries(applied).filter(([, value]) => value));
    history.replaceState({}, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
    fetchPage();
  }
  form.addEventListener("submit", event => { event.preventDefault(); submit(); });
  region.addEventListener("change", () => provinces(""));
  form.addEventListener("reset", event => {
    event.preventDefault(); search.value = ""; region.value = ""; provinces(""); submit();
  });
  grid.addEventListener("click", event => { if (event.target.closest("[data-directory-reset]")) form.reset(); });
  grid.addEventListener("error", event => {
    if (!(event.target instanceof HTMLImageElement)) return;
    applyImageFallback(event.target);
    const figure = event.target.closest("figure");
    if (figure) { figure.dataset.placeholderDesktop = "true"; figure.dataset.placeholderMobile = "true"; }
  }, true);
  more.addEventListener("click", async () => { const index = grid.children.length; await fetchPage(true); grid.children[index]?.querySelector("a")?.focus({ preventScroll: true }); });
  onCmsContent(content => {
    const incoming = content.directoryPage;
    if (!Array.isArray(incoming?.places)) { unavailable(); return; }
    if (initialized && page?.revision === incoming.revision) return;
    facets = incoming.facets;
    options(region, facets.map(row => row.region), "ทุกภาค", initialized ? region.value : applied.region);
    provinces(initialized ? province.value : applied.province);
    initialized = true;
    if (selected || Object.values(applied).some(Boolean)) fetchPage();
    else { controller?.abort(); page = incoming; rows = page.places; render(); }
  }, { onUnavailable: () => unavailable() });
  function unavailable(append = false) {
    if (append && rows.length) { count.textContent = "โหลดเพิ่มเติมไม่สำเร็จ กดแสดงเพิ่มเติมเพื่อลองอีกครั้ง"; return; }
    rows = []; more.hidden = true; count.textContent = "ยังโหลดข้อมูลสถานที่ไม่ได้";
    grid.innerHTML = `<div class="directory-empty">${renderIcon("cloud-off")}<h3>ยังเปิดรายการสถานที่ไม่ได้</h3><p>กรุณาลองอีกครั้งเมื่อเชื่อมต่ออินเทอร์เน็ตได้</p><button type="button" class="directory-button" data-directory-retry>ลองใหม่</button></div>`;
    grid.querySelector("[data-directory-retry]").addEventListener("click", () => initialized ? fetchPage() : location.reload());
    settlePageContent(root);
  }
}
