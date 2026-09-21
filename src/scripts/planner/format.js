export function getThailandNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date()).reduce((values, part) => {
    if (part.type !== "literal") values[part.type] = part.value;
    return values;
  }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function parseTime(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 8) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

export function formatClock(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const days = Math.floor(totalMinutes / 1440);
  return `${days > 0 ? (days === 1 ? "วันถัดไป " : "+" + days + " วัน ") : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} น.`;
}

export function formatMinutes(minutes) {
  const rounded = Math.max(0, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (!hours) return `${remainder.toLocaleString("th-TH")} นาที`;
  if (!remainder) return `${hours.toLocaleString("th-TH")} ชม.`;
  return `${hours.toLocaleString("th-TH")} ชม. ${remainder.toLocaleString("th-TH")} นาที`;
}

export function formatMinutesRange(leg) {
  return `${formatMinutes(leg.lowMinutes)}–${formatMinutes(leg.highMinutes)}`;
}

export function formatDistance(kilometers) {
  if (kilometers < 1) return `${Math.round(kilometers * 1000).toLocaleString("th-TH")} ม.`;
  return `${kilometers.toLocaleString("th-TH", { maximumFractionDigits: kilometers < 10 ? 1 : 0 })} กม.`;
}

export function formatDistanceRange(leg) {
  return `${formatDistance(leg.lowKm)}–${formatDistance(leg.highKm)}`;
}

export function normalize(value) {
  return String(value || "").normalize("NFC").trim().toLocaleLowerCase("th");
}

export function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
