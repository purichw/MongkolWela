import { validateHomepageContent } from "../../lib/homepage-content.js";
import { validateNavigation } from "../../lib/site-navigation.js";

export function createAdminPublishing({ queryAll, $, api, sleep, state, setStatus, renderAdmin }) {
const PUBLISH_VERIFY_TIMEOUT_MS = 90000;

const PUBLISH_VERIFY_INTERVAL_MS = 600;

function setPublishControlsDisabled(disabled) {
  const dismiss = $('[data-action="dismiss-publish-progress"]');
  if (dismiss) dismiss.hidden = disabled;
  queryAll('[data-action="publish"]').forEach((button) => {
    button.disabled = disabled;
    button.setAttribute("aria-busy", disabled ? "true" : "false");
  });
}

function setPublishProgress(progress, title, detail = "") {
  const panel = $("#adminPublishProgress");
  if (!panel) return;
  const percent = Math.max(0, Math.min(100, Math.round(progress)));
  panel.hidden = false;
  panel.dataset.active = "true";
  $("[data-publish-progress-title]", panel).textContent = title;
  $("[data-publish-progress-value]", panel).textContent = `${percent}%`;
  $("[data-publish-progress-detail]", panel).textContent = detail;
  $("[data-publish-progress-bar]", panel).style.width = `${percent}%`;
}

function hidePublishProgress() {
  const panel = $("#adminPublishProgress");
  if (!panel) return;
  panel.hidden = true;
  panel.dataset.active = "false";
}

function publishedContentMatches(expected, actual) {
  if (!expected || !actual) return false;
  return Boolean(expected.publishedAt && actual.publishedAt === expected.publishedAt);
}

async function waitForPublishedContent(expectedContent) {
  const startedAt = Date.now();
  let attempt = 0;
  while (Date.now() - startedAt < PUBLISH_VERIFY_TIMEOUT_MS) {
    attempt += 1;
    const elapsed = Date.now() - startedAt;
    const progress = Math.min(96, 48 + (elapsed / PUBLISH_VERIFY_TIMEOUT_MS) * 48);
    setPublishProgress(
      progress,
      "กำลังตรวจหน้าเว็บจริง",
      attempt === 1 ? "กำลังอ่านข้อมูล live หลัง publish" : `รอตรวจซ้ำครั้งที่ ${attempt}`,
    );
    const payload = await api(`/api/admin/content?verify=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (publishedContentMatches(expectedContent, payload.content)) {
      state.baseRevision = payload.revision;
      return payload.content;
    }
    await sleep(PUBLISH_VERIFY_INTERVAL_MS);
  }
  throw new Error("Publish สำเร็จแล้ว แต่ยังตรวจไม่พบเวอร์ชันใหม่บนหน้าเว็บ");
}

async function publish() {
  if (state.publishing) return;
  state.publishing = true;
  const submitted = structuredClone(state.content);
  const draftSignature = JSON.stringify(submitted);
  setPublishControlsDisabled(true);
  try {
    validateHomepageContent(submitted);
    validateNavigation(submitted.navigation);
    setStatus("กำลัง publish...", "info");
    setPublishProgress(8, "กำลังส่งข้อมูล", "กำลังบันทึกข้อมูลใหม่");
    const payload = await api("/api/admin/content", {
      method: "POST",
      body: JSON.stringify({ content: submitted, expectedRevision: state.baseRevision }),
    });
    setPublishProgress(
      payload.meta?.fast ? 52 : 42,
      "บันทึก publish แล้ว",
      payload.meta?.fast ? "กำลังตรวจว่า visitor อ่านข้อมูลใหม่ได้แล้ว" : "กำลังตรวจข้อมูล live",
    );
    const verifiedContent = await waitForPublishedContent(payload.content);
    state.publishedTempleRecords = structuredClone(verifiedContent.temples?.records || {});
    state.publishedTempleKeys = new Set(state.templeCatalog.filter(record => {
      const published = state.publishedTempleRecords[record.key];
      return (record.source !== "admin" || Boolean(published)) && published?.status !== "deleted" && published?.enabled !== false;
    }).map(record => record.key));
    const editedDuringPublish = JSON.stringify(state.content) !== draftSignature;
    if (!editedDuringPublish) state.content = verifiedContent;
    state.dirty = editedDuringPublish;
    setPublishProgress(100, "หน้าเว็บอัปเดตแล้ว", "visitor จะเห็นข้อมูลเวอร์ชันล่าสุดเมื่อเปิดหรือรีโหลดหน้า");
    setStatus(editedDuringPublish ? "เผยแพร่แล้ว ยังมีการแก้ไขใหม่ที่ไม่ได้เผยแพร่" : "เผยแพร่แล้ว", "ok");
    renderAdmin();
    setPublishControlsDisabled(true);
    setTimeout(() => {
      hidePublishProgress();
      if (!state.publishing) setPublishControlsDisabled(false);
    }, 2400);
  } catch (error) {
    setStatus(error.message, "error");
    setPublishProgress(100, "Publish มีปัญหา", error.message);
  } finally {
    state.publishing = false;
    setPublishControlsDisabled(false);
  }
}

return { setPublishControlsDisabled, setPublishProgress, hidePublishProgress, publishedContentMatches, waitForPublishedContent, publish };
}
