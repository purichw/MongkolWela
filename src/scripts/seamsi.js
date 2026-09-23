import { seamsiCategories, seamsiFortunes } from "./seamsi-data.js";
import { createLocalSeamsiSource, createSeamsiSession } from "../lib/seamsi-session.js";
import { renderIcon } from "../lib/ui-markup.js";

const lifecycle = new AbortController();
let mounted;
const source = createLocalSeamsiSource(seamsiFortunes, {
  randomIndex,
  readLastNumber: () => localStorage.getItem("monkolSeamsiLastNumber"),
  writeLastNumber: number => localStorage.setItem("monkolSeamsiLastNumber", number),
});

function mountSeamsi() {
  const form = document.querySelector("[data-seamsi-form]");
  if (mounted?.form === form) return;
  mounted?.dispose();
  mounted = undefined;
  if (!form) return;

  const root = form.closest(".seamsi-shell");
  const category = form.querySelector("[data-seamsi-category]");
  const question = form.querySelector("[data-seamsi-question]");
  const submit = form.querySelector("[data-seamsi-shake]");
  const buttonLabel = form.querySelector("[data-seamsi-button-label]");
  const validation = form.querySelector("[data-seamsi-validation]");
  const intentNotice = form.querySelector("[data-seamsi-intent-notice]");
  const oracle = root.querySelector("[data-seamsi-oracle]");
  const image = oracle.querySelector(".seamsi-cup-image");
  const stick = oracle.querySelector("[data-seamsi-stick]");
  const fallback = oracle.querySelector("[data-seamsi-art-fallback]");
  const skip = root.querySelector("[data-seamsi-skip]");
  const status = root.querySelector("[data-seamsi-status]");
  const stageTitle = root.querySelector("#seamsi-stage-title");
  const result = root.querySelector("[data-seamsi-result]");
  const reading = result.querySelector("[data-seamsi-reading]");
  const feedback = result.querySelector("[data-seamsi-feedback]");
  const previous = result.querySelector("[data-seamsi-previous]");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  const timers = new Set();
  let currentResult;
  let motionId;
  let initiator;
  let finalizing = false;

  const draft = () => ({
    topicId: category.value,
    topicLabel: seamsiCategories.find(item => item.id === category.value)?.label || "",
    question: question.value,
  });
  const session = createSeamsiSession({ source, initialIntent: draft(), onChange: render });
  const listen = (target, type, listener, options = {}) => target.addEventListener(type, listener, { ...options, signal: events.signal });
  const later = (callback, delay) => {
    const id = window.setTimeout(() => { timers.delete(id); callback(); }, delay);
    timers.add(id);
  };
  const stopMotion = () => {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    oracle.classList.remove("is-shaking");
  };
  const focusResult = () => {
    result.querySelector("#seamsi-result-title")?.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: motion.matches ? "instant" : "smooth", block: "start" });
  };

  function render(state) {
    const active = state.active;
    const busy = Boolean(active);
    const committed = state.lastResult && currentResult !== state.lastResult;
    const canMoveFocus = !document.hidden && [initiator, skip].includes(document.activeElement);
    root.dataset.seamsiPhase = state.phase;
    root.dataset.seamsiReady = "true";
    category.disabled = question.disabled = busy;
    submit.disabled = oracle.disabled = false;
    submit.setAttribute("aria-disabled", String(busy || state.corpusStatus !== "ready"));
    oracle.setAttribute("aria-disabled", String(busy || state.corpusStatus !== "ready"));
    oracle.setAttribute("aria-label", state.phase === "revealed" ? "ดูใบเซียมซี" : "เขย่าเซียมซีตามเรื่องที่เลือก");
    stageTitle.textContent = state.phase === "revealed" ? "ดูใบเซียมซี" : "กดกระบอกเพื่อเขย่าเซียมซี";
    buttonLabel.textContent = busy ? "กำลังเปิดใบเซียมซี..." : state.phase === "revealed" ? "ตั้งคำถามใหม่" : "เขย่าเซียมซี";
    result.setAttribute("aria-busy", String(busy));

    if (active?.selection) stick.textContent = active.selection.slipNumber;
    if (active && motionId !== active.id) {
      stopMotion();
      motionId = active.id;
      oracle.classList.remove("has-result", "is-settled");
      if (!active.visualFinished) {
        oracle.classList.add("is-shaking");
        later(() => {
          if (session.getState().active?.id !== active.id) return;
          oracle.classList.remove("is-shaking");
          if (session.getState().active.selection) oracle.classList.add("has-result");
        }, 800);
        // Watchdog guarantees completion without animationend, CSS or artwork.
        later(() => session.finishVisual(active.id), 1100);
      }
    }
    if (!active || active.visualFinished) stopMotion();
    skip.hidden = !active || active.visualFinished;

    if (committed) {
      currentResult = state.lastResult;
      reading.innerHTML = renderReading(state.lastResult);
    }
    if (state.phase === "revealed" || committed) {
      stick.textContent = state.lastResult.reading.slipNumber;
      oracle.classList.add("has-result", "is-settled");
    } else if (!active) oracle.classList.remove("has-result", "is-settled");

    previous.hidden = !state.previous;
    previous.textContent = state.previous ? "จากคำถามก่อนหน้า" : "";
    intentNotice.hidden = !state.previous || busy;
    intentNotice.textContent = state.dirty
      ? "คุณเปลี่ยนคำถามแล้ว ใบด้านล่างยังเป็นผลจากคำถามก่อนหน้า"
      : "เตรียมคำถามใหม่ได้ ใบก่อนหน้ายังเก็บไว้ให้ทบทวน";
    const reset = reading.querySelector("[data-seamsi-reset]");
    if (reset) reset.hidden = state.phase !== "revealed";
    const errorKey = state.phase === "unavailable" ? "unavailable" : state.error || (active?.kind === "retry" ? "reading" : "");
    const showRetry = state.canRetry || active?.kind === "retry";
    if (feedback.dataset.error !== errorKey || feedback.dataset.retry !== String(showRetry)) {
      feedback.dataset.error = errorKey;
      feedback.dataset.retry = String(showRetry);
      feedback.innerHTML = errorKey ? renderError(errorKey, showRetry) : "";
    }
    feedback.hidden = !errorKey;
    reading.hidden = !state.lastResult && Boolean(errorKey);
    result.setAttribute("aria-labelledby", !state.lastResult && errorKey ? "seamsi-error-title" : "seamsi-result-title");
    const retry = feedback.querySelector("[data-seamsi-retry]");
    if (retry) retry.setAttribute("aria-disabled", String(busy));
    status.textContent = state.phase === "drawing" ? "กำลังเขย่าเซียมซี โปรดตั้งจิตให้สงบ..."
      : state.phase === "awaiting-content" ? "กำลังโหลดคำอ่าน..."
      : state.phase === "revealed" ? `เปิดใบเซียมซีที่ ${state.lastResult.reading.slipNumber} แล้ว กดกระบอกเพื่ออ่านใบเดิม`
      : errorKey ? "ข้อมูลเซียมซียังไม่พร้อม กรุณาดูข้อความด้านล่าง"
      : "ตั้งจิต เลือกเรื่องที่ถาม แล้วกดกระบอกเซียมซี";
    if (committed && canMoveFocus && !finalizing) {
      finalizing = true;
      focusResult();
      finalizing = false;
    }
  }

  function prepareQuestion() {
    if (!session.prepareQuestion()) return;
    question.value = "";
    validation.hidden = true;
    question.focus();
  }

  function validIntent() {
    const invalidCategory = !seamsiCategories.some(item => item.id === category.value);
    const invalidQuestion = question.value.length > question.maxLength;
    category.setCustomValidity(invalidCategory ? "กรุณาเลือกเรื่องที่ต้องการถาม" : "");
    question.setCustomValidity(invalidQuestion ? `คำถามต้องไม่เกิน ${question.maxLength} ตัวอักษร` : "");
    category.setAttribute("aria-invalid", String(invalidCategory));
    question.setAttribute("aria-invalid", String(invalidQuestion));
    const valid = form.checkValidity();
    if (!valid) {
      session.invalidate();
      validation.textContent = invalidCategory ? "กรุณาเลือกเรื่องที่ต้องการถาม" : question.validationMessage;
      validation.hidden = false;
      form.reportValidity();
    }
    return valid;
  }

  listen(form, "submit", event => {
    event.preventDefault();
    const state = session.getState();
    if (state.active || state.corpusStatus !== "ready") return;
    if (state.phase === "revealed") { prepareQuestion(); return; }
    if (!validIntent()) return;
    validation.hidden = true;
    initiator = document.activeElement;
    session.begin(draft(), { visualFinished: motion.matches || document.hidden });
  });
  listen(oracle, "click", () => {
    const state = session.getState();
    if (state.active || state.corpusStatus !== "ready") return;
    if (state.phase === "revealed") focusResult();
    else form.requestSubmit();
  });
  const changed = () => {
    if (session.getState().active) return;
    category.setCustomValidity("");
    question.setCustomValidity("");
    category.removeAttribute("aria-invalid");
    question.removeAttribute("aria-invalid");
    validation.hidden = true;
    session.changeIntent(draft());
  };
  listen(form, "input", changed);
  listen(form, "change", changed);
  listen(form, "invalid", event => {
    session.invalidate();
    validation.textContent = event.target.validationMessage;
    validation.hidden = false;
  }, { capture: true });
  listen(result, "click", event => {
    if (event.target.closest("[data-seamsi-reset]")) prepareQuestion();
    if (event.target.closest("[data-seamsi-retry]")) {
      if (session.getState().active) return;
      initiator = document.activeElement;
      session.retry();
    }
    if (event.target.closest("[data-seamsi-reload]")) window.location.reload();
  });
  listen(skip, "click", () => session.finishVisual(session.getState().active?.id));
  listen(stick, "animationend", event => {
    if (event.animationName === "seamsi-stick-fall") session.finishVisual(session.getState().active?.id);
  });
  listen(motion, "change", () => {
    if (motion.matches) session.finishVisual(session.getState().active?.id);
  });
  listen(document, "visibilitychange", () => {
    if (document.hidden) session.finishVisual(session.getState().active?.id);
  });
  const failedArt = () => { image.hidden = true; fallback.hidden = false; };
  listen(image, "error", failedArt);
  if (image.complete && !image.naturalWidth) failedArt();

  mounted = {
    form,
    finish: () => session.finishVisual(session.getState().active?.id),
    dispose() { stopMotion(); session.dispose(); events.abort(); },
  };
  render(session.getState());
}

