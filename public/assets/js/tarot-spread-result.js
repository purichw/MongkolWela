import { getCardArtClass, getTarotCardById } from "./tarot-data.js?v=20260605-2";

const monthlyPositions = [
  {
    title: "ภาพรวมเดือนนี้",
    focus: "พลังหลักที่ครอบคลุมเดือน",
  },
  {
    title: "สิ่งท้าทาย",
    focus: "เรื่องที่ต้องตั้งสติหรือรับมือ",
  },
  {
    title: "รากของเรื่อง",
    focus: "เหตุปัจจัยลึก ๆ ที่กำลังส่งผล",
  },
  {
    title: "สิ่งที่เพิ่งผ่านมา",
    focus: "บทเรียนหรือแรงส่งจากช่วงก่อนหน้า",
  },
  {
    title: "สิ่งที่ควรตั้งใจ",
    focus: "ทิศทางที่ควรใช้เป็นเป้าหมาย",
  },
  {
    title: "แนวโน้มใกล้ตัว",
    focus: "เหตุการณ์หรือจังหวะที่กำลังเข้ามา",
  },
  {
    title: "ตัวคุณในเดือนนี้",
    focus: "ท่าทีและพลังภายในที่ควรสังเกต",
  },
  {
    title: "คนรอบข้างและสภาพแวดล้อม",
    focus: "แรงสนับสนุนหรือแรงกดดันภายนอก",
  },
  {
    title: "ความหวังและความกังวล",
    focus: "เรื่องที่ใจคาดหวังหรือยังไม่วางใจ",
  },
  {
    title: "บทสรุปของเดือน",
    focus: "แนวโน้มปลายทางและคำแนะนำสำคัญ",
  },
];

const luckLevels = {
  open: {
    ids: new Set([
      "the-magician",
      "the-empress",
      "the-emperor",
      "the-hierophant",
      "the-lovers",
      "the-chariot",
      "the-strength",
      "the-wheel-of-fortune",
      "the-justice",
      "temperance",
      "the-star",
      "the-sun",
      "the-judgment",
      "the-world",
    ]),
    label: "จังหวะเปิด",
    copy: "มีแรงหนุนให้ลองโอกาสเล็ก ๆ ได้ แต่ควรกำหนดวงเงิน เวลา และจุดหยุดไว้ก่อนเสมอ",
  },
  steady: {
    ids: new Set(["the-fool", "the-high-priestess", "the-hermit"]),
    label: "พอมีลุ้นแบบระวังตัว",
    copy: "ยังไม่ใช่จังหวะที่ควรทุ่มเต็มแรง เหมาะกับการลองอย่างพอดีและอ่านข้อมูลประกอบให้มากขึ้น",
  },
  caution: {
    ids: new Set(["the-hanged-man", "the-death", "the-devil", "the-tower", "the-moon"]),
    label: "ควรชะลอ",
    copy: "ไพ่เตือนให้ลดความเสี่ยงและอย่าฝืนจังหวะ เหมาะกับการพัก ดูสถานการณ์ และรักษาทรัพย์ไว้ก่อน",
  },
};

initSpreadResult();

function initSpreadResult() {
  const resultRoot = document.querySelector("[data-tarot-spread-result]");
  if (!resultRoot) return;

  const spreadType = resultRoot.dataset.spreadType || "monthly";
  const storageKey = resultRoot.dataset.storageKey || "monkolTarotSpread";
  const cards = readCardsFromRequest(storageKey);

  if (spreadType === "luck") {
    renderLuckResult(resultRoot, cards);
    return;
  }

  renderMonthlyResult(resultRoot, cards);
}

function readCardsFromRequest(storageKey) {
  const params = new URLSearchParams(window.location.search);
  const cardParam = params.get("cards");
  const cardIds = cardParam
    ? cardParam.split(",").map((id) => id.trim()).filter(Boolean)
    : readStoredReading(storageKey)?.cardIds || [];

  return cardIds.map((id) => getTarotCardById(id)).filter(Boolean);
}

function renderMonthlyResult(resultRoot, cards) {
  if (cards.length < monthlyPositions.length) {
    renderFallback(resultRoot, {
      kicker: "Monthly Tarot",
      title: "ยังไม่มีไพ่สำหรับคำทำนายรายเดือน",
      copy: "กลับไปเลือกไพ่ 10 ใบก่อน เพื่อเปิดคำทำนายรายเดือนของคุณ",
      href: "../",
      label: "กลับไปเลือกไพ่",
    });
    return;
  }

  resultRoot.innerHTML = `
    <div class="tarot-result-copy tarot-spread-overview">
      <p class="section-kicker">Monthly Tarot</p>
      <h1>คำทำนายไพ่ยิปซีรายเดือน</h1>
      <p>
        อ่านไพ่ตามลำดับที่เลือกไว้ ไพ่แต่ละใบคือมุมมองหนึ่งของเดือนนี้
        ใช้ร่วมกับสติ ข้อมูลจริง และการตัดสินใจของตัวคุณเอง
      </p>
      <div class="tarot-result-actions">
        <a class="primary-action" href="../">จับไพ่ใหม่</a>
        <a class="secondary-action" href="/">กลับหน้าหลัก</a>
      </div>
    </div>
    <div class="tarot-spread-grid">
      ${monthlyPositions.map((position, index) => renderMonthlyCard(cards[index], position, index)).join("")}
    </div>
  `;
}

