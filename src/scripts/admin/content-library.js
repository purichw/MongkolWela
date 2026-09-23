import { adminIcon } from "./design.js";

const fieldNames = {
  title: "หัวข้อ", label: "ชื่อที่แสดง", name: "ชื่อ", nameTh: "ชื่อภาษาไทย", thName: "ชื่อภาษาไทย", th: "ชื่อภาษาไทย",
  shortLabel: "ชื่อย่อ", verse: "บทเซียมซี", interpretation: "คำทำนาย", advice: "คำแนะนำ", caution: "ข้อควรระวัง", blessing: "ข้อคิดส่งท้าย",
  description: "คำอธิบาย", intro: "บทนำ", reading: "คำอ่าน", text: "เนื้อหา", theme: "ใจความสำคัญ", time: "ช่วงเวลา", mantra: "คำภาวนา",
  image: "รูปภาพ", imageThumb: "ภาพขนาดเล็ก", href: "ลิงก์", field: "เรื่องที่เกี่ยวข้อง", high: "ช่วงคะแนนสูง", mid: "ช่วงคะแนนกลาง", low: "ช่วงคะแนนต่ำ",
  topic: "ความหมายภพ", role: "บทบาทดาว", tone: "ลักษณะเด่น", keywords: "คำสำคัญ", keywordsUpright: "คำสำคัญไพ่ตั้งตรง", keywordsReversed: "คำสำคัญไพ่กลับหัว",
  health: "สุขภาพและพลังชีวิต", career: "การงาน", love: "ความรัก", money: "การเงิน", finance: "การเงิน", fate: "โชคชะตา", personality: "บุคลิกภาพ",
  upright: "ไพ่ตั้งตรง", reversed: "ไพ่กลับหัว", uprightDetails: "ความหมายแยกด้าน", symbolism: "สัญลักษณ์", meaning: "ความหมาย", symbol: "สัญลักษณ์",
  variants: "ลักษณะเส้น", overview: "ภาพรวม", overall: "ภาพรวม", life_line: "เส้นชีวิต", head_line: "เส้นสมอง", heart_line: "เส้นหัวใจ",
  fate_line: "เส้นวาสนา", sun_line: "เส้นอาทิตย์", mercury_line: "เส้นพุธ", marriage_line: "เส้นสมรส", long_clear: "ยาวชัดเจน", short: "สั้น", broken: "ขาดตอน",
};

