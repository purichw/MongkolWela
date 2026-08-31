import { getCardArtClass, getTarotCardById } from "./tarot-data.js";

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

const topicResults = {
  love: {
    kicker: "Love Tarot",
    title: "คำทำนายไพ่ยิปซีความรัก",
    fallbackTitle: "ยังไม่มีไพ่สำหรับคำทำนายความรัก",
    fallbackCopy: "กลับไปเลือกไพ่ 1 ใบก่อน เพื่อเปิดคำทำนายความรักของคุณ",
    emptyLabel: "กลับไปเลือกไพ่",
    drawAgain: "จับไพ่ความรักใหม่",
    home: "กลับหน้าหลัก",
    labels: {
      verdict: "สัญญาณหัวใจ",
      rhythm: "จังหวะความสัมพันธ์",
      reading: "คำแปลความด้านความรัก",
      advice: "แนวทางสื่อสาร",
      caution: "ข้อควรระวัง",
      color: "สีเสริมเสน่ห์",
      time: "เวลาตั้งจิต",
      mantra: "คำอธิษฐานเรื่องความรัก",
    },
    levels: [
      {
        key: "open",
        ids: new Set(["the-fool", "the-magician", "the-empress", "the-lovers", "the-chariot", "the-strength", "temperance", "the-star", "the-sun", "the-world"]),
        label: "หัวใจเปิดรับ",
        copy: "มีพื้นที่ให้ความสัมพันธ์ขยับหรือทำความเข้าใจกันมากขึ้น เหมาะกับการสื่อสารอย่างจริงใจ",
        advice: "พูดความต้องการให้ชัดโดยไม่เร่งคำตอบของอีกฝ่าย",
        caution: "อย่าตีความสัญญาณดีเป็นคำสัญญาถาวร ให้ดูการกระทำต่อเนื่องด้วย",
      },
      {
        key: "steady",
        ids: new Set(["the-high-priestess", "the-hierophant", "the-hermit", "the-wheel-of-fortune", "the-justice", "the-hanged-man", "the-judgment"]),
        label: "ต้องค่อย ๆ ดูใจ",
        copy: "ความรักยังต้องการเวลา ความชัดเจน หรือบทสนทนาที่ไม่รีบร้อนเกินไป",
        advice: "ฟังให้มากขึ้น ถามให้ตรงขึ้น และเว้นจังหวะให้ความจริงปรากฏเอง",
        caution: "ระวังเก็บคำถามไว้คนเดียวจนกลายเป็นความกังวล",
      },
      {
        key: "caution",
        ids: new Set(["the-emperor", "the-death", "the-devil", "the-tower", "the-moon"]),
        label: "ควรรักษาขอบเขต",
        copy: "ไพ่เตือนให้เห็นเงื่อนไข ความกลัว หรือรูปแบบเดิมที่ทำให้หัวใจเหนื่อย",
        advice: "ตั้งขอบเขตให้สุภาพและชัดเจน ก่อนตัดสินใจเดินหน้าหรือถอย",
        caution: "อย่าฝืนความสัมพันธ์เพราะกลัวเสียสิ่งที่ยังไม่มั่นคง",
      },
    ],
  },
  money: {
    kicker: "Money Tarot",
    title: "คำทำนายไพ่ยิปซีการเงิน",
    fallbackTitle: "ยังไม่มีไพ่สำหรับคำทำนายการเงิน",
    fallbackCopy: "กลับไปเลือกไพ่ 1 ใบก่อน เพื่อเปิดคำทำนายการเงินของคุณ",
    emptyLabel: "กลับไปเลือกไพ่",
    drawAgain: "จับไพ่การเงินใหม่",
    home: "กลับหน้าหลัก",
    labels: {
      verdict: "สภาพคล่องช่วงนี้",
      rhythm: "จังหวะการเงิน",
      reading: "คำแปลความเรื่องเงิน",
      advice: "แนวทางจัดเงิน",
      caution: "ข้อควรระวัง",
      color: "สีเสริมทรัพย์",
      time: "เวลาตั้งจิต",
      mantra: "คำอธิษฐานเรื่องการเงิน",
    },
    levels: [
      {
        key: "open",
        ids: new Set(["the-magician", "the-empress", "the-emperor", "the-hierophant", "the-chariot", "the-strength", "the-wheel-of-fortune", "the-justice", "temperance", "the-star", "the-sun", "the-world"]),
        label: "พอมีแรงหนุน",
        copy: "การเงินมีโอกาสขยับดีขึ้นจากการจัดระบบ ลงมือ หรือใช้ทรัพยากรที่มีให้เกิดผล",
        advice: "วางงบให้ชัด แยกรายจ่ายจำเป็น และเลือกหนึ่งช่องทางที่เพิ่มรายรับได้จริง",
        caution: "อย่าขยายความเสี่ยงเร็วเกินกว่ากระแสเงินสดรองรับ",
      },
      {
        key: "steady",
        ids: new Set(["the-fool", "the-high-priestess", "the-lovers", "the-hermit", "the-hanged-man", "the-judgment"]),
        label: "ต้องคุมจังหวะ",
        copy: "เงินยังพอประคองได้ แต่ควรคิดให้รอบด้านก่อนใช้ จ่าย ลงทุน หรือรับข้อเสนอ",
        advice: "ตรวจตัวเลขจริง ทบทวนเงื่อนไข และตัดสินใจจากข้อมูลมากกว่าอารมณ์",
        caution: "ระวังความลังเลหรือความหวังที่ยังไม่มีหลักฐานรองรับ",
      },
      {
        key: "caution",
        ids: new Set(["the-death", "the-devil", "the-tower", "the-moon"]),
        label: "ควรชะลอรายจ่าย",
        copy: "ไพ่เตือนเรื่องภาระซ่อนอยู่ รายจ่ายกะทันหัน หรือความอยากที่พาออกนอกแผน",
        advice: "หยุดรายจ่ายไม่จำเป็น เก็บเงินสด และอ่านเงื่อนไขทุกอย่างให้ละเอียด",
        caution: "ไม่ควรตัดสินใจเรื่องเงินเพราะความกลัว ความโลภ หรือแรงกดดันจากคนอื่น",
      },
    ],
  },
  career: {
    kicker: "Career Tarot",
    title: "คำทำนายไพ่ยิปซีการงาน อาชีพ ธุรกิจ",
    fallbackTitle: "ยังไม่มีไพ่สำหรับคำทำนายการงาน",
    fallbackCopy: "กลับไปเลือกไพ่ 1 ใบก่อน เพื่อเปิดคำทำนายการงานของคุณ",
    emptyLabel: "กลับไปเลือกไพ่",
    drawAgain: "จับไพ่การงานใหม่",
    home: "กลับหน้าหลัก",
    labels: {
      verdict: "จังหวะงาน",
      rhythm: "แรงขับของงาน",
      reading: "คำแปลความเรื่องงาน",
      advice: "แนวทางลงมือ",
      caution: "ข้อควรระวัง",
      color: "สีเสริมงาน",
      time: "เวลาตั้งจิต",
      mantra: "คำอธิษฐานเรื่องการงาน",
    },
    levels: [
      {
        key: "open",
        ids: new Set(["the-fool", "the-magician", "the-emperor", "the-hierophant", "the-chariot", "the-strength", "the-wheel-of-fortune", "the-justice", "temperance", "the-star", "the-sun", "the-world", "the-judgment"]),
        label: "เดินหน้าได้",
        copy: "งานมีช่องให้ขยับจากความพร้อม วินัย การสื่อสาร หรือการตัดสินใจที่ชัดขึ้น",
        advice: "เลือกเป้าหมายหลักหนึ่งเรื่อง แล้วลงมือให้เห็นผลเป็นรูปธรรม",
        caution: "อย่ารับทุกอย่างพร้อมกันจนเสียคุณภาพงานหลัก",
      },
      {
        key: "steady",
        ids: new Set(["the-high-priestess", "the-empress", "the-lovers", "the-hermit", "the-hanged-man"]),
        label: "ต้องวางแผนและอ่านบรรยากาศ",
        copy: "จังหวะงานยังต้องการข้อมูล เวลา หรือการประสานคนให้เข้าที่ก่อนเร่งเครื่อง",
        advice: "สังเกตผู้เกี่ยวข้อง จัดลำดับงาน และถามรายละเอียดที่ยังคลุมเครือ",
        caution: "ระวังตัดสินใจจากความเกรงใจหรือความเงียบที่ยังไม่ใช่คำตอบ",
      },
      {
        key: "caution",
        ids: new Set(["the-death", "the-devil", "the-tower", "the-moon"]),
        label: "ควรตั้งหลักก่อน",
        copy: "ไพ่เตือนเรื่องโครงสร้างงานที่ไม่มั่นคง ภาระผูกมัด หรือข้อมูลที่ยังไม่ครบ",
        advice: "กันเวลาแก้ปัญหา เก็บหลักฐานการคุยงาน และอย่าเซ็นรับเงื่อนไขที่ยังไม่ชัด",
        caution: "อย่าฝืนระบบที่พังซ้ำ ๆ โดยไม่ปรับแผนหรือขอความช่วยเหลือ",
      },
    ],
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

  if (topicResults[spreadType]) {
    renderTopicResult(resultRoot, cards, spreadType);
    return;
  }

  renderMonthlyResult(resultRoot, cards);
}

function renderTopicResult(resultRoot, cards, spreadType) {
  const topic = topicResults[spreadType];
  const card = cards[0];
  if (!card) {
    renderFallback(resultRoot, {
      kicker: topic.kicker,
      title: topic.fallbackTitle,
      copy: topic.fallbackCopy,
      href: "../",
      label: topic.emptyLabel,
    });
    return;
  }

  const verdict = getTopicVerdict(topic, card);
  resultRoot.innerHTML = `
    <div class="tarot-result-card-wrap">
      ${renderCardFace(card, "result")}
    </div>
    <div class="tarot-result-copy tarot-luck-result">
      <p class="section-kicker">${topic.kicker}</p>
      <h1>${card.thName}</h1>
      <p class="tarot-result-name">${card.name}</p>
      <div class="tarot-luck-verdict tarot-luck-verdict-${verdict.key}">
        <span>${topic.labels.verdict}</span>
        <strong>${verdict.label}</strong>
        <p>${verdict.copy}</p>
      </div>
      <dl class="tarot-reading-list">
        <div>
          <dt>${topic.labels.rhythm}</dt>
          <dd>${card.theme}</dd>
        </div>
        <div>
          <dt>${topic.labels.reading}</dt>
          <dd>${buildTopicReading(card, verdict)}</dd>
        </div>
        <div>
          <dt>${topic.labels.advice}</dt>
          <dd>${verdict.advice} ${card.advice}</dd>
        </div>
        <div>
          <dt>${topic.labels.caution}</dt>
          <dd>${verdict.caution} ${card.caution}</dd>
        </div>
      </dl>
      <div class="tarot-auspicious-grid">
        <article>
          <span>${topic.labels.color}</span>
          <strong>${card.color}</strong>
        </article>
        <article>
          <span>${topic.labels.time}</span>
          <strong>${card.time}</strong>
        </article>
      </div>
      <div class="tarot-prayer">
        <span>${topic.labels.mantra}</span>
        <p>${card.mantra}</p>
      </div>
      <div class="tarot-result-actions">
        <a class="primary-action" href="../">${topic.drawAgain}</a>
        <a class="secondary-action" href="/">${topic.home}</a>
      </div>
    </div>
  `;
}

function getTopicVerdict(topic, card) {
  return topic.levels.find((level) => level.ids.has(card.id)) || topic.levels[1] || topic.levels[0];
}

function buildTopicReading(card, verdict) {
  return `${verdict.copy} ไพ่ ${card.thName} ชี้ธีม “${card.theme}” จึงควรอ่านสถานการณ์ผ่านทั้งสัญญาณภายนอกและความรู้สึกภายในของคุณ`;
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
      <span class="tarot-card-label" aria-hidden="true">${card.name}</span>
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
