import { getTarotCardById } from "./tarot-data.js";
import { renderSingleReading, renderEmptyReading } from "./tarot-view.js";

const root = document.querySelector("[data-tarot-result]");
if (root) {
  const params = new URLSearchParams(location.search);
  let stored;
  try { stored = JSON.parse(localStorage.getItem("monkolDailyTarot")); } catch { /* URL readings work without storage. */ }
  const card = getTarotCardById(params.has("card") ? params.get("card") : stored?.cardId);
  root.innerHTML = card ? renderSingleReading(card) : renderEmptyReading("ยังไม่มีไพ่สำหรับคำทำนาย", "กลับไปเลือกไพ่ 1 ใบก่อน เพื่อเปิดคำทำนายรายวันของคุณ");
}
