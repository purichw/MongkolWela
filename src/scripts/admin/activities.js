import { safeActivityImageUrl, validateActivity } from "../../lib/temple-activities.js";
import { activityIsVisible, activityPhase, activityPhaseLabel } from "../../lib/admin-activity-list.js";
import { sitePlaceholderImage } from "../../lib/image-placeholder.js";
import { createActivityList } from "./activity-list.js";
import { activityFormMarkup, connectActivityTabs, activityErrorField, activityHistory } from "./activity-form-view.js";
import { adminIcon as icon } from "./design.js";

export function createActivityEditor({ state, $, api, escapeHtml: esc, setTitle, setTopActions, setStatus, uploadMedia }) {
  let events = [];
  let loaded = false;
  let loading = false;
  let error = "";
  let editing = null;
  let dirty = false;
  let busy = false;
  let activeTab = "general";
  const active = () => state.section === "dates";
  const catalog = () => state.templeCatalog || [];
  const list = createActivityList({ state, escapeHtml: esc, open, archive, isBusy: () => busy });

  async function load() {
    if (loading || busy) return;
    loading = true; error = ""; render();
    try { events = (await api("/api/admin/activities")).events; loaded = true; }
    catch (cause) { error = cause.message; }
    finally { loading = false; if (active()) render(); }
  }

  function canLeave() {
    if (busy) return false;
    if (dirty && !window.confirm("มีการแก้ไขกิจกรรมที่ยังไม่บันทึก ต้องการออกจากการแก้ไขหรือไม่?")) return false;
    editing = null; dirty = false;
    return true;
  }

  function open(event = {}) {
    if (busy) return;
    editing = { title: "", templeId: "", type: "ceremony", status: "draft", timeMode: "unknown", ...event };
    dirty = !event.id && Boolean(event.title);
    activeTab = "general";
    render(); window.scrollTo(0, 0);
    $("#activity-title")?.focus({ preventScroll: true });
  }

  async function archive(items) {
    busy = true;
    let saved = 0;
    const errors = [];
    const root = $(".mw-activities-list");
    root?.setAttribute("aria-busy", "true");
    root?.querySelectorAll("button, input, select").forEach(control => { control.disabled = true; });
    $("[data-activity-list-feedback]").textContent = "กำลังเก็บกิจกรรมเข้าคลัง…";
    try {
      for (const event of items) {
        try {
          const payload = await api("/api/admin/activities", { method: "POST", body: JSON.stringify({ id: event.id, expectedVersion: event.version, event: { ...event, status: "archived" } }) });
          events = events.map(item => item.id === event.id ? payload.event : item);
          saved += 1;
        } catch (cause) { errors.push(`${event.title}: ${cause.message}`); }
      }
    } finally { busy = false; }
    return { events, saved, errors };
  }

  function renderHeader() {
    const title = editing ? editing.id ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม" : "กิจกรรมและงานบุญ";
    setTitle(title, "จัดการเนื้อหา");
    $(".mw-admin-main").classList.add("is-activity-view");
    $(".mw-admin-main").classList.toggle("is-activity-editing", Boolean(editing));
    $("#adminDescription").textContent = editing ? "" : "จัดการกิจกรรม งานบุญ และพุทธศาสนพิธีต่าง ๆ ที่จะแสดงบนเว็บไซต์";
    setTopActions("");
    const actions = editing ? `<button class="mw-admin-btn" type="button" data-activity-view hidden>${icon("external-link")}ดูหน้าเว็บไซต์</button><button class="mw-admin-btn" type="button" data-activity-header-save>${icon("save")}<span>บันทึกฉบับร่าง</span></button><button class="mw-admin-btn mw-admin-btn-primary" type="button" data-activity-publish>${icon("upload")}เผยแพร่</button>` : `<button class="mw-admin-btn" type="button" data-activity-reload ${loading ? "disabled" : ""}>${icon("rotate-ccw")}โหลดรายการล่าสุด</button><button class="mw-admin-btn mw-admin-btn-primary" type="button" data-activity-new ${!state.secondaryReady || !catalog().length || loading ? "disabled" : ""}>${icon("plus")}เพิ่มกิจกรรม</button>`;
    $(".mw-admin-header-actions").insertAdjacentHTML("beforeend", `<div class="mw-activity-header-actions" data-activity-header>${actions}</div>`);
    if (editing) {
      $("#adminTitle").innerHTML = `<button class="mw-admin-btn mw-admin-btn-icon mw-activity-header-back" type="button" data-activity-back aria-label="กลับรายการ">${icon("arrow-left")}</button><span>${title}</span><span class="mw-activity-badge" data-activity-heading-status></span>`;
    }
    $("[data-activity-new]")?.addEventListener("click", () => open());
    $("[data-activity-reload]")?.addEventListener("click", load);
  }

  function renderForm() {
    $("#adminContent").innerHTML = activityFormMarkup(editing, catalog(), esc);
    const form = $("#activity-form");
    const tabs = connectActivityTabs(form, activeTab, key => { activeTab = key; });
    const upload = $("[data-activity-upload]", form);
    const imageFeedback = $("[data-activity-image-feedback]", form);
    const canUpload = Boolean(uploadMedia && state.media?.provider && state.media[state.media.provider]?.enabled);
    const controls = () => [...form.querySelectorAll("button, input, select, textarea"), ...document.querySelectorAll("[data-activity-header] button, .mw-activity-header-back")];
    $("[data-activity-upload-note]", form).textContent = canUpload ? "JPG, PNG, WebP หรือ AVIF ไม่เกิน 8 MB · ภาพแนวนอน 16:9" : "ยังไม่ได้ตั้งค่าระบบอัปโหลด สามารถระบุลิงก์รูปภาพได้";

    function previewImage() {
      const image = $("[data-activity-preview]", form);
      image.src = safeActivityImageUrl(form.elements.imageUrl.value) || sitePlaceholderImage;
      image.alt = form.elements.imageAlt.value;
      $("[data-activity-image-remove]", form).hidden = !form.elements.imageUrl.value;
    }
    function unlockControls() {
      controls().forEach(control => { control.disabled = false; });
      upload.disabled = !canUpload;
      form.setAttribute("aria-busy", "false");
    }
    function lockControls() {
      controls().forEach(control => { control.disabled = true; });
      form.setAttribute("aria-busy", "true");
    }
    function updateHeader() {
      const status = $("[data-activity-heading-status]");
      status.textContent = activityPhaseLabel(editing); status.dataset.status = activityPhase(editing);
      $("[data-activity-header-save] span:not(.mw-admin-icon)").textContent = editing.status === "draft" ? "บันทึกฉบับร่าง" : "บันทึกการเปลี่ยนแปลง";
      $("[data-activity-header-save]").classList.toggle("mw-admin-btn-primary", activityIsVisible(editing));
      $("[data-activity-publish]").hidden = !["draft", "archived"].includes(editing.status);
      const persisted = events.find(item => item.id === editing.id);
      const url = catalog().find(item => item.key === persisted?.templeId)?.detailUrl;
      $("[data-activity-view]").hidden = !persisted || !activityIsVisible(persisted) || !url;
      $("[data-activity-save] span:not(.mw-admin-icon)", form).textContent = activityIsVisible(editing) ? "บันทึกและเผยแพร่กิจกรรม" : "บันทึกกิจกรรม";
    }
    function changed(event) {
      if (!event.target.name) return;
      dirty = true;
      editing = { ...editing, ...Object.fromEntries(new FormData(form)) };
      event.target.removeAttribute("aria-invalid");
      $("#activity-feedback", form).textContent = "มีการเปลี่ยนแปลงที่ยังไม่บันทึก";
      $("#activity-feedback", form).className = "";
      $("[data-activity-length]", form).textContent = `${editing.description.length}/4000`;
      if (["imageUrl", "imageAlt"].includes(event.target.name)) { imageFeedback.textContent = ""; previewImage(); }
      if (event.target.name === "timeMode") $("[data-activity-times]", form).hidden = editing.timeMode !== "timed";
      if (event.target.name === "status") {
        $("[data-activity-status-note]", form).hidden = !["postponed", "cancelled"].includes(editing.status);
      }
      if (["status", "startDate", "endDate", "timeMode", "startTime", "endTime"].includes(event.target.name)) updateHeader();
    }
    form.addEventListener("input", changed);
    form.addEventListener("change", changed);
    $("[data-activity-preview]", form).addEventListener("error", event => {
      if (event.target.getAttribute("src") === sitePlaceholderImage) return;
      event.target.src = sitePlaceholderImage;
      imageFeedback.textContent = "โหลดภาพตัวอย่างไม่ได้ โปรดตรวจสอบลิงก์รูปภาพ";
    });
    $("[data-activity-change-image]", form).addEventListener("click", () => {
      tabs.select("media");
      if (canUpload) upload.click();
      else form.elements.imageUrl.focus();
    });
    $("[data-activity-image-remove]", form).addEventListener("click", () => {
      form.elements.imageUrl.value = ""; form.elements.imageAlt.value = "";
      editing = { ...editing, imageUrl: "", imageAlt: "" }; dirty = true;
      imageFeedback.textContent = "นำภาพออกจากฉบับแก้ไขแล้ว กรุณาบันทึกกิจกรรม";
      previewImage();
    });
    upload.addEventListener("change", async () => {
      const file = upload.files?.[0];
      if (!file || busy || !canUpload) return;
      if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 8 * 1024 * 1024) {
        imageFeedback.textContent = "เลือกรูป JPG, PNG, WebP หรือ AVIF ขนาดไม่เกิน 8 MB"; upload.value = ""; return;
      }
      busy = true; lockControls(); imageFeedback.textContent = "กำลังอัปโหลดรูปภาพ…";
      try {
        const url = safeActivityImageUrl(await uploadMedia(file, `activity-${editing.id || "draft"}-${Date.now()}`));
        if (!url) throw new Error("ระบบอัปโหลดไม่ได้ส่งกลับลิงก์รูปภาพที่รองรับ");
        form.elements.imageUrl.value = url; editing = { ...editing, imageUrl: url }; dirty = true;
        imageFeedback.textContent = "อัปโหลดแล้ว กรุณาบันทึกกิจกรรมเพื่อใช้ภาพนี้"; previewImage();
      } catch (cause) { imageFeedback.textContent = cause.message; }
      finally { busy = false; upload.value = ""; unlockControls(); }
    });
    previewImage(); unlockControls(); updateHeader();
    document.querySelectorAll("[data-activity-back]").forEach(button => button.addEventListener("click", () => { if (canLeave()) { render(); list.restorePosition(); } }));
    $("[data-activity-header-save]").addEventListener("click", () => form.requestSubmit());
    $("[data-activity-publish]").addEventListener("click", () => {
      form.elements.status.value = "published";
      form.elements.status.dispatchEvent(new Event("change", { bubbles: true }));
      form.requestSubmit();
    });
    $("[data-activity-view]").addEventListener("click", () => {
      const persisted = events.find(item => item.id === editing.id);
      const url = catalog().find(item => item.key === persisted?.templeId)?.detailUrl;
      if (url) window.open(`${url}#temple-activities-heading`, "_blank", "noopener");
    });
    form.addEventListener("submit", async event => {
      event.preventDefault(); if (busy) return;
      const feedback = $("#activity-feedback", form);
      const values = Object.fromEntries(new FormData(form));
      try {
        const input = validateActivity(values, { templeIds: new Set(catalog().map(item => item.key)) });
        const persisted = events.find(item => item.id === editing.id);
        if (persisted && activityIsVisible(persisted) && !activityIsVisible(input) && !window.confirm("การบันทึกสถานะนี้จะนำกิจกรรมออกจากหน้าเว็บไซต์ ต้องการดำเนินการต่อหรือไม่?")) return;
        busy = true; lockControls(); feedback.textContent = "กำลังบันทึกกิจกรรม…"; feedback.className = "";
        const payload = await api("/api/admin/activities", { method: "POST", body: JSON.stringify({ id: editing.id, expectedVersion: editing.version, event: input }) });
        editing = payload.event;
        events = [...events.filter(item => item.id !== editing.id), editing]; dirty = false;
        feedback.textContent = activityIsVisible(editing) ? "เผยแพร่กิจกรรมแล้ว" : "บันทึกแล้ว · ไม่แสดงบนหน้าวัด";
        $("[data-activity-history]", form).innerHTML = activityHistory(editing, esc);
        updateHeader(); setStatus(feedback.textContent, "ok");
      } catch (cause) {
        feedback.textContent = cause.message; feedback.className = "is-error";
        if (cause.status === 409) feedback.textContent += " (ข้อความที่กรอกยังอยู่ในฟอร์ม)";
        else tabs.revealField(activityErrorField(values, cause.message));
      } finally { busy = false; unlockControls(); }
    });
  }

  function render() {
    if (!active() || busy) return;
    renderHeader();
    if (editing) return renderForm();
    if (loading) { $("#adminContent").innerHTML = '<div class="mw-activity-empty" role="status"><span class="mw-activity-loading"></span><h2>กำลังโหลดกิจกรรม…</h2></div>'; return; }
    if (error) { $("#adminContent").innerHTML = `<div class="mw-activity-empty" role="alert">${icon("info")}<h2>โหลดกิจกรรมไม่สำเร็จ</h2><p>${esc(error)}</p><button class="mw-admin-btn" type="button" data-activity-retry>${icon("rotate-ccw")}ลองอีกครั้ง</button></div>`; $("[data-activity-retry]").addEventListener("click", load); return; }
    if (!loaded) { void load(); return; }
    list.render(events);
  }
  return { render, canLeave, isDirty: () => dirty, isBusy: () => busy };
}
