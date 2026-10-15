import { getTarotCardById } from "./tarot-data.js";
import { readingForContext } from "../data/tarot-editorial.js";
import { monthlyPositions } from "../data/tarot-monthly-positions.js";
import { onCmsContent } from "./content-ready.js";
import { renderMonthlyCard, renderSingleReading, renderReadingActions, renderEmptyReading } from "./tarot-view.js";

const topicResults = {
  love: { drawAgain: "จับไพ่ความรักใหม่", labels: { reading: "คำแปลความด้านความรัก", advice: "แนวทางสื่อสาร", time: "เวลาตั้งจิต" } },
  money: { drawAgain: "จับไพ่การเงินใหม่", labels: { reading: "คำแปลความเรื่องเงิน", advice: "แนวทางจัดเงิน", time: "เวลาตั้งจิต" } },
  career: { drawAgain: "จับไพ่การงานใหม่", labels: { reading: "คำแปลความเรื่องงาน", advice: "แนวทางลงมือ", time: "เวลาตั้งจิต" } },
  luck: { drawAgain: "จับไพ่โชคลาภใหม่", labels: { reading: "โอกาสและจังหวะที่ควรสังเกต", advice: "คำแนะนำ", time: "เวลาตั้งจิต" } },
};

onCmsContent(initSpreadResult, { onUnavailable: () => {
  const root = document.querySelector("[data-tarot-spread-result]");
  if (root) root.innerHTML = renderEmptyReading("ยังโหลดคำทำนายไม่ได้", "ไม่สามารถโหลดคำอ่านล่าสุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
} });

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
  if ((!topicResults[type] && type !== "monthly") || ids?.length !== required || cards.length !== required || new Set(cards.map(c => c.id)).size !== required || (type !== "monthly" && cards.some(c => c.suit))) {
    root.innerHTML = renderEmptyReading("ยังไม่มีไพ่ครบสำหรับคำทำนาย", `กลับไปเลือกไพ่ ${required} ใบก่อน เพื่อเปิดคำทำนายของคุณ`);
    return;
  }
  if (type === "monthly") {
    root.innerHTML = `<header class="tarot-spread-overview"><h2>ไพ่ทั้ง 10 ตำแหน่งของเดือนนี้</h2><p>อ่านตามลำดับที่เลือก เพื่อทบทวนภาพรวม สิ่งท้าทาย และก้าวต่อไปของคุณ</p></header>
      <div class="tarot-spread-grid">${cards.map((card, i) => renderMonthlyCard(card, monthlyPositions[i], i)).join("")}</div>
      ${renderReadingActions()}`;
    return;
  }
  root.innerHTML = renderSingleReading(cards[0], { ...topicResults[type], ...readingForContext(cards[0], type) });
}
