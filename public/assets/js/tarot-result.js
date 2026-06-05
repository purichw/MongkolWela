import { getCardArtClass, getTarotCardById } from "./tarot-data.js?v=20260605-2";

const isEnglish = document.documentElement.lang === "en" || location.pathname.startsWith("/en/");
const t = isEnglish
  ? {
      fallbackTitle: "No card selected for this reading",
      fallbackCopy: "Go back and choose one card to open your daily tarot guidance.",
      kicker: "Daily Tarot Reading",
      theme: "Theme",
      interpretation: "Interpretation",
      advice: "Advice",
      caution: "Caution",
      color: "Auspicious color",
      time: "Auspicious time",
      mantra: "Prayer / intention",
      drawAgain: "Draw again",
      home: "Back to home",
      noCard: "Go choose a card",
    }
  : {
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
      <h1>${isEnglish ? card.name : card.thName}</h1>
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
        <a class="secondary-action" href="${isEnglish ? "/en/" : "/"}">${t.home}</a>
      </div>
    </div>
  `;
}

function renderFallback(resultRoot) {
  resultRoot.innerHTML = `
    <div class="tarot-result-copy tarot-empty-result">
      <p class="section-kicker">Daily Tarot</p>
      <h1>${t.fallbackTitle}</h1>
      <p>${t.fallbackCopy}</p>
      <a class="primary-action" href="../">${t.noCard}</a>
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
