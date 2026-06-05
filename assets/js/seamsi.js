import { seamsiCategories, seamsiFortunes } from "./seamsi-data.js?v=20260605-15";

const selectors = {
  form: "[data-seamsi-form]",
  category: "[data-seamsi-category]",
  question: "[data-seamsi-question]",
  oracle: "[data-seamsi-oracle]",
  result: "[data-seamsi-result]",
  status: "[data-seamsi-status]",
  button: "[data-seamsi-shake]",
  reset: "[data-seamsi-reset]",
};

let activeFortune;
let isShaking = false;

initSeamsi();

function initSeamsi() {
  const form = document.querySelector(selectors.form);
  const oracle = document.querySelector(selectors.oracle);
  const result = document.querySelector(selectors.result);
  const status = document.querySelector(selectors.status);

  if (!form || !oracle || !result || !status) return;

  fillCategories(form);
  renderEmptyResult(result);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    shakeSeamsi(form, oracle, result, status);
  });

  oracle.addEventListener("click", () => {
    form.requestSubmit();
  });

  result.addEventListener("click", (event) => {
    if (!event.target.closest(selectors.reset)) return;
    activeFortune = undefined;
    renderEmptyResult(result);
    updateStatus(status, "ตั้งจิต เลือกเรื่องที่ถาม แล้วกดกระบอกเซียมซี");
    oracle.classList.remove("has-result");
    form.querySelector(selectors.button)?.focus();
  });
}

function fillCategories(form) {
  const categorySelect = form.querySelector(selectors.category);
  if (!categorySelect) return;

  categorySelect.innerHTML = seamsiCategories
    .map((category) => `<option value="${category.id}">${category.label}</option>`)
    .join("");
}

function shakeSeamsi(form, oracle, result, status) {
  if (isShaking) return;

  const categoryId = form.querySelector(selectors.category)?.value ?? "overview";
  const question = form.querySelector(selectors.question)?.value.trim() ?? "";
  const category = seamsiCategories.find((item) => item.id === categoryId) ?? seamsiCategories[0];
  const fortune = pickFortune();

  isShaking = true;
  activeFortune = fortune;
  oracle.classList.remove("has-result");
  oracle.classList.add("is-shaking");
  updateStatus(status, "กำลังเขย่าเซียมซี โปรดตั้งจิตให้สงบ...");

  window.setTimeout(() => {
    oracle.classList.add("has-result");
    updateStatus(status, `ได้ใบเซียมซีที่ ${fortune.number} เรื่อง${category.label}`);
  }, 880);

  window.setTimeout(() => {
    oracle.classList.remove("is-shaking");
    renderFortune(result, fortune, category, question);
    result.scrollIntoView({ behavior: "smooth", block: "start" });
    isShaking = false;
  }, 1280);
}

function pickFortune() {
  const lastNumber = Number(localStorage.getItem("monkolSeamsiLastNumber"));
  const pool = seamsiFortunes.filter((fortune) => fortune.number !== lastNumber);
  const selected = pool[randomIndex(pool.length)] ?? seamsiFortunes[randomIndex(seamsiFortunes.length)];
  localStorage.setItem("monkolSeamsiLastNumber", String(selected.number));
  return selected;
}

function randomIndex(length) {
  if (globalThis.crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % length;
  }

  return Math.floor(Math.random() * length);
}

function renderEmptyResult(result) {
  result.innerHTML = `
    <div class="seamsi-empty">
      <span>เซียมซี</span>
      <strong>ยังไม่ได้เสี่ยงทาย</strong>
      <p>เมื่อเขย่ากระบอกแล้ว ใบเซียมซีและคำทำนายจะแสดงตรงนี้</p>
    </div>
  `;
}

function renderFortune(result, fortune, category, question) {
  result.innerHTML = `
    <article class="seamsi-result-card">
      <div class="seamsi-result-head">
        <span>ใบที่</span>
        <strong>${fortune.number}</strong>
        <small>${fortune.tone}</small>
      </div>
      <div class="seamsi-result-copy">
        <p class="section-kicker">เรื่อง${category.label}</p>
        <h2>${fortune.title}</h2>
        ${question ? `<p class="seamsi-question">คำถาม: ${escapeHtml(question)}</p>` : ""}
        <blockquote>${fortune.verse}</blockquote>
        <dl class="seamsi-reading-list">
          ${renderReadingItem("คำทำนาย", fortune.interpretation)}
          ${renderReadingItem("คำแนะนำ", personalizeAdvice(fortune.advice, category))}
          ${renderReadingItem("ข้อควรระวัง", fortune.caution)}
          ${renderReadingItem("มงคลประจำใบ", fortune.blessing)}
        </dl>
        <div class="seamsi-result-actions">
          <button class="secondary-action" type="button" data-seamsi-reset>เสี่ยงใหม่</button>
          <a class="primary-action" href="../../#consult">ปรึกษาครูโหร</a>
        </div>
      </div>
    </article>
  `;
}

function renderReadingItem(title, body) {
  return `
    <div>
      <dt>${title}</dt>
      <dd>${body}</dd>
    </div>
  `;
}

function personalizeAdvice(advice, category) {
  if (category.id === "overview") return advice;
  return `${advice} สำหรับเรื่อง${category.label} ให้ยึดเจตนาที่สงบและไม่ถามซ้ำเพียงเพื่อเอาคำตอบที่ถูกใจ`;
}

function updateStatus(status, message) {
  status.textContent = message;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

export { seamsiFortunes };
