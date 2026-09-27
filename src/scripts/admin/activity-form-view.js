import { ACTIVITY_TYPES, ACTIVITY_STATUSES, TIME_MODES, bangkokToday } from "../../lib/temple-activities.js";
import { adminIcon as icon } from "./design.js";

export const activityTabs = { general: "ข้อมูลทั่วไป", schedule: "กำหนดการ", participation: "การเข้าร่วม", media: "สื่อและภาพ", publication: "การเผยแพร่", history: "ประวัติการแก้ไข" };
export const activityTimestamp = value => value ? new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) : "";

export function activityHistory(event, e) {
  const rows = event.id ? [{ status: event.status, updatedAt: event.updatedAt, updatedBy: event.updatedBy }, ...(event.history || []).slice().reverse()] : [];
  return rows.length ? `<ol class="mw-activity-history">${rows.map((item, index) => `<li><span class="mw-activity-badge" data-status="${e(item.status)}">${e(ACTIVITY_STATUSES[item.status] || item.status)}</span><div><strong>${index ? "ฉบับก่อนหน้า" : "ฉบับปัจจุบัน"}</strong><time>${e(activityTimestamp(item.updatedAt))}</time>${item.updatedBy ? `<small>${e(item.updatedBy)}</small>` : ""}</div></li>`).join("")}</ol>` : '<p class="mw-activity-muted">ยังไม่มีประวัติการบันทึก</p>';
}

export function activityFormMarkup(event, catalog, e) {
  const options = (values, selected) => Object.entries(values).map(([key, label]) => `<option value="${e(key)}" ${key === selected ? "selected" : ""}>${e(label)}</option>`).join("");
  const field = (label, key, { type = "text", max = 2000, required = false, textarea = false, rows = 3 } = {}) => `<label for="activity-${key}">${label}${required ? ' <span class="mw-activity-required" aria-hidden="true">*</span>' : ""}${textarea ? `<textarea id="activity-${key}" name="${key}" maxlength="${max}" rows="${rows}">${e(event[key] || "")}</textarea>` : `<input id="activity-${key}" name="${key}" type="${type}" maxlength="${max}" ${required ? "required" : ""} value="${e(event[key] || "")}" ${key === "verifiedAt" ? `max="${bangkokToday()}"` : ""}>`}</label>`;
  const select = (label, key, values) => `<label for="activity-${key}">${label}<select id="activity-${key}" name="${key}">${options(values, event[key])}</select></label>`;
  const panel = (key, content) => `<section class="mw-activity-form-panel" id="activity-panel-${key}" role="tabpanel" aria-labelledby="activity-tab-${key}" data-activity-panel="${key}" ${key === "general" ? "" : "hidden"}><h2>${activityTabs[key]}</h2>${content}</section>`;
  const missingTemple = event.templeId && !catalog.some(item => item.key === event.templeId);
  return `<form class="mw-activity-editor" id="activity-form" novalidate>
    <div class="mw-activity-editor-tabs" role="tablist" aria-label="ข้อมูลกิจกรรม">${Object.entries(activityTabs).map(([key, label]) => `<button type="button" role="tab" id="activity-tab-${key}" data-activity-tab="${key}" aria-controls="activity-panel-${key}" aria-selected="${key === "general"}" tabindex="${key === "general" ? "0" : "-1"}">${label}</button>`).join("")}</div>
    <div class="mw-activity-editor-layout"><div class="mw-activity-editor-main">
      ${panel("general", `<div class="mw-activity-fields">${field("ชื่อกิจกรรม", "title", { max: 160, required: true })}<label for="activity-templeId">วัด / สถานที่ <span class="mw-activity-required" aria-hidden="true">*</span><select id="activity-templeId" name="templeId" required><option value="">เลือกสถานที่</option>${missingTemple ? `<option value="${e(event.templeId)}" selected>สถานที่เดิมไม่เปิดใช้งาน</option>` : ""}${catalog.map(item => `<option value="${e(item.key)}" ${item.key === event.templeId ? "selected" : ""}>${e(`${item.temple.name} · ${item.temple.province} (${item.collectionLabel})`)}</option>`).join("")}</select></label>${select("ประเภทกิจกรรม", "type", ACTIVITY_TYPES)}${select("สถานะ", "status", ACTIVITY_STATUSES)}</div>${field("รายละเอียดกิจกรรม", "description", { textarea: true, max: 4000, rows: 5 })}<output class="mw-activity-length" for="activity-description" data-activity-length>${(event.description || "").length}/4000</output>`)}
      ${panel("schedule", `<div class="mw-activity-fields">${field("วันเริ่ม", "startDate", { type: "date" })}${field("วันสิ้นสุด (ถ้ามี)", "endDate", { type: "date" })}</div>${select("เวลา (ประเทศไทย)", "timeMode", TIME_MODES)}<div class="mw-activity-fields" data-activity-times ${event.timeMode === "timed" ? "" : "hidden"}>${field("เวลาเริ่ม", "startTime", { type: "time" })}${field("เวลาสิ้นสุด (ถ้ามี)", "endTime", { type: "time" })}</div>${field("จุดจัดงานภายในสถานที่", "venue", { max: 200 })}`)}
      ${panel("participation", `${field("เงื่อนไขการเข้าร่วม", "participation", { textarea: true })}<div class="mw-activity-fields">${field("ค่าใช้จ่าย (ถ้ามี)", "cost", { max: 200 })}${field("ลิงก์ลงทะเบียน (ถ้ามี)", "registrationUrl", { type: "url" })}</div>${field("สิ่งที่ต้องเตรียม", "preparation", { textarea: true })}`)}
      ${panel("media", `${field("ลิงก์รูปภาพ", "imageUrl")}${field("คำอธิบายภาพ", "imageAlt", { max: 200 })}`)}
      ${panel("publication", `${field("ลิงก์ประกาศจากผู้จัด", "sourceUrl", { type: "url" })}${field("วันที่ตรวจสอบประกาศ", "verifiedAt", { type: "date" })}<div data-activity-status-note ${["postponed", "cancelled"].includes(event.status) ? "" : "hidden"}>${field("รายละเอียดการเลื่อน / ยกเลิก", "statusNote", { max: 500, textarea: true })}</div><p class="mw-activity-publication-note">${icon("info")}กิจกรรมที่เผยแพร่ต้องมีวันเริ่ม แหล่งประกาศ และวันที่ตรวจสอบ</p>`)}
      ${panel("history", `<div data-activity-history>${activityHistory(event, e)}</div>`)}
    </div><aside class="mw-activity-photo" aria-label="ภาพปกกิจกรรม"><h2>ภาพปกกิจกรรม</h2><div class="mw-activity-photo-frame"><img data-activity-preview alt=""><button class="mw-admin-btn" type="button" data-activity-change-image>${icon("image")}เปลี่ยนภาพ</button></div><label class="mw-activity-file">อัปโหลดรูปภาพ<input type="file" data-activity-upload accept="image/jpeg,image/png,image/webp,image/avif"></label><p data-activity-upload-note></p><p data-activity-image-feedback role="status"></p><button class="mw-admin-btn mw-activity-image-remove" type="button" data-activity-image-remove>${icon("trash-2")}นำภาพออก</button></aside></div>
    <div class="mw-activity-editor-actions"><p id="activity-feedback" role="status" aria-live="polite"></p><div><button class="mw-admin-btn" type="button" data-activity-back>${icon("arrow-left")}กลับรายการ</button><button class="mw-admin-btn mw-admin-btn-primary" type="submit" data-activity-save>${icon("save")}<span>บันทึกกิจกรรม</span></button></div></div>
  </form>`;
}