function renderReading({ intent, reading }) {
  return `
    <article class="seamsi-result-card">
      <div class="seamsi-result-head">
        <span>ใบที่</span><strong>${escapeHtml(reading.slipNumber)}</strong>
        ${reading.tone ? `<small>${escapeHtml(reading.tone)}</small>` : ""}
      </div>
      <div class="seamsi-result-copy">
        <p class="section-kicker">เรื่อง${escapeHtml(intent.topicLabel)}</p>
        <h2 id="seamsi-result-title" tabindex="-1">${escapeHtml(reading.title || "ใบเซียมซี")}</h2>
        ${intent.question ? `<p class="seamsi-question">คำถาม: ${escapeHtml(intent.question)}</p>` : ""}
        <blockquote>${escapeHtml(reading.verse)}</blockquote>
        <dl class="seamsi-reading-list">
          ${readingItem("คำทำนาย", reading.generalReading)}
          ${readingItem("คำแนะนำ", reading.advice)}
          ${readingItem("ข้อควรระวัง", reading.caution)}
          ${readingItem("มงคลประจำใบ", reading.blessing)}
        </dl>
        ${intent.topicId !== "overview" ? '<p class="seamsi-reading-note">ใบนี้ยังไม่มีคำอ่านแยกสำหรับเรื่องที่เลือก</p>' : ""}
        <p class="seamsi-reading-note">ใช้เป็นข้อคิดตามความเชื่อ ไม่ใช่การยืนยันอนาคต ควรพิจารณาร่วมกับข้อมูลจริงก่อนตัดสินใจ</p>
        <div class="seamsi-result-actions">
          <button class="secondary-action" type="button" data-seamsi-reset>${renderIcon("rotate-ccw")}ตั้งคำถามใหม่</button>
          <a class="primary-action" href="/#consult">ติดต่อมงคลเวลา${renderIcon("arrow-right")}</a>
        </div>
      </div>
    </article>`;
}

