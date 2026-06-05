import { getCardArtClass, getTarotCardById } from "./tarot-data.js?v=20260605-19";

const fallbackMessage = {
  title: "ยังไม่มีไพ่สำหรับคำทำนาย",
  copy: "กลับไปเลือกไพ่ 1 ใบก่อน เพื่อเปิดคำทำนายรายวันของคุณ",
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
      <p class="section-kicker">คำทำนายไพ่ยิปซีรายวัน</p>
      <h1>${card.thName}</h1>
      <p class="tarot-result-name">${card.name}</p>
      <dl class="tarot-reading-list">
        <div>
          <dt>ธีม</dt>
          <dd>${card.theme}</dd>
        </div>
        <div>
          <dt>คำแปลความ</dt>
          <dd>${card.interpretation}</dd>
        </div>
        <div>
          <dt>คำแนะนำ</dt>
          <dd>${card.advice}</dd>
        </div>
        <div>
          <dt>ข้อควรระวัง</dt>
          <dd>${card.caution}</dd>
        </div>
      </dl>
      <div class="tarot-auspicious-grid">
        <article>
          <span>สีมงคล</span>
          <strong>${card.color}</strong>
        </article>
        <article>
          <span>เวลามงคล</span>
          <strong>${card.time}</strong>
        </article>
      </div>
      <div class="tarot-prayer">
        <span>มนต์ภาวนา / คำอธิษฐาน</span>
        <p>${card.mantra}</p>
      </div>
      <div class="tarot-result-actions">
        <a class="primary-action" href="./">จับไพ่ใหม่</a>
        <a class="secondary-action" href="../../">กลับหน้าหลัก</a>
      </div>
    </div>
  `;
}

function renderFallback(resultRoot) {
  resultRoot.innerHTML = `
    <div class="tarot-result-copy tarot-empty-result">
      <p class="section-kicker">Daily Tarot</p>
      <h1>${fallbackMessage.title}</h1>
      <p>${fallbackMessage.copy}</p>
      <a class="primary-action" href="./">กลับไปเลือกไพ่</a>
    </div>
  `;
}

function renderLargeCard(card) {
  return `
    <div class="tarot-card-face result ${getCardArtClass(card)}">
      <img class="tarot-card-image" src="${card.image}" alt="${card.thName} (${card.name})" loading="eager" decoding="async" fetchpriority="high">
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
