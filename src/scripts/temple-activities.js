import { requestJson } from "./request.js";
import { startContentRefresh } from "./content-refresh.js";
import { ACTIVITY_TYPES, activityDateLabel, safeActivityUrl, safeActivityImageUrl } from "../lib/temple-activities.js";
import { icon } from "../lib/place-detail-view.js";

const ACTIVITY_PLACEHOLDER_IMAGE = "/assets/images/temple-placeholder-auspicious.png";
const esc = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

document.querySelectorAll("[data-temple-activities]").forEach((root) => {
  root.querySelectorAll("[data-activity-enhanced]").forEach(node => { node.hidden = false; });
  const templeId = root.dataset.templeId;
  const result = root.querySelector("[data-activity-result]");
  const more = root.querySelector("[data-activities-more]");
  const emptyTemplate = root.querySelector("[data-activity-empty]");
  let events = [];
  let revision = "";
  let period = "upcoming";
  let expanded = false;
  let loading = false;
  let failed = false;
  let received = false;

  function row(event) {
    const changed = ["postponed", "cancelled"].includes(event.status);
    const status = event.status === "postponed" ? "เลื่อนกำหนดการ" : event.status === "cancelled" ? "ยกเลิก" : event.past ? "สิ้นสุดแล้ว" : "กำลังจะมาถึง";
    const time = event.timeMode === "timed" ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""} น.` : event.timeMode === "allDay" ? "ตลอดวัน" : "รอประกาศเวลา";
    const source = safeActivityUrl(event.sourceUrl);
    const registration = safeActivityUrl(event.registrationUrl);
    const image = safeActivityImageUrl(event.imageUrl);
    return `<article class="temple-activity" data-status="${esc(event.status)}" data-has-image="${Boolean(image)}">
      <figure class="temple-activity-media"><img src="${esc(image || ACTIVITY_PLACEHOLDER_IMAGE)}" alt="${image ? esc(event.imageAlt || event.title) : ""}" width="600" height="240" loading="lazy" decoding="async" data-activity-image /></figure>
      ${changed || event.past ? `<span class="temple-activity-status">${status}</span>` : ""}
      <div class="temple-activity-body">
        <h3 title="${esc(event.title)}">${esc(event.title)}</h3>
        <p class="temple-activity-schedule">${icon("calendar-days")}<span>${event.status === "postponed" ? "กำหนดเดิม: " : ""}${esc(activityDateLabel(event))}</span></p>
        ${event.venue ? `<p class="temple-activity-venue">${icon("map-pin")}<span>${esc(event.venue)}</span></p>` : ""}
        <details data-activity-details="${esc(event.id)}"><summary aria-label="รายละเอียดกิจกรรม ${esc(event.title)}" title="รายละเอียดกิจกรรม"><span class="temple-card-action-label">รายละเอียดกิจกรรม</span>${icon("arrow-right")}</summary><div class="temple-activity-detail">
          ${changed ? `<p class="temple-activity-notice">${esc(event.statusNote)}</p>` : ""}
          <p class="temple-activity-schedule">${icon("clock")}<span>${esc(time)} · ${esc(ACTIVITY_TYPES[event.type])}</span></p>
          ${event.venue ? `<p>${esc(event.venue)}</p>` : ""}
          ${event.description ? `<p>${esc(event.description)}</p>` : ""}
          <dl>${[["การเข้าร่วม", event.participation], ["ค่าใช้จ่าย", event.cost], ["สิ่งที่ต้องเตรียม", event.preparation]].filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
          <div class="temple-activity-links">${source ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">ประกาศจากผู้จัด ↗</a>` : ""}${registration && !changed && !event.past ? `<a href="${esc(registration)}" target="_blank" rel="noopener noreferrer">ลงทะเบียนกับผู้จัด ↗</a>` : ""}</div>
          <small>ตรวจสอบประกาศ ${esc(activityDateLabel({ startDate: event.verifiedAt }))}</small>
        </div></details>
      </div>
    </article>`;
  }

  function render() {
    if (!received && !failed) return;
    const openIds = new Set([...root.querySelectorAll("details[open]")].map((element) => element.dataset.activityDetails));
    const focusedId = document.activeElement?.closest("[data-activity-details]")?.dataset.activityDetails;
    const focusedHref = document.activeElement?.getAttribute("href");
    const visible = events.filter((event) => period === "past" ? event.past : !event.past);
    const warning = failed ? `<div class="temple-activities-stale" role="status"><p>${received ? "ไม่สามารถโหลดกิจกรรมล่าสุดได้ กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า" : "ไม่สามารถโหลดกิจกรรมล่าสุดได้"}</p><button type="button" data-activities-retry>ลองใหม่</button></div>` : "";
    result.innerHTML = warning + (received ? visible.length ? `<div class="temple-activity-list">${visible.slice(0, expanded ? undefined : 3).map(row).join("")}</div>` : emptyTemplate.innerHTML : "");
    if (received && !visible.length && period === "past") {
      result.querySelector("[data-empty-title]").textContent = "ยังไม่มีกิจกรรมที่ผ่านมาในระบบ";
      result.querySelector("[data-empty-description]").textContent = "กิจกรรมที่สิ้นสุดแล้วจะแสดงในส่วนนี้";
    }
    result.querySelectorAll("[data-activity-image]").forEach(img => {
      const showPlaceholder = () => {
        if (img.getAttribute("src") === ACTIVITY_PLACEHOLDER_IMAGE) return;
        img.alt = "";
        img.src = ACTIVITY_PLACEHOLDER_IMAGE;
        img.closest("article").dataset.hasImage = "false";
      };
      img.addEventListener("error", showPlaceholder, { once: true });
      if (img.complete && !img.naturalWidth) showPlaceholder();
    });
    root.querySelectorAll("details").forEach((element) => { element.open = openIds.has(element.dataset.activityDetails); });
    if (focusedId) {
      const details = [...root.querySelectorAll("[data-activity-details]")].find(d => d.dataset.activityDetails === focusedId);
      const target = focusedHref ? [...(details?.querySelectorAll("a") || [])].find(a => a.getAttribute("href") === focusedHref) : details?.querySelector("summary");
      target?.focus({ preventScroll: true });
    }
    result.querySelector("[data-activities-retry]")?.addEventListener("click", refresh);
    more.hidden = visible.length <= 3;
    more.innerHTML = `${expanded ? "แสดงน้อยลง" : `ดูทั้งหมด (${visible.length})`} ${icon("arrow-right")}`;
    more.setAttribute("aria-label", expanded ? "แสดงกิจกรรมน้อยลง" : `ดูกิจกรรมทั้งหมด (${visible.length})`);
    more.setAttribute("aria-expanded", String(expanded));
  }

  async function refresh() {
    if (loading || !root.isConnected) return;
    loading = true;
    result.setAttribute("aria-busy", "true");
    try {
      const params = new URLSearchParams({ templeId, revision });
      const payload = await requestJson(`/api/temple-activities?${params}`);
      if (!root.isConnected || root.dataset.templeId !== templeId) return;
      if (!payload.ok || (!payload.unchanged && !Array.isArray(payload.events))) throw new Error("Invalid activity response");
      const hadFailed = failed;
      failed = false;
      if (!payload.unchanged) { events = payload.events; revision = payload.revision; received = true; render(); }
      else if (hadFailed) render();
    } catch {
      failed = true;
      render();
    } finally { loading = false; result.setAttribute("aria-busy", "false"); }
  }

  root.querySelectorAll("[data-activity-period]").forEach((button) => button.addEventListener("click", () => {
    period = button.dataset.activityPeriod;
    expanded = false;
    root.querySelectorAll("[data-activity-period]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    render();
  }));
  more.addEventListener("click", () => { expanded = !expanded; render(); });
  void refresh();
  startContentRefresh(refresh);
});