export function createContentLibrary({ state, api, escapeHtml: e, setTitle, setTopActions, markDirty, setStatus }) {
  let catalog;
  let error = "";
  let loading = false;
  let category = "all";
  let query = "";
  let selected = null;
  let page = 1;
  const perPage = 20;
  const draft = () => state.content.contentLibrary || {};
  const fieldLabel = path => path.split("/").map(part => fieldNames[part] || (/^\d+$/.test(part) ? String(Number(part) + 1) : part.replaceAll("_", " "))).join(" / ");
  const rows = () => (catalog || []).flatMap(group => group.records.map(record => {
    const overrides = draft()[group.key]?.[record.id] || {};
    const labelField = ["title", "nameTh", "name_th", "name", "label", "th", "thName"].find(key => record.fields.some(field => field.path === key));
    return { ...record, label: overrides[labelField] ?? record.label, fields: record.fields.map(field => ({ ...field, value: overrides[field.path] ?? field.value })), group };
  }));
  const filtered = () => rows().filter(row => (category === "all" || row.group.group === category)
    && `${row.label} ${row.id} ${row.group.title} ${row.fields.map(field => field.value).join(" ")}`.toLocaleLowerCase("th").includes(query.toLocaleLowerCase("th")));

  async function load() {
    if (loading) return;
    loading = true; error = ""; render();
    try { catalog = (await api("/api/admin/content?view=catalog")).catalog; }
    catch (failure) { error = failure.message; }
    finally { loading = false; if (state.section === "contentLibrary") render(); }
  }

  function render() {
    setTitle("คลังคำทำนาย", "เนื้อหาเครื่องมือเสริม");
    setTopActions("");
    const root = document.querySelector("#adminContent");
    if (!catalog) {
      root.innerHTML = `<div class="mw-library-message" role="status"><h2>${loading ? "กำลังโหลดคลังเนื้อหา" : "ยังโหลดคลังเนื้อหาไม่ได้"}</h2>${error ? `<p>${e(error)}</p><button class="mw-admin-btn" data-library-retry>ลองอีกครั้ง</button>` : ""}</div>`;
      if (!loading && !error) load();
      return;
    }
    if (selected) { renderEditor(root); return; }
    const categories = [...new Set(catalog.map(group => group.group))];
    const results = filtered();
    page = Math.min(page, Math.max(1, Math.ceil(results.length / perPage)));
    root.innerHTML = `<div class="mw-library-intro"><div><h2>คำอ่านที่แสดงบนเว็บไซต์</h2><p>แก้เนื้อหา บันทึกฉบับร่าง แล้วเผยแพร่เมื่อพร้อม</p></div><span>${rows().length.toLocaleString("th-TH")} รายการ</span></div>
      <div class="mw-library-categories" aria-label="หมวดเนื้อหา">
        ${["all", ...categories].map(value => `<button type="button" aria-pressed="${category === value}" data-library-category="${e(value)}">${value === "all" ? "ทั้งหมด" : e(value)}<span>${rows().filter(row => value === "all" || row.group.group === value).length}</span></button>`).join("")}
      </div>
      <div class="mw-library-toolbar"><label>${adminIcon("search")}<input type="search" data-library-search aria-label="ค้นหาคำทำนาย" placeholder="ค้นหาชื่อไพ่ เลขใบ หรือเนื้อหา" value="${e(query)}"></label><span role="status">${results.length} รายการ</span></div>
      <div class="mw-library-table" role="table" aria-label="คลังคำทำนาย"><div class="mw-library-table-head" role="row"><span role="columnheader">ชื่อรายการ</span><span role="columnheader">หมวดเนื้อหา</span><span role="columnheader">เนื้อหา</span><span role="columnheader">จัดการ</span></div>
        ${results.slice((page - 1) * perPage, page * perPage).map(row => {
          const changed = Object.keys(draft()[row.group.key]?.[row.id] || {}).length;
          return `<div class="mw-library-row" role="row"><div role="cell"><strong>${e(fieldNames[row.id] || row.label)}</strong><small>${e(row.group.title)}</small></div><span role="cell">${e(row.group.group)}</span><span role="cell" class="mw-library-status ${changed ? "is-edited" : ""}">${changed ? `ปรับแล้ว ${changed} ช่อง` : "ต้นฉบับ"}</span><div role="cell"><button class="mw-admin-btn mw-admin-btn-icon" type="button" data-library-record="${e(row.id)}" data-library-group="${e(row.group.key)}" title="แก้ไข ${e(row.label)}" aria-label="แก้ไข ${e(row.label)}">${adminIcon("pencil-line")}</button></div></div>`;
        }).join("") || '<p class="mw-library-message">ไม่พบเนื้อหาที่ตรงกับคำค้น</p>'}
      </div>
      <div class="mw-library-pagination"><button class="mw-admin-btn mw-admin-btn-icon" data-library-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า" title="หน้าก่อนหน้า">${adminIcon("chevron-left")}</button><span>หน้า ${page} / ${Math.max(1, Math.ceil(results.length / perPage))}</span><button class="mw-admin-btn mw-admin-btn-icon" data-library-page="${page + 1}" ${page * perPage >= results.length ? "disabled" : ""} aria-label="หน้าถัดไป" title="หน้าถัดไป">${adminIcon("chevron-right")}</button></div>`;
  }

  function renderEditor(root) {
    const group = catalog.find(item => item.key === selected.group);
    const record = group.records.find(item => item.id === selected.id);
    const overrides = draft()[group.key]?.[record.id] || {};
    root.innerHTML = `<div class="mw-library-editor-head"><button class="mw-admin-btn" type="button" data-library-back>${adminIcon("arrow-left")} กลับรายการ</button><div><p>${e(group.group)} / ${e(group.title)}</p><h2>${e(fieldNames[record.id] || record.label)}</h2></div><a class="mw-admin-btn" href="${e(group.routes[0])}" target="_blank" rel="noopener">${adminIcon("external-link")} เปิดหน้าเว็บ</a></div>
      <div class="mw-library-editor"><div class="mw-library-fields">${record.fields.map(field => {
        const value = overrides[field.path] ?? field.value;
        const isUrl = /(?:^|\/)(?:image|imageThumb|href|url|src)$/.test(field.path);
        return `<label class="mw-library-field"><span>${e(fieldLabel(field.path))}</span>${isUrl || value.length < 75 ? `<input data-library-field="${e(field.path)}" value="${e(value)}" maxlength="30000">` : `<textarea data-library-field="${e(field.path)}" rows="4" maxlength="30000">${e(value)}</textarea>`}<small>${Object.prototype.hasOwnProperty.call(overrides, field.path) ? "ปรับแต่งแล้ว" : "เนื้อหาต้นฉบับ"}</small></label>`;
      }).join("")}</div><aside class="mw-library-context"><h3>การเผยแพร่</h3><p>การแก้ไขยังไม่แสดงบนเว็บไซต์จนกว่าจะกดเผยแพร่</p><dl><dt>รหัสรายการ</dt><dd>${e(record.id)}</dd><dt>ช่องที่แก้ไขได้</dt><dd>${record.fields.length}</dd></dl><p>สูตรคำนวณ ลำดับไพ่ และรหัสอ้างอิงไม่เปลี่ยนตามข้อความ</p></aside></div>`;
  }

  function click(event) {
    const button = event.target.closest("[data-library-category], [data-library-record], [data-library-back], [data-library-page], [data-library-retry]");
    if (!button) return false;
    if (button.hasAttribute("data-library-retry")) { load(); return true; }
    if (button.dataset.libraryCategory) { category = button.dataset.libraryCategory; page = 1; }
    if (button.dataset.libraryRecord) selected = { group: button.dataset.libraryGroup, id: button.dataset.libraryRecord };
    if (button.hasAttribute("data-library-back")) selected = null;
    if (button.dataset.libraryPage) page = Number(button.dataset.libraryPage);
    render();
    if (selected) document.querySelector("[data-library-field]")?.focus();
    return true;
  }

  function input(event) {
    const target = event.target;
    if (target.matches("[data-library-search]")) {
      query = target.value; page = 1; render();
      const search = document.querySelector("[data-library-search]");
      search.focus();
      return true;
    }
    if (!selected || !target.matches("[data-library-field]")) return false;
    state.content.contentLibrary ||= {};
    state.content.contentLibrary[selected.group] ||= {};
    state.content.contentLibrary[selected.group][selected.id] ||= {};
    state.content.contentLibrary[selected.group][selected.id][target.dataset.libraryField] = target.value;
    target.closest("label").querySelector("small").textContent = "ปรับแต่งแล้ว";
    markDirty();
    return true;
  }
  return { render, click, input };
}