function renderError(kind, canRetry) {
  const title = kind === "unavailable" ? "ข้อมูลเซียมซียังไม่พร้อมใช้งาน"
    : kind === "reading" ? "ไม่สามารถเปิดคำอ่านใบนี้ได้" : "ยังยืนยันผลครั้งนี้ไม่ได้";
  const copy = kind === "reading" ? "ลองเปิดคำอ่านใบเดิมอีกครั้ง โดยไม่เขย่าหรือสุ่มใหม่"
    : kind === "unavailable" ? "กรุณาลองโหลดหน้านี้อีกครั้ง หากยังไม่พร้อมให้กลับมาใหม่ภายหลัง"
    : "ยังไม่มีผลใหม่ที่ยืนยันได้ คุณสามารถตั้งใจถามและกดเขย่าอีกครั้งเมื่อพร้อม";
  return `<h2 id="seamsi-error-title" tabindex="-1">${title}</h2><p>${copy}</p>
    ${canRetry ? '<button class="secondary-action" type="button" data-seamsi-retry>โหลดคำอ่านอีกครั้ง</button>' : ""}
    ${kind === "unavailable" ? '<button class="secondary-action" type="button" data-seamsi-reload>ลองโหลดข้อมูลอีกครั้ง</button>' : ""}`;
}

function readingItem(title, body) {
  return body ? `<div><dt>${title}</dt><dd>${escapeHtml(body)}</dd></div>` : "";
}

function randomIndex(length) {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % length;
  }
  return Math.floor(Math.random() * length);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));
}

mountSeamsi();
document.addEventListener("astro:page-load", mountSeamsi, { signal: lifecycle.signal });
document.addEventListener("astro:before-swap", () => { mounted?.dispose(); mounted = undefined; }, { signal: lifecycle.signal });
window.addEventListener("pagehide", event => {
  if (event.persisted) mounted?.finish();
  else { mounted?.dispose(); mounted = undefined; }
}, { signal: lifecycle.signal });
window.addEventListener("pageshow", mountSeamsi, { signal: lifecycle.signal });
if (import.meta.hot) import.meta.hot.dispose(() => { mounted?.dispose(); lifecycle.abort(); });

export { seamsiFortunes };
