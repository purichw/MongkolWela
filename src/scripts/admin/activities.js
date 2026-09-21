import { ACTIVITY_TYPES, ACTIVITY_STATUSES, TIME_MODES, bangkokToday, activityDateLabel, activityIsPast, safeActivityImageUrl, validateActivity } from "../../lib/temple-activities.js";

export function createActivityEditor({ state, $, api, escapeHtml: esc, setTitle, setTopActions, setStatus, uploadMedia }) {
  let events = [];
  let loaded = false;
  let loading = false;
  let error = "";
  let editing = null;
  let dirty = false;
  let busy = false;
  let search = "";
  let filter = "active";
  let limit = 20;
  const active = () => state.section === "dates";
  const catalog = () => state.templeCatalog || [];
  const templeName = (id) => catalog().find((item) => item.key === id)?.temple.name || "สถานที่ไม่เปิดใช้งาน";
  const options = (values, selected) => Object.entries(values).map(([key, label]) => `<option value="${esc(key)}" ${key === selected ? "selected" : ""}>${esc(label)}</option>`).join("");

  async function load() {
    if (loading) return;
    loading = true;
    error = "";
    render();
    try { events = (await api("/api/admin/activities")).events; loaded = true; }
    catch (cause) { error = cause.message; }
    finally { loading = false; if (active()) render(); }
  }

  function canLeave() {
    if (busy) return false;
    if (dirty && !window.confirm("มีการแก้ไขกิจกรรมที่ยังไม่บันทึก ต้องการออกจากการแก้ไขหรือไม่?")) return false;
    editing = null;
    dirty = false;
    return true;
  }

  function open(event = {}) {
    editing = { title: "", templeId: "", type: "ceremony", status: "draft", timeMode: "unknown", ...event };
    dirty = false;
    render();
    $("#activity-title")?.focus();
  }

  function field(label, key, { type = "text", max = 2000, required = false, textarea = false } = {}) {
    return `<label>${label}${textarea ? `<textarea name="${key}" maxlength="${max}" rows="3">${esc(editing[key] || "")}</textarea>` : `<input ${key === "title" ? 'id="activity-title"' : ""} name="${key}" type="${type}" maxlength="${max}" ${required ? "required" : ""} value="${esc(editing[key] || "")}" ${key === "verifiedAt" ? `max="${bangkokToday()}"` : ""}>`}</label>`;
  }

  function renderForm() {
    const missingTemple = editing.templeId && !catalog().some((item) => item.key === editing.templeId);
    $("#adminContent").innerHTML = `<form class="mw-activity-editor" id="activity-form">
      <div class="mw-activity-editor-heading"><h2>${editing.id ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}</h2><span>${editing.id ? `แก้ไขล่าสุด ${esc(new Date(editing.updatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }))}` : "ฉบับร่างใหม่"}</span></div>
      <fieldset><legend>ข้อมูลกิจกรรม</legend>
        ${field("ชื่อกิจกรรม", "title", { max: 160, required: true })}
        <label>วัด / สถานที่<select name="templeId" required><option value="">เลือกสถานที่</option>${missingTemple ? `<option value="${esc(editing.templeId)}" selected>สถานที่เดิมไม่เปิดใช้งาน</option>` : ""}${catalog().map((item) => `<option value="${esc(item.key)}" ${item.key === editing.templeId ? "selected" : ""}>${esc(`${item.temple.name} · ${item.temple.province} (${item.collectionLabel})`)}</option>`).join("")}</select></label>
        <div class="mw-activity-fields"><label>ประเภท<select name="type">${options(ACTIVITY_TYPES, editing.type)}</select></label><label>สถานะ<select name="status">${options(ACTIVITY_STATUSES, editing.status)}</select></label></div>
        <div data-activity-status-note ${["postponed", "cancelled"].includes(editing.status) ? "" : "hidden"}>${field("รายละเอียดการเลื่อน / ยกเลิก", "statusNote", { max: 500, textarea: true })}</div>
      </fieldset>
      <fieldset><legend>ภาพกิจกรรม <small>ไม่บังคับ</small></legend>
        ${field("ลิงก์รูปภาพ", "imageUrl")}
        ${field("คำอธิบายภาพ", "imageAlt", { max: 200 })}
        <div class="mw-activity-photo"><img data-activity-preview alt="" hidden><div>
          <label>อัปโหลดรูปภาพ<input type="file" data-activity-upload accept="image/jpeg,image/png,image/webp,image/avif"></label>
          <p data-activity-upload-note></p><p data-activity-image-feedback role="status"></p>
          <button class="mw-admin-btn" type="button" data-activity-image-remove>นำภาพออก</button>
        </div></div>
      </fieldset>
      <fieldset><legend>กำหนดการ <small>เวลาไทย</small></legend>
        <div class="mw-activity-fields">${field("วันเริ่ม", "startDate", { type: "date" })}${field("วันสิ้นสุด (ถ้ามี)", "endDate", { type: "date" })}</div>
        <label>เวลา<select name="timeMode">${options(TIME_MODES, editing.timeMode)}</select></label>
        <div class="mw-activity-fields" data-activity-times ${editing.timeMode === "timed" ? "" : "hidden"}>${field("เวลาเริ่ม", "startTime", { type: "time" })}${field("เวลาสิ้นสุด (ถ้ามี)", "endTime", { type: "time" })}</div>
        ${field("จุดจัดงานภายในสถานที่", "venue", { max: 200 })}
      </fieldset>
      <fieldset><legend>การเข้าร่วม</legend>
        ${field("รายละเอียดกิจกรรม", "description", { textarea: true, max: 4000 })}
        ${field("เงื่อนไขการเข้าร่วม", "participation", { textarea: true })}
        <div class="mw-activity-fields">${field("ค่าใช้จ่าย (ถ้ามี)", "cost", { max: 200 })}${field("ลิงก์ลงทะเบียน (ถ้ามี)", "registrationUrl", { type: "url" })}</div>
        ${field("สิ่งที่ต้องเตรียม", "preparation", { textarea: true })}
      </fieldset>
      <fieldset><legend>แหล่งประกาศ</legend>
        ${field("ลิงก์ประกาศจากผู้จัด", "sourceUrl", { type: "url" })}
        ${field("วันที่ตรวจสอบประกาศ", "verifiedAt", { type: "date" })}
      </fieldset>
      <p id="activity-feedback" role="status" aria-live="polite"></p>
      <div class="mw-activity-editor-actions"><button class="mw-admin-btn" type="button" data-activity-back>กลับรายการ</button><button class="mw-admin-btn mw-admin-btn-primary" type="submit" data-activity-save>บันทึกกิจกรรม</button></div>
    </form>`;
    const form = $("#activity-form");
    const upload = $("[data-activity-upload]", form);
    const imageFeedback = $("[data-activity-image-feedback]", form);
    const canUpload = Boolean(uploadMedia && state.media?.provider && state.media[state.media.provider]?.enabled);
    $("[data-activity-upload-note]", form).textContent = canUpload ? "JPG, PNG, WebP หรือ AVIF ขนาดไม่เกิน 8 MB" : "ยังไม่ได้ตั้งค่าระบบอัปโหลด สามารถระบุลิงก์รูปภาพได้";
    function previewImage() {
      const image = $("[data-activity-preview]", form);
      const url = safeActivityImageUrl(form.elements.imageUrl.value);
      image.hidden = !url;
      if (url) image.src = url;
      else image.removeAttribute("src");
      image.alt = form.elements.imageAlt.value;
      $("[data-activity-image-remove]", form).hidden = !form.elements.imageUrl.value;
    }
    function unlockControls() {
      form.querySelectorAll("button, input, select, textarea").forEach((control) => { control.disabled = false; });
      upload.disabled = !canUpload;
    }
    $("[data-activity-preview]", form).addEventListener("error", (event) => {
      event.target.hidden = true;
      imageFeedback.textContent = "โหลดภาพตัวอย่างไม่ได้ โปรดตรวจสอบลิงก์รูปภาพ";
    });
    $("[data-activity-image-remove]", form).addEventListener("click", () => {
      form.elements.imageUrl.value = "";
      form.elements.imageAlt.value = "";
      editing = { ...editing, imageUrl: "", imageAlt: "" };
      dirty = true;
      imageFeedback.textContent = "นำภาพออกจากฉบับแก้ไขแล้ว กรุณาบันทึกกิจกรรม";
      previewImage();
    });
    upload.addEventListener("change", async () => {
      const file = upload.files?.[0];
      if (!file || busy || !canUpload) return;
      if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 8 * 1024 * 1024) {
        imageFeedback.textContent = "เลือกรูป JPG, PNG, WebP หรือ AVIF ขนาดไม่เกิน 8 MB";
        upload.value = "";
        return;
      }
      busy = true;
      form.querySelectorAll("button, input, select, textarea").forEach((control) => { control.disabled = true; });
      imageFeedback.textContent = "กำลังอัปโหลดรูปภาพ…";
      try {
        const url = safeActivityImageUrl(await uploadMedia(file, `activity-${editing.id || "draft"}-${Date.now()}`));
        if (!url) throw new Error("ระบบอัปโหลดไม่ได้ส่งกลับลิงก์รูปภาพที่รองรับ");
        form.elements.imageUrl.value = url;
        editing = { ...editing, imageUrl: url };
        dirty = true;
        imageFeedback.textContent = "อัปโหลดแล้ว กรุณาบันทึกกิจกรรมเพื่อใช้ภาพนี้";
        previewImage();
      } catch (cause) {
        imageFeedback.textContent = cause.message;
      } finally {
        busy = false;
        upload.value = "";
        unlockControls();
      }
    });
    previewImage();
    unlockControls();
    form.addEventListener("input", (event) => {
      dirty = true;
      editing = { ...editing, ...Object.fromEntries(new FormData(form)) };
      if (["imageUrl", "imageAlt"].includes(event.target.name)) {
        imageFeedback.textContent = "";
        previewImage();
      }
    });
    form.addEventListener("change", (event) => {
      dirty = true;
      editing = { ...editing, ...Object.fromEntries(new FormData(form)) };
      if (event.target.name === "timeMode") $("[data-activity-times]", form).hidden = form.elements.timeMode.value !== "timed";
      if (event.target.name === "status") {
        $("[data-activity-status-note]", form).hidden = !["postponed", "cancelled"].includes(form.elements.status.value);
        updateSaveLabel();
      }
    });
    function updateSaveLabel() {
      const button = $("[data-activity-save]", form);
      const label = ["published", "postponed", "cancelled"].includes(form.elements.status.value) ? "บันทึกและเผยแพร่กิจกรรม" : "บันทึกกิจกรรม";
      if (button.textContent !== label) button.textContent = label;
    }
    updateSaveLabel();
    $("[data-activity-back]", form).addEventListener("click", () => { if (canLeave()) render(); });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      const feedback = $("#activity-feedback", form);
      try {
        const input = validateActivity(Object.fromEntries(new FormData(form)), { templeIds: new Set(catalog().map((item) => item.key)) });
        busy = true;
        form.querySelectorAll("button, input, select, textarea").forEach((control) => { control.disabled = true; });
        feedback.textContent = "กำลังบันทึกกิจกรรม…";
        feedback.className = "";
        const payload = await api("/api/admin/activities", { method: "POST", body: JSON.stringify({ id: editing.id, expectedVersion: editing.version, event: input }) });
        editing = payload.event;
        events = [...events.filter((item) => item.id !== editing.id), editing];
        dirty = false;
        feedback.textContent = ["draft", "archived"].includes(editing.status) ? "บันทึกแล้ว · ไม่แสดงบนหน้าวัด" : "เผยแพร่กิจกรรมแล้ว";
        setStatus(feedback.textContent, "ok");
      } catch (cause) {
        feedback.textContent = cause.message;
        feedback.className = "is-error";
        // Keep all entered fields on failure, including a conflicting version.
        if (cause.status === 409) feedback.textContent += " (ข้อความที่กรอกยังอยู่ในฟอร์ม)";
      } finally {
        busy = false;
        unlockControls();
      }
    });
  }

  function renderRows() {
    const results = events.filter((event) => {
      const past = activityIsPast(event);
      const matches = filter === "all" || (filter === "active" ? ["published", "postponed", "cancelled"].includes(event.status) && !past : filter === "past" ? past && !["draft", "archived"].includes(event.status) : event.status === filter);
      return matches && `${event.title} ${templeName(event.templeId)}`.toLocaleLowerCase("th").includes(search.toLocaleLowerCase("th"));
    }).sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
    $("[data-activity-count]").textContent = `${results.length} กิจกรรม`;
    $("[data-activity-rows]").innerHTML = results.length ? results.slice(0, limit).map((event) => `<article class="mw-activity-row"><div><span class="mw-activity-badge" data-status="${esc(event.status)}">${esc(ACTIVITY_STATUSES[event.status])}${activityIsPast(event) && !["draft", "archived"].includes(event.status) ? " · ผ่านแล้ว" : ""}</span><h2>${esc(event.title)}</h2><p>${esc(templeName(event.templeId))}</p></div><time>${esc(activityDateLabel(event))}</time><button class="mw-admin-btn" type="button" data-edit-activity="${esc(event.id)}" aria-label="แก้ไข ${esc(event.title)}">แก้ไข</button></article>`).join("") : '<p class="mw-activity-empty">ไม่พบกิจกรรมในรายการนี้</p>';
    $("[data-activity-more]").hidden = results.length <= limit;
    $("[data-activity-rows]").querySelectorAll("[data-edit-activity]").forEach((button) => button.addEventListener("click", () => open(events.find((event) => event.id === button.dataset.editActivity))));
  }

  function render() {
    if (!active()) return;
    setTitle("กิจกรรมและงานบุญ", "จัดการเนื้อหา");
    setTopActions(editing ? "" : `<button class="mw-admin-btn" type="button" data-activity-reload ${loading ? "disabled" : ""}>โหลดรายการล่าสุด</button><button class="mw-admin-btn mw-admin-btn-primary" type="button" data-activity-new ${!state.secondaryReady || !catalog().length || loading ? "disabled" : ""}>เพิ่มกิจกรรม</button>`);
    $("[data-activity-new]")?.addEventListener("click", () => open());
    $("[data-activity-reload]")?.addEventListener("click", load);
    if (editing) return renderForm();
    if (loading) { $("#adminContent").innerHTML = '<p role="status">กำลังโหลดกิจกรรม…</p>'; return; }
    if (error) { $("#adminContent").innerHTML = `<p role="alert">${esc(error)}</p>`; return; }
    if (!loaded) { void load(); return; }
    $("#adminContent").innerHTML = `<div class="mw-activity-toolbar"><label>ค้นหากิจกรรม<input type="search" data-activity-search value="${esc(search)}" placeholder="ชื่อกิจกรรมหรือวัด"></label><label>รายการ<select data-activity-filter>${options({ active: "กำลังจะมาถึง", draft: "ฉบับร่าง", past: "ที่ผ่านมา", archived: "คลัง", all: "ทั้งหมด" }, filter)}</select></label><p data-activity-count role="status"></p></div><div data-activity-rows></div><button class="mw-admin-btn" type="button" data-activity-more hidden>ดูเพิ่มเติม</button>`;
    $("[data-activity-search]").addEventListener("input", (event) => { search = event.target.value; limit = 20; renderRows(); });
    $("[data-activity-filter]").addEventListener("change", (event) => { filter = event.target.value; limit = 20; renderRows(); });
    $("[data-activity-more]").addEventListener("click", () => { limit += 20; renderRows(); });
    renderRows();
  }
  return { render, canLeave, isDirty: () => dirty, isBusy: () => busy };
}
