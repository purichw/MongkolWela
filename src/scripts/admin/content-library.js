import { adminIcon } from "./design.js";

const fieldNames = {
  title: "หัวข้อ", label: "ชื่อที่แสดง", name: "ชื่อ", nameTh: "ชื่อภาษาไทย", thName: "ชื่อภาษาไทย", th: "ชื่อภาษาไทย",
  shortLabel: "ชื่อย่อ", verse: "บทเซียมซี", interpretation: "คำทำนาย", advice: "คำแนะนำ", caution: "ข้อควรระวัง", blessing: "ข้อคิดสำคัญ",
  description: "คำอธิบาย", intro: "บทนำ", reading: "คำอ่าน", text: "เนื้อหา", theme: "ใจความสำคัญ", time: "ช่วงเวลา", mantra: "คำภาวนา",
  image: "รูปภาพ", imageThumb: "ภาพขนาดเล็ก", href: "ลิงก์", field: "เรื่องที่เกี่ยวข้อง", high: "ช่วงคะแนนสูง", mid: "ช่วงคะแนนกลาง", low: "ช่วงคะแนนต่ำ",
  topic: "ความหมายภพ", role: "บทบาทดาว", tone: "ลักษณะเด่น", keywords: "คำสำคัญ", keywordsUpright: "คำสำคัญไพ่ตั้งตรง", keywordsReversed: "คำสำคัญไพ่กลับหัว",
  health: "สุขภาพและพลังชีวิต", career: "การงาน", love: "ความรัก", money: "การเงิน", finance: "การเงิน", fate: "โชคชะตา", personality: "บุคลิกภาพ",
  upright: "ไพ่ตั้งตรง", reversed: "ไพ่กลับหัว", uprightDetails: "ความหมายแยกด้าน", symbolism: "สัญลักษณ์", meaning: "ความหมาย", symbol: "สัญลักษณ์",
  variants: "ลักษณะเส้น", overview: "ภาพรวม", overall: "ภาพรวม", life_line: "เส้นชีวิต", head_line: "เส้นสมอง", heart_line: "เส้นหัวใจ",
  fate_line: "เส้นวาสนา", sun_line: "เส้นอาทิตย์", mercury_line: "เส้นพุธ", marriage_line: "เส้นสมรส", long_clear: "ยาวชัดเจน", short: "สั้น", broken: "ขาดตอน",
};

const labelFields = ["title", "nameTh", "name_th", "name", "label", "th", "thName"];
const narrativeFields = new Set(["verse", "interpretation", "advice", "caution", "blessing", "description", "intro", "reading", "text", "overview", "overall", "meaning", "upright", "reversed", "high", "mid", "low"]);

