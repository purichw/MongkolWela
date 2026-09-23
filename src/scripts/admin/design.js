import { renderIcon } from "../../lib/ui-markup.js";
import { sitePlaceholderImage } from "../../lib/image-placeholder.js";

const names = { dashboard: "house", page: "file-text", nav: "list-filter", section: "route", component: "map-pin", chart: "chart-no-axes-combined", dates: "sparkles", media: "image", users: "users", settings: "settings", alert: "info", publish: "upload" };
export const adminIcon = name => renderIcon(names[name] || name, "mw-admin-icon");

export function adminEmptyState(escapeHtml, title, { icon = "chart", detail = "", retry = false } = {}) {
  return `<div class="mw-overview-empty" role="status"><span class="mw-admin-empty-symbol">${adminIcon(icon)}</span><strong>${escapeHtml(title)}</strong>${detail ? `<p>${escapeHtml(detail)}</p>` : ""}${retry ? `<button class="mw-admin-text-link" type="button" data-action="refresh-analytics">${adminIcon("rotate-ccw")}ลองอีกครั้ง</button>` : ""}</div>`;
}

export function createAdminDesign({ state, $, escapeHtml: e, dashboardSummary, templeHealthRows, formatDateTime, setTitle, setTopActions }) {
  const number = value => Number.isFinite(Number(value)) && value !== null ? Number(value).toLocaleString("th-TH") : "—";
  const more = (section, label = "ดูทั้งหมด") => `<button class="mw-admin-text-link" type="button" data-section="${section}">${label}${adminIcon("arrow-right")}</button>`;
  const heading = (name, title, action = "", detail = "") => `<div class="mw-admin-card-head"><div><h2>${adminIcon(name)}${e(title)}</h2>${detail ? `<p>${e(detail)}</p>` : ""}</div>${action}</div>`;
  const blank = (title, options) => adminEmptyState(e, title, options);
  const analyticsBlank = (icon, detail = "ข้อมูลจะแสดงเมื่อมีการบันทึกการใช้งาน") => blank(state.secondaryLoading ? "กำลังโหลดสถิติ" : !state.analytics ? "ยังไม่สามารถโหลดสถิติได้" : "ยังไม่มีข้อมูล", { icon, detail: state.secondaryLoading ? "รอสักครู่" : !state.analytics ? "กรุณาลองอีกครั้ง หรือกลับมาตรวจสอบภายหลัง" : detail, retry: !state.secondaryLoading && !state.analytics });
  const coverage = () => state.analytics?.coverage ? `ข้อมูลที่บันทึกในช่วง 90 วัน${state.analytics.coverage.limited ? " · แสดง 10,000 เหตุการณ์ล่าสุด" : ""}` : "ข้อมูลสะสมที่มีในระบบ";
  const paths = () => Object.values(state.analytics?.paths || {}).filter(row => Number(row.count) > 0).sort((a, b) => b.count - a.count);
  const metric = (label, value, detail, name, tone) => `<article class="mw-overview-stat ${tone}"><span class="mw-overview-stat-icon">${adminIcon(name)}</span><div><p>${e(label)}</p><strong>${e(number(value))}</strong><small>${e(detail)}</small></div></article>`;
  const image = item => {
    const src = item?.temple?.images?.card?.desktop?.url || item?.temple?.imageUrl;
    return `<span class="mw-overview-thumb"><img src="${e(src || sitePlaceholderImage)}" alt="" width="50" height="46" data-admin-temple-image data-fallback-src="${sitePlaceholderImage}"></span>`;
  };
  function chartPanel() {
    const rows = paths().slice(0, 7);
    const max = Math.max(...rows.map(row => Number(row.count)), 1);
    return `<section class="mw-admin-card mw-overview-chart">${heading("chart", "หน้าที่มีการเข้าชมมากที่สุด", `<button class="mw-admin-icon-button" type="button" data-action="refresh-analytics" aria-label="รีเฟรชข้อมูลสถิติ" title="รีเฟรชข้อมูลสถิติ">${adminIcon("rotate-ccw")}</button>`, "จำนวนการเปิดหน้าเว็บที่ระบบบันทึกไว้")}
      ${!state.analytics || !rows.length ? analyticsBlank("chart", "ยังไม่มีข้อมูลการเข้าชมที่บันทึกไว้") : `<div class="mw-overview-plot">${rows.map(row => `<div class="mw-overview-column"><strong>${number(row.count)}</strong><i style="--bar:${Math.max(1, Number(row.count) / max * 100)}%" aria-hidden="true"></i><span title="${e(row.title || row.path)}">${e(row.title || row.path)}</span></div>`).join("")}</div>`}
      <p class="mw-overview-footnote">${e(coverage())} ไม่ใช่จำนวนผู้เข้าชมไม่ซ้ำ</p>
    </section>`;
  }
  function trendPanel() {
    const rows = (state.analytics?.daily || []).filter(row => Number.isFinite(Date.parse(row.date)) && row.count > 0).slice(-30);
    let body;
    if (!state.analytics || !rows.length) body = analyticsBlank("chart", "ยังไม่มีข้อมูลรายวันที่บันทึกไว้สำหรับแสดงแนวโน้ม");
    else if (rows.length < 2) body = blank("ข้อมูลยังไม่เพียงพอ", { icon: "chart", detail: "มีข้อมูลการเข้าชมเพียงวันเดียว กราฟจะแสดงเมื่อมีข้อมูลตั้งแต่ 2 วันขึ้นไป" });
    else {
      const max = Math.max(...rows.map(row => row.count), 1);
      const start = Date.parse(rows[0].date);
      const span = Math.max(1, Date.parse(rows.at(-1).date) - start);
      const points = rows.map(row => ({ ...row, x: 28 + (Date.parse(row.date) - start) / span * 584, y: 154 - row.count / max * 122 }));
      body = `<div class="mw-admin-real-trend"><svg viewBox="0 0 640 164" role="img" aria-label="การเข้าชมรายวันจากข้อมูลที่บันทึกไว้"><path class="mw-admin-trend-grid" d="M28 32H612M28 93H612M28 154H612"/><polyline points="${points.map(row => `${row.x},${row.y}`).join(" ")}"/>${points.map(row => `<circle cx="${row.x}" cy="${row.y}" r="3"><title>${e(row.date)}: ${number(row.count)} ครั้ง</title></circle>`).join("")}</svg><div class="mw-admin-trend-range"><span>${e(rows[0].date)}</span><span>${e(rows.at(-1).date)}</span></div><details><summary>ข้อมูลรายวัน</summary><ul>${rows.map(row => `<li><span>${e(row.date)}</span><b>${number(row.count)} ครั้ง</b></li>`).join("")}</ul></details></div>`;
    }
    return `<section class="mw-admin-card mw-overview-trend">${heading("chart", "แนวโน้มการเข้าชม", `<button class="mw-admin-icon-button" type="button" data-action="refresh-analytics" aria-label="รีเฟรชข้อมูลสถิติ" title="รีเฟรชข้อมูลสถิติ">${adminIcon("rotate-ccw")}</button>`, "การเปิดหน้าเว็บรายวัน · ตามเวลาไทย")}${body}<p class="mw-overview-footnote">${e(coverage())} · สูงสุด 30 วันที่มีข้อมูล</p></section>`;
  }
  function referrerPanel() {
    const rows = (state.analytics?.referrers || []).filter(row => row.count > 0);
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const colors = ["#176651", "#bb8727", "#a65146", "#68796f", "#b8b1a4"];
    // Preserve all counts while keeping a legible legend.
    const shown = rows.slice(0, 4);
    if (rows.length > 4) shown.push({ label: "แหล่งอ้างอิงอื่น ๆ", count: rows.slice(4).reduce((sum, row) => sum + row.count, 0) });
    let cursor = 0;
    const stops = shown.map((row, index) => { const from = cursor; cursor += row.count / total * 100; return `${colors[index]} ${from}% ${cursor}%`; });
    return `<section class="mw-admin-card mw-overview-referrers">${heading("chart-pie", "แหล่งอ้างอิงการเข้าชม", "", "โดเมนที่ส่งต่อมายังหน้าเว็บ")}${total ? `<div class="mw-overview-distribution"><div class="mw-overview-ring" style="--distribution:conic-gradient(${stops.join(",")})"><div><strong>${number(total)}</strong><span>การเปิดหน้าเว็บ</span></div></div><ul>${shown.map((row, index) => `<li><i style="background:${colors[index]}"></i><span>${e(row.label)}</span><b>${number(row.count)}</b></li>`).join("")}</ul></div>` : analyticsBlank("chart-pie", "ยังไม่มีข้อมูลแหล่งอ้างอิงสำหรับแสดงสัดส่วน") }<p class="mw-overview-footnote">${e(coverage())} · ไม่ใช่การนับผู้ใช้หรือช่องทางการตลาด</p></section>`;
  }
  function returningPanel() {
    return `<section class="mw-admin-card mw-overview-returning">${heading("users", "ผู้ใช้ไม่ซ้ำและผู้ใช้ที่กลับมา")}${blank("ยังไม่มีข้อมูลสำหรับรายงานนี้", { icon: "users", detail: "ระบบยังไม่ได้เก็บตัวระบุผู้ใช้หรือเซสชัน จึงยังคำนวณผู้ใช้ไม่ซ้ำและการกลับมาใช้งานไม่ได้" })}</section>`;
  }
  function qualityPanel() {
    if (state.templeLoadError) return `<section class="mw-admin-card mw-overview-quality">${heading("chart-pie", "ความพร้อมของข้อมูล")}${blank("ยังไม่สามารถโหลดข้อมูลสถานที่ได้")}</section>`;
    const health = templeHealthRows();
    const items = [{ label: "มั่นใจสูง", value: health.high.count, color: "#176651" }, { label: "ปานกลาง", value: health.mid.count, color: "#bb8727" }, { label: "ควรตรวจสอบ", value: health.low.count, color: "#a65146" }];
    const total = items.reduce((sum, item) => sum + item.value, 0);
    let cursor = 0;
    const stops = items.map(item => { const from = cursor; cursor += total ? item.value / total * 100 : 0; return `${item.color} ${from}% ${cursor}%`; }).join(",");
    return `<section class="mw-admin-card mw-overview-quality">${heading("chart-pie", "ความพร้อมของข้อมูล", "", "ระดับความมั่นใจของข้อมูลสถานที่")}
      <div class="mw-overview-distribution"><div class="mw-overview-ring" style="--distribution:${total ? `conic-gradient(${stops})` : "#e8e3d9"}"><div><strong>${state.secondaryReady ? number(total) : "—"}</strong><span>วัดและสถานที่</span></div></div>
      <ul>${items.map(item => `<li><i style="background:${item.color}"></i><span>${e(item.label)}</span><b>${state.secondaryReady ? number(item.value) : "—"}</b></li>`).join("")}</ul></div>
      ${more("temples", "ตรวจสอบข้อมูลสถานที่")}</section>`;
  }
  function templePanel() {
    const rows = paths().map(row => ({ ...row, place: state.templeCatalog.find(item => item.detailUrl.replace(/\/$/, "") === row.path.replace(/\/$/, "")) })).filter(row => row.place).slice(0, 5);
    const max = Math.max(rows[0]?.count || 0, 1);
    return `<section class="mw-admin-card mw-overview-list">${heading("sparkles", "วัดที่มีการเข้าชม", more("temples"))}${rows.length ? rows.map((row, index) => `<button class="mw-overview-place" type="button" data-edit-temple="${e(row.place.key)}"><span class="mw-overview-rank">${index + 1}</span>${image(row.place)}<span class="mw-overview-place-copy"><strong>${e(row.place.temple.name)}</strong><small>${e(row.place.temple.province)}</small><i style="--value:${row.count / max * 100}%"></i></span><b>${number(row.count)}</b></button>`).join("") : state.templeLoadError ? blank("ยังไม่สามารถโหลดข้อมูลสถานที่ได้", { icon: "component", detail: "รายการอันดับจะแสดงเมื่อโหลดข้อมูลสถานที่ได้ครบ" }) : !state.analytics ? analyticsBlank("component") : blank("ยังไม่มีสถิติที่ตรงกับหน้าสถานที่", { icon: "component", detail: "อันดับจะแสดงเมื่อมีการเข้าชมหน้าสถานที่" })}</section>`;
  }
  function pagesPanel(summary) {
    return `<section class="mw-admin-card mw-overview-list">${heading("book-open", "หน้าและเนื้อหา", more("pages"))}${summary.pagesList.slice(0, 5).map(page => `<button class="mw-overview-page" type="button" data-section="pages" data-page-jump="${e(page.id)}"><span class="mw-overview-thumb">${adminIcon(page.route?.startsWith("/temples") ? "component" : "page")}</span><span><strong>${e(page.label || page.route)}</strong><small>${e(page.route)}</small></span><mark class="${page.enabled === false ? "is-draft" : ""}">${page.enabled === false ? "ปิดไว้" : "เปิดใช้งาน"}</mark></button>`).join("") || blank("ยังไม่มีหน้าเว็บ")}</section>`;
  }
  function publishingPanel(summary) {
    const rows = [
      ["publish", "เผยแพร่ล่าสุด", formatDateTime(summary.publishedAt, "ยังไม่มีข้อมูลการเผยแพร่"), state.content.publishedBy || ""],
      ["pencil-line", "แก้ไขเนื้อหาล่าสุด", formatDateTime(summary.updatedAt, "ยังไม่มีวันที่แก้ไข"), ""],
      ["page", "หน้าที่เปิดใช้งาน", `${number(summary.livePages)} จาก ${number(summary.pages)} หน้า`, ""],
      ["nav", "เมนูที่เปิดใช้งาน", `${number(summary.navItems)} รายการ`, ""],
    ];
    return `<section class="mw-admin-card mw-overview-list">${heading("clock", "สถานะการเผยแพร่", more("pages", "จัดการ"))}<div class="mw-overview-history">${rows.map(([name, title, detail, actor]) => `<div><span>${adminIcon(name)}</span><div><strong>${e(title)}</strong><p>${e(detail)}</p>${actor ? `<small>${e(actor)}</small>` : ""}</div></div>`).join("")}</div></section>`;
  }
  function renderDashboard() {
    const summary = dashboardSummary();
    setTitle("ภาพรวมระบบ", "ภาพรวม");
    $("#adminDescription").textContent = "สรุปภาพรวมงาน การใช้งาน และข้อมูลสำคัญของมงคลเวลา";
    $("#adminContent").classList.add("is-overview");
    $("#adminContent").innerHTML = `<div class="mw-overview-stats">
      ${metric("การเข้าชมหน้าเว็บ", state.analytics?.totals?.pageviews ?? null, "จำนวนครั้งที่ระบบบันทึก", "users", "jade")}
      ${metric("กิจกรรมการใช้งาน", state.analytics?.totals?.events ?? null, "เหตุการณ์ที่บันทึกไว้", "chart", "gold")}
      ${metric("วัดและสถานที่", state.secondaryReady && !state.templeLoadError ? state.templeCatalog.length : null, "รายการในระบบจัดการ", "component", "red")}
      ${metric("หน้าเว็บ / เนื้อหา", summary.pages, `${number(summary.livePages)} หน้าเปิดใช้งาน`, "page", "jade")}
    </div><div class="mw-overview-charts">${trendPanel()}${referrerPanel()}</div><div class="mw-overview-lists">${templePanel()}${pagesPanel(summary)}${publishingPanel(summary)}</div>`;
  }
  function renderAnalytics() {
    setTitle("สถิติการใช้งาน", "ผู้ใช้งาน");
    $("#adminDescription").textContent = "ข้อมูลการเข้าชมและเหตุการณ์ที่บันทึกไว้ในระบบ";
    $("#adminContent").classList.add("is-overview");
    const events = Object.values(state.analytics?.events || {}).sort((a, b) => b.count - a.count);
    $("#adminContent").innerHTML = `<div class="mw-overview-stats">${metric("การเข้าชมหน้าเว็บ", state.analytics?.totals?.pageviews ?? null, "ข้อมูลสะสม", "users", "jade")}${metric("กิจกรรมการใช้งาน", state.analytics?.totals?.events ?? null, "ข้อมูลสะสม", "chart", "gold")}${metric("หน้าที่มีการเข้าชม", state.analytics ? paths().length : null, "เส้นทางที่บันทึกไว้", "page", "red")}${metric("ประเภทเหตุการณ์", state.analytics ? events.length : null, "ประเภทที่บันทึกไว้", "dates", "jade")}</div>
    <div class="mw-overview-charts">${trendPanel()}${referrerPanel()}</div>
    <div class="mw-overview-charts">${chartPanel()}<section class="mw-admin-card">${heading("dates", "เหตุการณ์การใช้งาน")}${events.length ? `<div class="mw-overview-events">${events.map(row => `<div><strong>${e(row.type)}</strong><b>${number(row.count)}</b><small>${e(formatDateTime(row.lastSeenAt))}</small></div>`).join("")}</div>` : analyticsBlank("dates", "ยังไม่มีเหตุการณ์ที่บันทึกไว้")}</section></div>
    <div class="mw-overview-charts">${returningPanel()}${qualityPanel()}</div>
    <section class="mw-admin-card">${heading("info", "ขอบเขตของข้อมูล") }<p>${e(coverage())} · ยอดเข้าชมคือจำนวนการเปิดหน้าเว็บ ไม่ใช่จำนวนคน</p>${state.analytics?.updatedAt ? `<p>อัปเดตล่าสุด ${e(formatDateTime(state.analytics.updatedAt))}</p>` : ""}</section>`;
  }
  function renderSearch(query) {
    const target = $("#adminSearchResults");
    const input = $("#adminGlobalSearch");
    if (!target || !input) return;
    const q = query.trim().toLocaleLowerCase("th");
    target.hidden = !q;
    if (!q) return;
    const places = state.templeCatalog.filter(item => `${item.temple.name} ${item.temple.province}`.toLocaleLowerCase("th").includes(q)).slice(0, 5);
    const pages = (state.content?.pages || []).filter(item => `${item.label} ${item.route}`.toLocaleLowerCase("th").includes(q)).slice(0, 4);
    target.innerHTML = `${places.map(item => `<button type="button" data-edit-temple="${e(item.key)}">${adminIcon("component")}<span><strong>${e(item.temple.name)}</strong><small>${e(item.temple.province)}</small></span></button>`).join("")}${pages.map(item => `<button type="button" data-section="pages" data-page-jump="${e(item.id)}">${adminIcon("page")}<span><strong>${e(item.label)}</strong><small>${e(item.route)}</small></span></button>`).join("")}` || `<p role="status">ไม่พบวัดหรือหน้าเว็บที่ตรงกับคำค้น</p>`;
  }
  function closeSearch() {
    if ($("#adminSearchResults")) $("#adminSearchResults").hidden = true;
  }
  return { renderDashboard, renderAnalytics, renderSearch, closeSearch };
}
