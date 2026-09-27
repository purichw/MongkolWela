import { adminIcon } from "./design.js";
import { analyticsDay, analyticsPreset, analyticsRange, analyticsSeries, analyticsReportCsv } from "../../lib/admin-analytics-report.js";

const number = value => Number.isFinite(value) ? value.toLocaleString("th-TH") : "—";
const dateLabel = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(value)) : "ไม่ระบุ";
const eventLabels = { search: "ค้นหา", temple_search: "ค้นหาสถานที่", share: "แชร์เนื้อหา", copy_link: "คัดลอกลิงก์", planner_add: "เพิ่มสถานที่ในแผน", plan_add: "เพิ่มสถานที่ในแผน", print: "พิมพ์", download: "ดาวน์โหลด", tarot_reading: "ดูคำทำนาย" };
const colors = ["#175d4c", "#c4963f", "#487d95", "#927ba9", "#a6aca7"];

export function createAdminAnalytics({ state, api, escapeHtml: e, setTitle, setTopActions, formatDateTime }) {
  let period = "default", result = null, loading = false, error = "", requestId = 0, awaitingRange = false;
  let dates = analyticsPreset(30);
  const expanded = new Set();
  const $ = selector => document.querySelector(selector);
  const data = () => period === "default" ? state.analytics : result;
  const busy = () => loading || (period === "default" && state.secondaryLoading);
  const button = (label, icon, action, extra = "") => `<button type="button" class="mw-admin-btn" data-analytics-action="${action}" title="${e(label)}" ${extra}>${adminIcon(icon)}${e(label)}</button>`;
  const heading = (icon, title, extra = "") => `<div class="mw-analytics-panel-heading"><h2>${adminIcon(icon)}${e(title)}</h2>${extra}</div>`;
  const empty = message => `<div class="mw-analytics-empty">${adminIcon("chart")}<p>${e(message)}</p></div>`;
  const more = (key, count) => count > 5 ? `<button type="button" class="mw-admin-text-link" data-analytics-expand="${key}" aria-expanded="${expanded.has(key)}">${expanded.has(key) ? "ย่อรายการ" : "ดูทั้งหมด"}${adminIcon("arrow-right")}</button>` : "";

  function metric(label, value, icon, detail) {
    return `<article class="mw-analytics-metric"><span class="mw-analytics-medallion">${adminIcon(icon)}</span><div><h2>${e(label)}</h2><strong>${number(value)}</strong><small>${e(detail)}</small></div></article>`;
  }

  function trend(summary) {
    const rows = analyticsSeries(summary);
    const hasEvents = Array.isArray(summary?.eventDaily);
    const legend = `<div class="mw-analytics-legend"><span><i></i>เปิดหน้าเว็บ</span>${hasEvents ? '<span><i class="is-gold"></i>เหตุการณ์</span>' : ""}</div>`;
    const max = Math.max(4, ...rows.flatMap(row => [row.pageviews, hasEvents ? row.events : 0]));
    const scale = Math.ceil(max / 4) * 4;
    const point = (row, index, key, width) => ({ x: 48 + index / Math.max(1, rows.length - 1) * (width - 70), y: 186 - row[key] / scale * 152 });
    const line = (key, tone, width) => {
      const points = rows.map((row, index) => point(row, index, key, width));
      return `<path class="mw-analytics-area ${tone}" d="M48 186 ${points.map(p => `L${p.x} ${p.y}`).join(" ")} L${points.at(-1)?.x || 48} 186 Z"/><polyline class="mw-analytics-line ${tone}" points="${points.map(p => `${p.x},${p.y}`).join(" ")}"/>${points.map((p, index) => `<circle class="mw-analytics-dot ${tone}" cx="${p.x}" cy="${p.y}" r="${rows.length > 35 ? 2 : 3.2}"><title>${e(dateLabel(rows[index].date))}: ${number(rows[index][key])} ${key === "pageviews" ? "การเปิดหน้าเว็บ" : "เหตุการณ์"}</title></circle>`).join("")}`;
    };
    const tickIndexes = [...new Set([0, Math.floor((rows.length - 1) / 3), Math.floor((rows.length - 1) * 2 / 3), rows.length - 1])].filter(index => index >= 0 && index < rows.length);
    const chartAt = width => `<svg class="mw-analytics-chart-${width}" viewBox="0 0 ${width} 222" role="img" aria-labelledby="analyticsChartTitle${width} analyticsChartDescription${width}"><title id="analyticsChartTitle${width}">แนวโน้มการใช้งานรายวัน</title><desc id="analyticsChartDescription${width}">${e(`${dateLabel(rows[0]?.date)} ถึง ${dateLabel(rows.at(-1)?.date)} การเปิดหน้าเว็บ ${number(summary?.totals?.pageviews)} ครั้ง อ่านค่าทั้งหมดได้ที่ข้อมูลรายวันใต้กราฟ`)}</desc>${Array.from({ length: 5 }, (_, i) => `<path class="mw-analytics-gridline" d="M48 ${186 - i * 38}H${width - 22}"/><text x="38" y="${190 - i * 38}" text-anchor="end">${number(scale * i / 4)}</text>`).join("")}${line("pageviews", "", width)}${hasEvents ? line("events", "is-gold", width) : ""}${tickIndexes.map(index => `<text x="${point(rows[index], index, "pageviews", width).x}" y="213" text-anchor="${index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"}">${e(dateLabel(rows[index].date))}</text>`).join("")}</svg>`;
    const chart = rows.length ? chartAt(650) + chartAt(340) : "";
    return `<section class="mw-analytics-panel mw-analytics-trend">${heading("chart", "แนวโน้มการใช้งาน", legend)}${rows.length ? `${chart}<details class="mw-analytics-data"><summary>ข้อมูลรายวัน <span>เวลาไทย</span></summary><div class="mw-analytics-table-scroll"><table><caption class="sr-only">ข้อมูลจากกราฟรายวัน</caption><thead><tr><th>วันที่</th><th>เปิดหน้าเว็บ</th>${hasEvents ? "<th>เหตุการณ์</th>" : ""}</tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${e(row.date)}</th><td>${number(row.pageviews)}</td>${hasEvents ? `<td>${number(row.events)}</td>` : ""}</tr>`).join("")}</tbody></table></div></details>` : empty(summary ? "ยังไม่มีข้อมูลรายวันในช่วงนี้" : busy() ? "กำลังโหลดสถิติ" : "ไม่สามารถแสดงกราฟได้")}</section>`;
  }

  function sources(summary) {
    const all = (summary?.referrers || []).filter(row => row.count > 0);
    const total = all.reduce((sum, row) => sum + row.count, 0);
    const rows = expanded.has("sources") ? [...all] : all.slice(0, 4);
    if (!expanded.has("sources") && all.length > 4) rows.push({ label: "แหล่งอ้างอิงอื่น ๆ", count: all.slice(4).reduce((sum, row) => sum + row.count, 0) });
    let cursor = 0;
    const stops = rows.map((row, index) => { const start = cursor; cursor += row.count / total * 100; return `${colors[index % colors.length]} ${start}% ${cursor}%`; });
    return `<section class="mw-analytics-panel mw-analytics-sources">${heading("globe", "แหล่งอ้างอิงการเข้าชม", more("sources", all.length))}${total ? `<div class="mw-analytics-distribution"><div class="mw-analytics-ring" style="--ring:conic-gradient(${stops.join(",")})" aria-label="การเปิดหน้าเว็บ ${number(total)} ครั้ง"><div><strong>${number(total)}</strong><span>การเปิดหน้าเว็บ</span></div></div><ul>${(expanded.has("sources") ? all : rows).map((row, index) => `<li><i style="--swatch:${colors[index % colors.length]}"></i><span title="${e(row.label)}">${e(row.label)}</span><b>${(row.count / total * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%</b></li>`).join("")}</ul></div>` : empty(summary ? "ยังไม่มีข้อมูลแหล่งอ้างอิง" : "ไม่มีข้อมูลสำหรับแสดงสัดส่วน")}<p class="mw-analytics-note">โดเมนที่บันทึกไว้ ไม่ใช่การระบุช่องทางการตลาด</p></section>`;
  }

  function rankings(summary) {
    const paths = Object.values(summary?.paths || {}).sort((a, b) => b.count - a.count);
    const events = Object.values(summary?.events || {}).sort((a, b) => b.count - a.count);
    const list = (rows, key) => expanded.has(key) ? rows : rows.slice(0, 5);
    const maximum = Math.max(1, paths[0]?.count || 0);
    return `<section class="mw-analytics-panel mw-analytics-pages">${heading("page", "หน้าเว็บยอดนิยม", more("pages", paths.length))}${paths.length ? `<ol class="mw-analytics-rankings">${list(paths, "pages").map((row, index) => `<li><span class="mw-analytics-rank">${index + 1}</span><div><span title="${e(row.path)}">${e(row.title || row.path)}</span><i style="--value:${row.count / maximum * 100}%" aria-hidden="true"></i></div><b>${number(row.count)}</b></li>`).join("")}</ol>` : empty("ยังไม่มีข้อมูลหน้าที่เข้าชม")}</section><section class="mw-analytics-panel mw-analytics-events">${heading("sparkles", "กิจกรรมการใช้งาน", more("events", events.length))}${events.length ? `<ul>${list(events, "events").map(row => `<li><span class="mw-analytics-event-icon">${adminIcon(row.type.includes("search") ? "search" : row.type.includes("share") ? "share-2" : "file-text")}</span><span title="${e(row.type)}">${e(eventLabels[row.type] || row.type)}</span><b>${number(row.count)} <small>ครั้ง</small></b></li>`).join("")}</ul>` : empty("ยังไม่มีเหตุการณ์ในช่วงนี้")}</section><section class="mw-analytics-panel mw-analytics-returning">${heading("users", "ผู้ใช้ที่กลับมา")}<div class="mw-analytics-unavailable"><span>${adminIcon("users")}</span><div><strong>ยังวัดไม่ได้</strong><p>ยังไม่มีข้อมูลผู้ใช้ไม่ซ้ำ</p></div></div><p class="mw-analytics-note">ระบบไม่ได้เก็บตัวระบุผู้ใช้ จึงยังแยกผู้ใช้ใหม่และผู้ใช้ที่กลับมาไม่ได้</p></section>`;
  }

  function quality(summary) {
    const limited = summary?.coverage?.limited;
    const range = summary?.coverage;
    const status = awaitingRange ? "เลือกช่วงวันที่" : busy() ? "กำลังโหลดข้อมูล" : !summary ? "โหลดข้อมูลไม่สำเร็จ" : limited ? "แสดงข้อมูลบางส่วน" : "โหลดข้อมูลสำเร็จ";
    return `<section class="mw-analytics-quality">${heading("database", "ความพร้อมของข้อมูล")}<div class="mw-analytics-quality-grid"><div><span class="mw-analytics-quality-icon ${limited || !summary ? "is-warn" : ""}">${adminIcon(limited || !summary ? "info" : "circle-check")}</span><div><strong>${status}</strong><p>${summary ? limited ? `จำกัด ${number(range.limit || 10000)} เหตุการณ์ล่าสุด` : "ตามรายการที่ระบบบันทึกไว้" : "ลองโหลดข้อมูลอีกครั้ง"}</p></div></div><div><div><strong>ช่วงข้อมูล</strong><p>${range ? `${e(dateLabel(range.since))} – ${e(dateLabel(range.until))}` : "ข้อมูลสะสม ไม่ระบุช่วงวันที่"}</p><small>ยังไม่มีค่าประเมินความครบถ้วน</small></div></div><div>${adminIcon("clock")}<div><strong>โหลดข้อมูลล่าสุด</strong><p>${e(summary?.updatedAt ? formatDateTime(summary.updatedAt) : "ยังไม่มีข้อมูล")}</p><small>${summary?.lastRecordedAt ? `บันทึกเหตุการณ์ล่าสุด ${e(formatDateTime(summary.lastRecordedAt))}` : "ยังไม่มีเวลาเหตุการณ์ล่าสุด"}</small></div></div></div></section>`;
  }

  function render() {
    setTitle("สถิติการใช้งาน", "ผู้ใช้งาน");
    $(".mw-admin-main").classList.add("is-analytics");
    $("#adminDescription").textContent = "ภาพรวมการเข้าชมหน้าเว็บและกิจกรรมการใช้งานมงคลเวลา";
    const summary = busy() || error ? null : data();
    const options = [["default", "ข้อมูลที่มีในระบบ"], ["7", "7 วันที่ผ่านมา"], ["30", "30 วันที่ผ่านมา"], ["90", "90 วันที่ผ่านมา"], ["custom", "กำหนดช่วงวันที่"]];
    setTopActions(`<div class="mw-analytics-tools"><label class="mw-analytics-period">${adminIcon("calendar-days")}<select aria-label="ช่วงเวลาสถิติ" data-analytics-period>${options.map(([value, label]) => `<option value="${value}" ${period === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>${button("ดาวน์โหลดรายงาน", "download", "export", !summary ? "disabled" : "")}<button type="button" class="mw-admin-icon-button" data-analytics-action="refresh" aria-label="รีเฟรชสถิติ" title="รีเฟรชสถิติ" ${busy() ? "disabled" : ""}>${adminIcon("rotate-ccw")}</button></div>`);
    const rangeForm = period === "custom" ? `<form class="mw-analytics-date-form" data-analytics-range><label>วันที่เริ่มต้น<input name="from" type="date" required value="${e(dates.from)}" max="${analyticsDay(new Date())}"></label><span>ถึง</span><label>วันที่สิ้นสุด<input name="to" type="date" required value="${e(dates.to)}" max="${analyticsDay(new Date())}"></label><button class="mw-admin-btn" type="submit" ${busy() ? "disabled" : ""}>ใช้ช่วงวันที่</button><small>สูงสุด 90 วัน · เวลาไทย</small></form>` : "";
    const tools = $(".mw-analytics-tools");
    tools.dataset.analyticsHeader = "";
    $(".mw-admin-top").append(tools);
    const notice = error || (!awaitingRange && !busy() && !data() ? "ไม่สามารถโหลดสถิติได้ กรุณาลองอีกครั้ง" : "");
    const detail = summary?.coverage ? "ในช่วงวันที่รายงาน" : "จากข้อมูลที่บันทึกไว้";
    $("#adminContent").innerHTML = `<div class="mw-analytics" aria-busy="${busy()}">${rangeForm}${notice ? `<div class="mw-analytics-notice" role="alert"><span>${adminIcon("info")}${e(notice)}</span>${button("ลองอีกครั้ง", "rotate-ccw", "refresh")}</div>` : ""}${summary?.coverage?.limited ? '<p class="mw-analytics-notice" role="status">รายงานนี้เป็นข้อมูลบางส่วน ยอดรวมและสัดส่วนอาจต่ำกว่าการใช้งานจริง</p>' : ""}<div class="mw-analytics-metrics">${metric("การเปิดหน้าเว็บ", summary?.totals?.pageviews, "eye", detail)}${metric("กิจกรรมการใช้งาน", summary?.totals?.events, "chart", detail)}${metric("หน้าที่มีการเข้าชม", summary ? Object.keys(summary.paths || {}).length : null, "page", "หน้าที่มีการบันทึกการเข้าชม")}${metric("ประเภทเหตุการณ์", summary ? Object.keys(summary.events || {}).length : null, "sparkles", "ประเภทที่มีการใช้งาน")}</div><div class="mw-analytics-primary">${trend(summary)}${sources(summary)}</div><div class="mw-analytics-secondary">${rankings(summary)}</div>${quality(summary)}<details class="mw-analytics-scope"><summary>${adminIcon("info")}ขอบเขตของข้อมูล<span>อ่านเพิ่มเติม ${adminIcon("chevron-down")}</span></summary><p>ยอดเปิดหน้าเว็บและเหตุการณ์ไม่ใช่จำนวนคน ข้อมูลเฉพาะที่ระบบบันทึกได้ ไม่รวมเส้นทาง /admin และอาจไม่รวมผู้ที่ไม่ยินยอมให้เก็บสถิติ</p><p>แหล่งอ้างอิงเป็นโดเมนที่ส่งมากับคำขอ อาจเป็นโดเมนของเว็บไซต์เอง การไม่มีแหล่งอ้างอิงไม่ได้แปลว่าเข้าชมโดยตรง ยังไม่มีการวัดผู้ใช้ใหม่ ผู้ใช้ที่กลับมา หรือเปอร์เซ็นต์ความครบถ้วนของข้อมูล</p></details><p class="mw-analytics-announcement" aria-live="polite">${busy() ? "กำลังโหลดสถิติ" : ""}</p></div>`;
  }

  async function load() {
    awaitingRange = false;
    let range = null;
    try {
      if (period !== "default") {
        if (period !== "custom") dates = analyticsPreset(Number(period));
        range = analyticsRange(dates.from, dates.to);
      }
    } catch (failure) { error = failure.message; render(); return; }
    const id = ++requestId;
    loading = true; error = ""; render();
    try {
      const query = range ? `?${new URLSearchParams({ from: dates.from, to: dates.to })}` : "";
      const payload = await api(`/api/admin/analytics${query}`);
      if (!payload.analytics?.totals) throw new Error("รูปแบบข้อมูลสถิติไม่ถูกต้อง");
      if (id !== requestId) return;
      if (period === "default") state.analytics = payload.analytics;
      else result = payload.analytics;
    } catch (failure) { if (id === requestId) error = failure.message || "โหลดข้อมูลไม่สำเร็จ"; }
    finally { if (id === requestId) { loading = false; if (state.section === "analytics") render(); } }
  }

  document.addEventListener("change", event => {
    if (!event.target.matches("[data-analytics-period]")) return;
    period = event.target.value; result = null; error = ""; requestId++; loading = false;
    awaitingRange = period === "custom";
    if (awaitingRange) { render(); $("[data-analytics-range] input")?.focus(); }
    else load();
  });
  document.addEventListener("submit", event => {
    if (!event.target.matches("[data-analytics-range]")) return;
    event.preventDefault();
    const values = new FormData(event.target);
    dates = { from: String(values.get("from")), to: String(values.get("to")) };
    load();
  });
  document.addEventListener("click", event => {
    const expansion = event.target.closest("[data-analytics-expand]");
    if (expansion) {
      const key = expansion.dataset.analyticsExpand;
      if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
      render(); $(`[data-analytics-expand="${key}"]`)?.focus(); return;
    }
    const action = event.target.closest("[data-analytics-action]")?.dataset.analyticsAction;
    if (action === "refresh") load();
    if (action === "export" && data() && !busy() && !error) {
      const url = URL.createObjectURL(new Blob([analyticsReportCsv(data())], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `mongkolwela-analytics-${analyticsDay(new Date())}.csv`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  return { render };
}