export function createContentLibrary({ state, api, escapeHtml: e, setTitle, setTopActions, markDirty }) {
  let catalog;
  let error = "";
  let loading = false;
  let category = "all";
  let query = "";
  let selected = null;
  let page = 1;
  let listScroll = 0;
  let returnRecord = null;
  const perPage = 20;
  const draft = () => state.content.contentLibrary || {};
  const fieldLabel = path => path.split("/").map(part => fieldNames[part] || (/^\d+$/.test(part) ? String(Number(part) + 1) : part.replaceAll("_", " "))).join(" / ");
  const rows = () => (catalog || []).flatMap(group => group.records.map(record => {
    const overrides = draft()[group.key]?.[record.id] || {};
    const labelField = labelFields.find(key => record.fields.some(field => field.path === key));
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
    const labelField = labelFields.find(key => record.fields.some(field => field.path === key));
    const recordLabel = overrides[labelField] ?? fieldNames[record.id] ?? record.label;
    document.querySelector(".mw-admin-main").classList.add("is-library-editor");
    document.querySelector("#adminKicker").textContent = `คลังคำทำนาย / ${group.group} / ${group.title}`;
    const websiteLink = `<a class="mw-admin-btn" href="${e(group.routes[0])}" target="_blank" rel="noopener" aria-label="เปิดหน้าเว็บ ${e(group.group)} (แท็บใหม่)" title="เปิดหน้าเว็บ (แท็บใหม่)">${adminIcon("external-link")}<span>เปิดหน้าเว็บ</span></a>`;
    document.querySelector(".mw-admin-header-actions").insertAdjacentHTML("beforeend", `<div data-library-header>${websiteLink}</div>`);
    root.innerHTML = `<div class="mw-library-editor-head"><button class="mw-admin-btn" type="button" data-library-back aria-label="กลับรายการ" title="กลับรายการ">${adminIcon("arrow-left")}<span>กลับรายการ</span></button><div><p>${e(group.group)} / ${e(group.title)}</p><h2 data-library-title tabindex="-1">${e(recordLabel || "ยังไม่มีชื่อรายการ")}</h2></div><div class="mw-library-mobile-link">${websiteLink}</div></div>
      <div class="mw-library-editor"><details class="mw-library-form" open><summary><span class="mw-library-section-icon">${adminIcon("file-text")}</span><h3>${group.key === "seamsi.seamsiFortunes" ? "รายละเอียดใบเซียมซี" : "ข้อมูลคำทำนาย"}</h3>${adminIcon("chevron-down")}</summary><div class="mw-library-fields">${record.fields.map((field, index) => {
        const value = overrides[field.path] ?? field.value;
        const isUrl = /(?:^|\/)(?:image|imageThumb|href|url|src)$/.test(field.path);
        const multiline = !isUrl && (narrativeFields.has(field.path.split("/").at(-1)) || field.value.length >= 75);
        const customized = Object.prototype.hasOwnProperty.call(overrides, field.path);
        const fieldRows = ["interpretation", "overview", "description"].includes(field.path) ? 3 : field.value.length >= 100 ? 2 : 1;
        return `<div class="mw-library-field${customized ? " is-customized" : ""}"><label for="library-field-${index}">${e(fieldLabel(field.path))}</label>${multiline ? `<textarea id="library-field-${index}" data-library-field="${e(field.path)}" rows="${fieldRows}" maxlength="30000" aria-describedby="library-source-${index}">${e(value)}</textarea>` : `<input id="library-field-${index}" data-library-field="${e(field.path)}" value="${e(value)}" maxlength="30000" aria-describedby="library-source-${index}"${isUrl ? ' inputmode="url"' : ""}>`}<small id="library-source-${index}">${customized ? "ปรับแต่งแล้ว" : "เนื้อหาต้นฉบับ"}</small></div>`;
      }).join("")}</div></details><aside class="mw-library-context"><details class="mw-library-publication" open><summary><span class="mw-library-section-icon">${adminIcon("chart")}</span><h3>ข้อมูลการเผยแพร่</h3>${adminIcon("chevron-down")}</summary><div class="mw-library-publication-body"><p class="mw-library-publication-timing">การแก้ไขยังไม่แสดงบนเว็บไซต์จนกว่าจะกดเผยแพร่</p><dl><div><dt>รหัสรายการ</dt><dd>${e(record.id)}</dd></div><div><dt>ช่องที่แก้ไขได้</dt><dd>${record.fields.length}</dd></div></dl><p class="mw-library-engine-note">${adminIcon("info")}<span>สูตรคำนวณ ลำดับไพ่ และรหัสอ้างอิงไม่เปลี่ยนตามข้อความ</span></p></div></details></aside></div>`;
  }

  function click(event) {
    const button = event.target.closest("[data-library-category], [data-library-record], [data-library-back], [data-library-page], [data-library-retry]");
    if (!button) return false;
    if (button.hasAttribute("data-library-retry")) { load(); return true; }
    if (button.dataset.libraryCategory) { category = button.dataset.libraryCategory; page = 1; }
    if (button.dataset.libraryRecord) {
      listScroll = window.scrollY;
      selected = { group: button.dataset.libraryGroup, id: button.dataset.libraryRecord };
      returnRecord = selected;
    }
    if (button.hasAttribute("data-library-back")) selected = null;
    if (button.dataset.libraryPage) page = Number(button.dataset.libraryPage);
    render();
    if (selected) {
      window.scrollTo({ top: 0, behavior: "instant" });
      document.querySelector("[data-library-title]")?.focus({ preventScroll: true });
    } else if (button.hasAttribute("data-library-back")) {
      window.scrollTo({ top: listScroll, behavior: "instant" });
      [...document.querySelectorAll("[data-library-record]")].find(item => item.dataset.libraryRecord === returnRecord?.id && item.dataset.libraryGroup === returnRecord?.group)?.focus({ preventScroll: true });
    }
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
    target.closest(".mw-library-field").querySelector("small").textContent = "ปรับแต่งแล้ว";
    target.closest(".mw-library-field").classList.add("is-customized");
    const record = catalog.find(group => group.key === selected.group).records.find(item => item.id === selected.id);
    const labelField = labelFields.find(key => record.fields.some(field => field.path === key));
    if (target.dataset.libraryField === labelField) document.querySelector("[data-library-title]").textContent = target.value || "ยังไม่มีชื่อรายการ";
    markDirty();
    return true;
  }
  return { render, click, input };
}
