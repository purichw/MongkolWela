import { getTarotCardById } from "./tarot-data.js";
import { renderCardFace, renderReadingSections, renderSingleReading, renderReadingActions, renderEmptyReading } from "./tarot-view.js";

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
  const root = document.querySelector("[data-tarot-spread-result]");
  if (!root) return;
  const type = root.dataset.spreadType;
  const params = new URLSearchParams(location.search);
  let stored;
  try { stored = JSON.parse(localStorage.getItem(root.dataset.storageKey)); } catch { /* URL readings work without storage. */ }
  const ids = params.has("cards") ? params.get("cards").split(",").filter(Boolean) : stored?.cardIds;
  const cards = Array.isArray(ids) ? ids.map(getTarotCardById).filter(Boolean) : [];
  const required = type === "monthly" ? 10 : 1;
  if (cards.length !== required || new Set(cards.map(c => c.id)).size !== required || (type !== "monthly" && cards.some(c => c.suit))) {
    root.innerHTML = renderEmptyReading("ยังไม่มีไพ่ครบสำหรับคำทำนาย", `กลับไปเลือกไพ่ ${required} ใบก่อน เพื่อเปิดคำทำนายของคุณ`);
    return;
  }
  if (type === "monthly") {
    root.innerHTML = `<header class="tarot-spread-overview"><h2>ไพ่ทั้ง 10 ตำแหน่งของเดือนนี้</h2><p>อ่านตามลำดับที่เลือก เพื่อทบทวนภาพรวม สิ่งท้าทาย และก้าวต่อไปของคุณ</p></header>
      <div class="tarot-spread-grid">${cards.map((card, i) => renderMonthlyCard(card, monthlyPositions[i], i)).join("")}</div>
      ${renderReadingActions()}`;
    return;
  }
  const card = cards[0];
  const topic = topicResults[type];
  if (topic) {
    const verdict = topic.levels.find(level => level.ids.has(card.id)) || topic.levels[1];
    root.innerHTML = renderSingleReading(card, {
      verdict, labels: topic.labels, drawAgain: topic.drawAgain,
      reading: `${verdict.copy} ไพ่ ${card.thName} ชี้ธีม “${card.theme}” จึงควรอ่านสถานการณ์ผ่านทั้งสัญญาณภายนอกและความรู้สึกภายในของคุณ`,
      advice: `${verdict.advice} ${card.advice}`,
      caution: `${verdict.caution} ${card.caution}`,
    });
  } else {
    const verdict = Object.values(luckLevels).find(level => level.ids.has(card.id)) || luckLevels.steady;
    root.innerHTML = renderSingleReading(card, { verdict, labels: { advice: "คำแนะนำก่อนเสี่ยง", color: "สีเสริมจังหวะ", time: "เวลาตั้งจิต" } });
  }
}

function renderMonthlyCard(card, position, i) {
  return `<article class="tarot-monthly-card">
    <header><span class="tarot-position-number">${String(i + 1).padStart(2, "0")}</span><div><h3>${position.title}</h3><p>${position.focus}</p></div></header>
    <div class="tarot-monthly-content"><a class="tarot-monthly-image" href="/tarot/meanings/${card.id}/" aria-label="ความหมายไพ่ ${card.thName}">${renderCardFace(card, "spread")}</a>
      <div><h4>${card.thName}</h4><p class="tarot-result-name">${card.name}</p><p class="tarot-card-theme">${card.theme}</p>
      ${renderReadingSections([{ label: "คำแนะนำ", text: card.advice, icon: "lightbulb" }], `position-${i}`)}</div></div>
  </article>`;
}
