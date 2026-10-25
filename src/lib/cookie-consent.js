export const analyticsConsentKey = "mongkolwela.pdpa.analytics";

export const consentCopy = Object.freeze({
  titleText: "เพื่อให้การเดินทางบนมงคลเวลา ราบรื่นและเหมาะกับคุณยิ่งขึ้น",
  bannerText: "มงคลเวลาใช้คุกกี้ที่จำเป็นต่อการทำงานของเว็บไซต์ และใช้ข้อมูลการใช้งานแบบไม่ระบุตัวตนเพื่อวิเคราะห์และพัฒนาเครื่องมือของเรา ให้ทุกการค้นหาเส้นทางมงคลและข้อมูลประกอบการเดินทางสะดวกยิ่งขึ้น โดยเคารพสิทธิ์ความเป็นส่วนตัวของคุณเสมอ",
  acceptLabel: "ยอมรับและใช้งานต่อ",
  declineLabel: "ใช้เฉพาะที่จำเป็น",
  settingsLabel: "ตั้งค่าคุกกี้",
});

// Upgrade only previously shipped defaults; authored CMS copy stays authoritative.
const legacyCopy = {
  titleText: ["การใช้คุกกี้และข้อมูลการใช้งาน"],
  bannerText: [
    "มงคลเวลาใช้คุกกี้ที่จำเป็นเพื่อให้เว็บไซต์ทำงานได้ตามปกติ และขออนุญาตใช้คุกกี้วิเคราะห์แบบไม่ระบุตัวตน เพื่อปรับปรุงประสบการณ์การใช้งานของคุณ",
    "มงคลเวลาใช้คุกกี้/ข้อมูลการใช้งานแบบไม่ระบุตัวตนเพื่อปรับปรุงเว็บไซต์ตาม PDPA",
  ],
  acceptLabel: ["ยอมรับ", "ยอมรับทั้งหมด"],
  declineLabel: ["ปฏิเสธ", "ไม่ใช้งาน", "ไม่ใช้งาน Analytics"],
};

export function resolveConsentCopy(pdpa = {}) {
  return Object.fromEntries(Object.entries(consentCopy).map(([key, fallback]) => {
    const value = typeof pdpa[key] === "string" ? pdpa[key].trim() : "";
    return [key, !value || legacyCopy[key]?.includes(value) ? fallback : value];
  }));
}

export function validConsent(value) {
  return value === "accepted" || value === "declined" ? value : null;
}
