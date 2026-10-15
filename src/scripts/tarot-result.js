import { getTarotCardById } from "./tarot-data.js";
import { renderSingleReading, renderEmptyReading } from "./tarot-view.js";
import { onCmsContent } from "./content-ready.js";

const root = document.querySelector("[data-tarot-result]");
onCmsContent(() => { if (root) {
  const params = new URLSearchParams(location.search);
  let stored;
  try { stored = JSON.parse(localStorage.getItem("monkolDailyTarot")); } catch { /* URL readings work without storage. */ }
  const card = getTarotCardById(params.has("card") ? params.get("card") : stored?.cardId);
  root.innerHTML = card ? renderSingleReading(card) : renderEmptyReading("ยังไม่มีไพ่สำหรับคำทำนาย", "กลับไปเลือกไพ่ 1 ใบก่อน เพื่อเปิดคำทำนายรายวันของคุณ");
} }, { onUnavailable: () => {
  if (root) root.innerHTML = renderEmptyReading("ยังโหลดคำทำนายไม่ได้", "ไม่สามารถโหลดคำอ่านล่าสุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
} });