function renderMonthlyCard(card, position, index) {
  return `
    <article class="tarot-spread-card">
      <div class="tarot-spread-card-media">
        <span class="tarot-spread-number">${index + 1}</span>
        ${renderCardFace(card, "spread")}
      </div>
      <div>
        <p class="section-kicker">${position.focus}</p>
        <h2>${position.title}</h2>
        <h3>${card.thName}</h3>
        <p class="tarot-result-name">${card.name}</p>
        <dl class="tarot-reading-list compact">
          <div>
            <dt>ธีม</dt>
            <dd>${card.theme}</dd>
          </div>
          <div>
            <dt>คำแนะนำ</dt>
            <dd>${card.advice}</dd>
          </div>
        </dl>
      </div>
    </article>
  `;
}

function renderLuckResult(resultRoot, cards) {
  const card = cards[0];
  if (!card) {
    renderFallback(resultRoot, {
      kicker: "Luck Tarot",
      title: "ยังไม่มีไพ่สำหรับคำทำนายโชคลาภ",
      copy: "กลับไปเลือกไพ่ 1 ใบก่อน เพื่อเปิดคำทำนายโชคลาภของคุณ",
      href: "../",
      label: "กลับไปเลือกไพ่",
    });
    return;
  }

  const verdict = getLuckVerdict(card);
  resultRoot.innerHTML = `
    <div class="tarot-result-card-wrap">
      ${renderCardFace(card, "result")}
    </div>
    <div class="tarot-result-copy tarot-luck-result">
      <p class="section-kicker">Luck Tarot</p>
      <h1>${card.thName}</h1>
      <p class="tarot-result-name">${card.name}</p>
      <div class="tarot-luck-verdict tarot-luck-verdict-${verdict.key}">
        <span>ผลโดยรวม</span>
        <strong>${verdict.label}</strong>
        <p>${verdict.copy}</p>
      </div>
      <dl class="tarot-reading-list">
        <div>
          <dt>จังหวะของไพ่</dt>
          <dd>${card.theme}</dd>
        </div>
        <div>
          <dt>คำแปลความ</dt>
          <dd>${card.interpretation}</dd>
        </div>
        <div>
          <dt>คำแนะนำก่อนเสี่ยง</dt>
          <dd>${card.advice}</dd>
        </div>
        <div>
          <dt>ข้อควรระวัง</dt>
          <dd>${card.caution}</dd>
        </div>
      </dl>
      <div class="tarot-auspicious-grid">
        <article>
          <span>สีเสริมจังหวะ</span>
          <strong>${card.color}</strong>
        </article>
        <article>
          <span>เวลาตั้งจิต</span>
          <strong>${card.time}</strong>
        </article>
      </div>
      <div class="tarot-prayer">
        <span>คำอธิษฐาน</span>
        <p>${card.mantra}</p>
      </div>
      <div class="tarot-result-actions">
        <a class="primary-action" href="../">จับไพ่ใหม่</a>
        <a class="secondary-action" href="/">กลับหน้าหลัก</a>
      </div>
    </div>
  `;
}

function getLuckVerdict(card) {
  if (luckLevels.open.ids.has(card.id)) return { key: "open", ...luckLevels.open };
  if (luckLevels.caution.ids.has(card.id)) return { key: "caution", ...luckLevels.caution };
  return { key: "steady", ...luckLevels.steady };
}

function renderFallback(resultRoot, content) {
  resultRoot.innerHTML = `
    <div class="tarot-result-copy tarot-empty-result">
      <p class="section-kicker">${content.kicker}</p>
      <h1>${content.title}</h1>
      <p>${content.copy}</p>
      <a class="primary-action" href="${content.href}">${content.label}</a>
    </div>
  `;
}

function renderCardFace(card, size = "result") {
  return `
    <div class="tarot-card-face ${size} ${getCardArtClass(card)}">
      <img class="tarot-card-image" src="${card.image}" alt="${card.thName} (${card.name})" loading="eager" decoding="async" fetchpriority="high">
    </div>
  `;
}

function readStoredReading(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey));
  } catch {
    return undefined;
  }
}
