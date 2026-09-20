export const COMMERCE_TYPES = {
  organizations: "ร้านค้าและวัด", products: "สินค้า", campaigns: "กฐินและร่วมบุญ",
  channels: "ช่องทาง e-Donation", orders: "คำขอสั่งซื้อ", bookings: "รายการจอง", members: "สิทธิ์ทีมงาน",
};
export const COMMERCE_STATUS = {
  draft: "ฉบับร่าง", review: "รอตรวจสอบ", active: "เปิดใช้งาน", suspended: "ระงับ",
  published: "เผยแพร่", archived: "เก็บเข้าคลัง", requested: "รอพิจารณา",
  accepted: "ยืนยันสินค้าแล้ว", held: "จองชั่วคราว", confirmed: "ยืนยันการจอง",
  cancelled: "ยกเลิก", expired: "หมดเวลายืนยัน", paused: "พักรับรายการ", closed: "ปิดรับ",
};
export const RD_DONATION_DIRECTORY = "https://data.rd.go.th/th/dataset/ds_edonation";
export function money(satang) { return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(satang || 0) / 100); }
export function escapeCommerce(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
export function thaiCommerceDate(value) { return value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value)) : "ยังไม่ระบุ"; }
