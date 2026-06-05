import { seamsiCategories, seamsiFortunes } from "./seamsi-data.js";

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
const isEnglish = document.documentElement.lang === "en" || location.pathname.startsWith("/en/");
const t = isEnglish
  ? {
      categories: {
        overview: "Life overview",
        work: "Work",
        money: "Money",
        love: "Love",
        health: "Mind and body",
        luck: "Luck and opportunity",
      },
      ready: "Set your intention, choose a topic, then shake the cup.",
      shaking: "Shaking the fortune sticks. Keep your mind calm...",
      received: (fortune, category) => `You drew fortune slip ${fortune.number} for ${category}`,
      emptyLabel: "Kau chim",
      emptyTitle: "No slip drawn yet",
      emptyCopy: "After you shake the cup, the fortune slip and reading will appear here.",
      slip: "Slip",
      topic: (category) => category,
      question: "Question",
      reading: "Reading",
      advice: "Advice",
      caution: "Caution",
      blessing: "Auspicious note",
      reset: "Draw again",
      consult: "Consult an astrologer",
      personalize: (advice, category) => `${advice} For ${category}, keep the intention calm and avoid repeating the question only to get the answer you prefer.`,
    }
  : {
      categories: Object.fromEntries(seamsiCategories.map((category) => [category.id, category.label])),
      ready: "ตั้งจิต เลือกเรื่องที่ถาม แล้วกดกระบอกเซียมซี",
      shaking: "กำลังเขย่าเซียมซี โปรดตั้งจิตให้สงบ...",
      received: (fortune, category) => `ได้ใบเซียมซีที่ ${fortune.number} เรื่อง${category}`,
      emptyLabel: "เซียมซี",
      emptyTitle: "ยังไม่ได้เสี่ยงทาย",
      emptyCopy: "เมื่อเขย่ากระบอกแล้ว ใบเซียมซีและคำทำนายจะแสดงตรงนี้",
      slip: "ใบที่",
      topic: (category) => `เรื่อง${category}`,
      question: "คำถาม",
      reading: "คำทำนาย",
      advice: "คำแนะนำ",
      caution: "ข้อควรระวัง",
      blessing: "มงคลประจำใบ",
      reset: "เสี่ยงใหม่",
      consult: "ปรึกษาครูโหร",
      personalize: (advice, category) => `${advice} สำหรับเรื่อง${category} ให้ยึดเจตนาที่สงบและไม่ถามซ้ำเพียงเพื่อเอาคำตอบที่ถูกใจ`,
    };

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
    updateStatus(status, t.ready);
    oracle.classList.remove("has-result");
    form.querySelector(selectors.button)?.focus();
  });
}

function fillCategories(form) {
  const categorySelect = form.querySelector(selectors.category);
  if (!categorySelect) return;

  categorySelect.innerHTML = seamsiCategories
    .map((category) => `<option value="${category.id}">${t.categories[category.id] || category.label}</option>`)
    .join("");
}

function shakeSeamsi(form, oracle, result, status) {
  if (isShaking) return;

  const categoryId = form.querySelector(selectors.category)?.value ?? "overview";
  const question = form.querySelector(selectors.question)?.value.trim() ?? "";
  const categoryItem = seamsiCategories.find((item) => item.id === categoryId) ?? seamsiCategories[0];
  const category = t.categories[categoryItem.id] || categoryItem.label;
  const fortune = pickFortune();

  isShaking = true;
  activeFortune = fortune;
  oracle.classList.remove("has-result");
  oracle.classList.add("is-shaking");
  updateStatus(status, t.shaking);

  window.setTimeout(() => {
    oracle.classList.add("has-result");
    updateStatus(status, t.received(fortune, category));
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
      <span>${t.emptyLabel}</span>
      <strong>${t.emptyTitle}</strong>
      <p>${t.emptyCopy}</p>
    </div>
  `;
}

function renderFortune(result, fortune, category, question) {
  result.innerHTML = `
    <article class="seamsi-result-card">
      <div class="seamsi-result-head">
        <span>${t.slip}</span>
        <strong>${fortune.number}</strong>
        <small>${fortune.tone}</small>
      </div>
      <div class="seamsi-result-copy">
        <p class="section-kicker">${t.topic(category)}</p>
        <h2>${fortune.title}</h2>
        ${question ? `<p class="seamsi-question">${t.question}: ${escapeHtml(question)}</p>` : ""}
        <blockquote>${fortune.verse}</blockquote>
        <dl class="seamsi-reading-list">
          ${renderReadingItem(t.reading, fortune.interpretation)}
          ${renderReadingItem(t.advice, personalizeAdvice(fortune.advice, category))}
          ${renderReadingItem(t.caution, fortune.caution)}
          ${renderReadingItem(t.blessing, fortune.blessing)}
        </dl>
        <div class="seamsi-result-actions">
          <button class="secondary-action" type="button" data-seamsi-reset>${t.reset}</button>
          <a class="primary-action" href="${isEnglish ? "/en/#consult" : "/#consult"}">${t.consult}</a>
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
  if (category === (t.categories.overview || "ภาพรวมชีวิต")) return advice;
  return t.personalize(advice, category);
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
