import { requestJson } from "./request.js";
import { startContentRefresh } from "./content-refresh.js";
import { ACTIVITY_TYPES, activityDateLabel, safeActivityUrl } from "../lib/temple-activities.js";

const esc = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

document.querySelectorAll("[data-temple-activities]").forEach((root) => {
  const result = root.querySelector("[data-activity-result]");
  const more = root.querySelector("[data-activities-more]");
  let events = [];
  let revision = "";
  let period = "upcoming";
  let expanded = false;
  let loading = false;
  let failed = false;

  function row(event) {
    const changed = ["postponed", "cancelled"].includes(event.status);
    const status = event.status === "postponed" ? "เลื่อนกำหนดการ" : event.status === "cancelled" ? "ยกเลิก" : event.past ? "สิ้นสุดแล้ว" : "กำลังจะมาถึง";
    const time = event.timeMode === "timed" ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""} น.` : event.timeMode === "allDay" ? "ตลอดวัน" : "รอประกาศเวลา";
    const source = safeActivityUrl(event.sourceUrl);
    const registration = safeActivityUrl(event.registrationUrl);
    return `<article class="temple-activity" data-status="${esc(event.status)}">
      <div class="temple-activity-date"><time datetime="${esc(event.startDate)}"><strong>${esc(event.startDate?.slice(8))}</strong><span>${esc(new Intl.DateTimeFormat("th-TH", { month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${event.startDate}T12:00:00+07:00`)))}</span></time></div>
      <div class="temple-activity-body"><div class="temple-activity-meta"><span class="temple-activity-status">${status}</span><span>${esc(ACTIVITY_TYPES[event.type])}</span></div>
        <h3>${esc(event.title)}</h3>
        <p class="temple-activity-schedule">${event.status === "postponed" ? "กำหนดเดิม: " : ""}${esc(activityDateLabel(event))} · ${esc(time)}</p>
        ${event.venue ? `<p class="temple-activity-venue">${esc(event.venue)}</p>` : ""}
        ${changed ? `<p class="temple-activity-notice">${esc(event.statusNote)}</p>` : ""}
        <details data-activity-details="${esc(event.id)}"><summary>รายละเอียดกิจกรรม</summary><div class="temple-activity-detail">
          ${event.description ? `<p>${esc(event.description)}</p>` : ""}
          <dl>${[["การเข้าร่วม", event.participation], ["ค่าใช้จ่าย", event.cost], ["สิ่งที่ต้องเตรียม", event.preparation]].filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
          <div class="temple-activity-links">${source ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">ประกาศจากผู้จัด ↗</a>` : ""}${registration && !changed && !event.past ? `<a href="${esc(registration)}" target="_blank" rel="noopener noreferrer">ลงทะเบียนกับผู้จัด ↗</a>` : ""}</div>
          <small>ตรวจสอบประกาศ ${esc(activityDateLabel({ startDate: event.verifiedAt }))}</small>
        </div></details>
      </div>
    </article>`;
  }

  function render() {
    const openIds = new Set([...root.querySelectorAll("details[open]")].map((element) => element.dataset.activityDetails));
    const visible = events.filter((event) => period === "past" ? event.past : !event.past);
    result.innerHTML = visible.length ? visible.slice(0, expanded ? undefined : 3).map(row).join("") : `<p class="temple-activities-empty">${period === "past" ? "ยังไม่มีกิจกรรมที่ผ่านมาในระบบ" : "ยังไม่มีประกาศกิจกรรมที่ยืนยันในระบบ"}</p>`;
    root.querySelectorAll("details").forEach((element) => { element.open = openIds.has(element.dataset.activityDetails); });
    more.hidden = visible.length <= 3;
    more.textContent = expanded ? "แสดงน้อยลง" : `ดูกิจกรรมทั้งหมด (${visible.length})`;
    more.setAttribute("aria-expanded", String(expanded));
  }

  async function refresh() {
    if (loading || !root.isConnected) return;
    loading = true;
    try {
      const params = new URLSearchParams({ templeId: root.dataset.templeId, revision });
      const payload = await requestJson(`/api/temple-activities?${params}`);
      if (!payload.ok || (!payload.unchanged && !Array.isArray(payload.events))) throw new Error("Invalid activity response");
      if (!payload.unchanged) { events = payload.events; revision = payload.revision; render(); }
      else if (failed) render();
      failed = false;
    } catch {
      failed = true;
      more.hidden = true;
      result.innerHTML = '<div class="temple-activities-empty" role="alert"><p>ไม่สามารถโหลดกิจกรรมล่าสุดได้</p><button type="button" data-activities-retry>ลองใหม่</button></div>';
      result.querySelector("[data-activities-retry]").addEventListener("click", refresh);
    } finally { loading = false; result.setAttribute("aria-busy", "false"); }
  }

  root.querySelectorAll("[data-activity-period]").forEach((button) => button.addEventListener("click", () => {
    period = button.dataset.activityPeriod;
    expanded = false;
    root.querySelectorAll("[data-activity-period]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    if (!failed) render();
  }));
  more.addEventListener("click", () => { expanded = !expanded; render(); });
  void refresh();
  startContentRefresh(refresh);
});