export function connectActivityTabs(form, initialTab = "general", onSelect = () => {}) {
  function select(key, focus = false) {
    if (!Object.hasOwn(activityTabs, key)) return;
    form.dataset.tab = key;
    form.querySelectorAll("[data-activity-tab]").forEach(button => {
      const active = button.dataset.activityTab === key;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) { button.focus({ preventScroll: true }); button.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    });
    form.querySelectorAll("[data-activity-panel]").forEach(panel => { panel.hidden = panel.dataset.activityPanel !== key; });
    onSelect(key);
  }
  form.querySelectorAll("[data-activity-tab]").forEach((button, index, buttons) => {
    button.addEventListener("click", () => select(button.dataset.activityTab));
    button.addEventListener("keydown", event => {
      const next = { ArrowRight: (index + 1) % buttons.length, ArrowLeft: (index + buttons.length - 1) % buttons.length, Home: 0, End: buttons.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault(); select(buttons[next].dataset.activityTab, true);
    });
  });
  select(initialTab);
  return { select, revealField(name) {
    const input = form.elements.namedItem(name);
    const panel = input?.closest("[data-activity-panel]");
    if (!panel) return;
    select(panel.dataset.activityPanel);
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", "activity-feedback");
    const target = input.closest(".mw-select") || input;
    requestAnimationFrame(() => target.focus());
  } };
}

export function activityErrorField(input, message) {
  if (!input.title?.trim()) return "title";
  if (/สถานที่/.test(message)) return "templeId";
  if (/ก่อนเผยแพร่/.test(message)) return !input.startDate ? "startDate" : !input.sourceUrl ? "sourceUrl" : "verifiedAt";
  if (/ตรวจสอบ/.test(message)) return "verifiedAt";
  if (/วันสิ้นสุด/.test(message)) return "endDate";
  if (/สิ้นสุด/.test(message)) return "endTime";
  if (/เวลา/.test(message)) return "startTime";
  if (/เลื่อนหรือยกเลิก/.test(message)) return "statusNote";
  if (/รูปภาพ/.test(message)) return "imageUrl";
  if (/ลิงก์/.test(message)) return input.sourceUrl && !/^https?:\/\//.test(input.sourceUrl) ? "sourceUrl" : "registrationUrl";
  return "";
}
