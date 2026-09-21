import { getCardArtClass, getTarotCardById } from "./tarot-data.js";

const t = {
  fallbackTitle: "ยังไม่มีไพ่สำหรับคำทำนาย",
  fallbackCopy: "กลับไปเลือกไพ่ 1 ใบก่อน เพื่อเปิดคำทำนายรายวันของคุณ",
  kicker: "คำทำนายไพ่ยิปซีรายวัน",
  theme: "ธีม",
  interpretation: "คำแปลความ",
  advice: "คำแนะนำ",
  caution: "ข้อควรระวัง",
  color: "สีมงคล",
  time: "เวลามงคล",
  mantra: "มนต์ภาวนา / คำอธิษฐาน",
  drawAgain: "จับไพ่ใหม่",
  home: "กลับหน้าหลัก",
  noCard: "กลับไปเลือกไพ่",
};

initTarotResult();

function initTarotResult() {
  const resultRoot = document.querySelector("[data-tarot-result]");
  if (!resultRoot) return;

  const params = new URLSearchParams(window.location.search);
  const storedReading = readStoredReading();
  const cardId = params.get("card") || storedReading?.cardId;
  const card = getTarotCardById(cardId);

  if (!card) {
    renderFallback(resultRoot);
    return;
  }

  resultRoot.innerHTML = `
    <div class="tarot-result-card-wrap">
      ${renderLargeCard(card)}
    </div>
    <div class="tarot-result-copy">
      <p class="section-kicker">${t.kicker}</p>
      <h2>${card.thName}</h2>
      <p class="tarot-result-name">${card.name}</p>
      <dl class="tarot-reading-list">
        <div>
          <dt>${t.theme}</dt>
          <dd>${card.theme}</dd>
        </div>
        <div>
          <dt>${t.interpretation}</dt>
          <dd>${card.interpretation}</dd>
        </div>
        <div>
          <dt>${t.advice}</dt>
          <dd>${card.advice}</dd>
        </div>
        <div>
          <dt>${t.caution}</dt>
          <dd>${card.caution}</dd>
        </div>
      </dl>
      <div class="tarot-auspicious-grid">
        <article>
          <span>${t.color}</span>
          <strong>${card.color}</strong>
        </article>
        <article>
          <span>${t.time}</span>
          <strong>${card.time}</strong>
        </article>
      </div>
      <div class="tarot-prayer">
        <span>${t.mantra}</span>
        <p>${card.mantra}</p>
      </div>
      <div class="tarot-result-actions">
        <a class="primary-action" href="../">${t.drawAgain}</a>
        <a class="secondary-action" href="/">${t.home}</a>
      </div>
    </div>
  `;
}

function renderFallback(resultRoot) {
  resultRoot.innerHTML = `
    <div class="tarot-result-copy tarot-empty-result">
      <p class="section-kicker">Daily Tarot</p>
      <h2>${t.fallbackTitle}</h2>
      <p>${t.fallbackCopy}</p>
      <a class="primary-action" href="../">${t.noCard}</a>
    </div>
  `;
}

function renderLargeCard(card) {
  return `
    <div class="tarot-card-face result ${getCardArtClass(card)}">
      <img class="tarot-card-image" src="${card.image}" alt="${card.thName} (${card.name})" loading="eager" decoding="async" fetchpriority="high">
      <span class="tarot-card-label" aria-hidden="true">${card.name}</span>
    </div>
  `;
}

function readStoredReading() {
  try {
    return JSON.parse(localStorage.getItem("monkolDailyTarot"));
  } catch {
    return undefined;
  }
}
