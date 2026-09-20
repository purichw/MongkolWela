# Calendar Day: การแกะแบบและนำไปใช้

วันที่: 21 กันยายน 2026
ขอบเขต: `/calendar/day/` เท่านั้น พร้อม light variant ของ shared Footer
วิธีทำ: mockup-led adaptation จากภาพ Desktop และ Mobile ไม่มี spec ต้นทาง

## หลักการอ่านแบบ

ภาพสองขนาดมี composition คนละแบบ ไม่ใช่ Desktop ที่ย่อฟอนต์ลงทั้งหมด:

| ส่วน | Desktop | Mobile |
| --- | --- | --- |
| Header | ใช้ compact shared shell เดิม | โลโก้ / ค้นหา / CTA / เมนู ใช้ shell เดิม |
| Hero | เต็มความกว้าง ฉากวัดด้านขวา ข้อความซ้าย breadcrumb และ icon kicker | ครอปฉากใหม่ วันที่และจันทรคติอยู่ก่อน quote แบบ center |
| นำทางวัน | สามปุ่มพื้นเขียวโปร่ง ขอบทอง อยู่ข้าง quote | สามปุ่มเท่ากันเต็มแถว ไม่เลื่อนหลุดจอ |
| ข้อมูลหลัก | สองคอลัมน์ประมาณ 48:52 ขอบบนและล่างตรงกัน | เรียง facts แล้วจักรวัน |
| Facts | ไอคอนวงทอง หัวเรื่อง+subtitle badge ข้างขึ้น/แรม และ grid 2x3 | คง 2x3 ไม่เปลี่ยนเป็นรายการหกแถว |
| จักรวัน | วงกลมด้านซ้าย คำอธิบายพื้นอ่อนด้านขวา | ยังเป็นสองส่วน มีปุ่มขยายแผนภาพสำหรับอ่านรายละเอียด |
| คำแนะนำ | สามรายการเปิดพร้อมกัน มีสีเขียว/แดง/ทองและ medallion | หัวกลุ่มเดียวกับ native disclosure สามแถว เริ่มปิด |
| แหล่งข้อมูล | heading ซ้าย เนื้อหาและรายละเอียดขวา | disclosure สั้น เปิดอ่านข้อความและเครดิตได้ |
| Footer | light variant พร้อมลวดลายและคอลัมน์ลิงก์ | โลโก้/คำอธิบาย + CTA และเมนูพับ ใช้ปลายทางจริง |

Desktop content ใช้ความกว้างสูงสุด 1320px ส่วน hero/header/footer ใช้กรอบ
1220px ตาม shared shell มือถือใช้ gutter 11-15px ฟอนต์กำหนดตาม breakpoint
ไม่ผูกขนาดกับ viewport width แบบต่อเนื่อง เพื่อคุมภาษาไทยและองค์ประกอบให้คงที่
แท็บเล็ต 761-950px ใช้ facts 3x2 และคำแนะนำแบบ disclosure เพื่อหลีกเลี่ยง
การ์ดสามใบแคบยาว ทั้งหมดยังอ่านข้อมูลครบได้

## ข้อมูลและข้อจำกัดที่รักษา

- Query `date=YYYY-MM-DD` ควบคุมวันที่, document title, facts, ดวงจันทร์,
  events, คำแนะนำ และจักรวันพร้อมกัน ใช้ `createThaiDayInfo` เดิม
- คงกฎจันทรคติและดิถีใน `thai-calendar-core.js` ไม่เปลี่ยน engine ให้ตรงภาพ
- วันก่อนหน้า/ถัดไปเป็น native links รองรับ keyboard, reload และ Back
  กลับปฏิทินพร้อมปีและเดือนของวันที่กำลังดู
- ตรวจวันที่แบบ round-trip; วันที่ไม่มีจริงหรืออยู่นอก พ.ศ. 2300-2700
  แสดงวันนี้พร้อมแจ้งเหตุ ไม่ปล่อยให้ JavaScript rollover วันที่เงียบ ๆ
- วันเดียวมีหลายเทศกาลได้ ต้องเก็บทุก event ไม่เลือกเพียงอันที่เข้ากับภาพ
- วันที่ไม่มีข้อควรหลีกเลี่ยง แสดงว่าไม่พบจากกฎที่มี ไม่รับรองว่าไร้ความเสี่ยง
- จักรวันเดิมใช้เดือนทั้ง 12 เป็นวงรอบ, อาเป็นจุดอ้างอิงคงที่,
  จคำนวณจากดิถี, วจากวันในสัปดาห์ และเลขไทยจากปีนักษัตร
  **ไม่ใช่ตำแหน่งดาวจริง** จึงเพิ่มคำอธิบายกับ SVG title/description
  ไม่เปลี่ยนเป็นชื่อดาว/องศาใหม่ตามภาพโดยไม่มี ephemeris
- คำแนะนำเป็นความเชื่อประกอบการวางแผน ไม่เติมเนื้อหาบุคคลหรือคำรับรอง
  เพื่อให้จำนวนบรรทัดเท่าต้นแบบ

## Owner และการใช้ร่วม

- `src/pages/calendar/day/index.astro`: shell, CMS hero และ templates ของ icons
- `src/scripts/thai-calendar-day.js`: query, rendering, disclosure, chart expansion,
  เครดิตภาพและ fallback ภาพ โดยไม่แทนที่ CMS image node ขณะ render ข้อมูล
- `src/styles/calendar-day.css`: scoped composition ของ Day; โหลดผ่าน route
  โดยตรง ไม่พ่วง CSS overview หรือ legacy calendar มาซ้อนกัน
- `SiteIcon.astro`: เพิ่มชื่อ Lucide แบบ additive เท่านั้น ไม่มีการเปลี่ยน default
  ของ consumers เดิม; SVG จาก Lucide tag 0.468.0 ใช้ license เดิมใน icon directory
- `BrandOrnament.astro`: ใช้ลวดลายแบรนด์เดิม ไม่สร้างสำเนาประจำหน้า
- `Footer.astro` + `public-footer.css`: ใช้ editorial markup ร่วม เพิ่ม
  `site-footer--ivory` เฉพาะ calendarDay; Home และ Calendar ยังคง dark variant

## CMS และภาพ

เพิ่ม seed page `calendarDay` route `/calendar/day/` พร้อม image patch
`calendar-day-hero-image` รองรับ src, alt, position, credit, sourceUrl,
license และ licenseUrl เหมือน CmsImage เดิม ไม่ hard-code content photo ใน CSS
หรือ day renderer และไม่แก้ navigation/production CMS ในรอบนี้

ภาพเลือกจาก asset ที่มีอยู่แล้ว: วัดมหาธาตุ สุโขทัย ยามเย็น โดย Supanut
Arunoprayote, [ต้นฉบับ Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Wat_Mahathat_Sukhothai_at_sunset.jpg),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
ไฟล์ถูกปรับขนาดและครอป; ให้เครดิตและลิงก์ license ในส่วนที่มาข้อมูล
เครดิตตาม CMS ปัจจุบัน ไม่ติดชื่อผู้ถ่ายเดิมเมื่อเปลี่ยนภาพ และซ่อนเมื่อแสดง fallback

ภาพอ้างอิงเป็นฉากวัดและดวงจันทร์เชิง illustration; ภาพจริงที่ใช้จึงไม่เหมือน
ต้นฉบับทุกจุด ไม่เติมดวงจันทร์ปลอมลงในภาพจริงหรือสื่อว่าภาพถ่ายเป็นของวันที่เลือก
ใช้ mask ผสานภาพกับ jade overlay ไม่มีขอบภาพแนวตั้งที่ตัดฉากฉับพลัน
มือถือขยาย crop ให้ตัววัดยังมีน้ำหนัก โดยตำแหน่งภาพยังอยู่ภายใต้ CMS

`live.json` และ `default.json` เป็น build/local seeds เท่านั้น ถ้าจะนำขึ้น production
ต้อง publish page/patch แบบเจาะจงจาก Admin document ล่าสุด ไม่ seed ทับข้อมูลจริง

## QA Matrix

| สิ่งที่ป้องกัน | หลักฐาน | ระดับ |
| --- | --- | --- |
| ข้อมูลวันที่ไม่ตรงกัน | date, lunar badge, 6 facts, chart, advice ใช้วันที่เดียว | E2E |
| เดือน/ปี/leap day | 28-29 ก.พ., 1 มี.ค., 31 ธ.ค., return month, reload | E2E |
| วันที่ผิด/นอกขอบเขต | fallback แจ้งเหตุ, ปุ่มขอบช่วง disabled | E2E |
| event หาย | 1 พ.ค. 2026 มีทุก event จาก engine เดิม | E2E |
| Mobile/Tablet พับไม่ได้ | click, Enter, resize และเปิดแหล่งข้อมูล | E2E |
| วงล้อจอเล็กอ่านยาก | ขยาย/ย่อแล้วความกว้างเปลี่ยนจริง | E2E + snapshot |
| CMS ไม่ถูกใช้ | สลับภาพ/alt/crop/เครดิตผ่าน response fixture | E2E |
| ภาพเสีย | fallback สำเร็จ, หน้าและ native links ยังใช้งานได้ | E2E |
| Shared footer เปลี่ยนหน้าอื่น | Home/Calendar ยังเป็น dark variant | E2E |
| รูปแบบล้น/สัดส่วน | 1440, 768, 390, 320px + ภาพเทียบต้นแบบ | screenshot/computed |
| Semantics/contrast | axe เฉพาะ `.day-detail` ที่ 1440/390 | automated a11y |

หลักฐาน local: `artifacts/calendar-day/` มี screenshots, viewport/URL/data
provenance และ comparison scripts ภาพอ้างอิงมาจาก clipboard ของผู้ใช้
Mobile comparison ตัดกรอบโทรศัพท์ออกแล้ว resize แบบรักษาสัดส่วน ไม่อ้าง
pixel-perfect เพราะไม่ทราบ CSS viewport ของ mockup

ผลตรวจ: E2E เฉพาะหน้า 6 tests ผ่าน, Astro/script checks ผ่าน, CMS validation ผ่าน,
ไม่มี horizontal overflow หรือ page errors ในสี่ viewport ที่ตรวจ,
axe ไม่พบ violations ในส่วน Day ที่ 1440/390 หลังแก้ semantics ของ definition list
ไม่ได้รัน full-site suite, production build/deploy หรือ Safari บนอุปกรณ์จริง

## ความต่างที่ตั้งใจและยังต้องให้เจ้าของงานตัดสิน

- ใช้ภาพวัดจริงและไอคอน Lucide แทนภาพวาดและ pictorial icon ของ mockup
- ไม่มีรูปสัตว์นักษัตรที่ไม่มี asset/source พร้อมใช้; ใช้ cycle icon กับชื่อปีจริง
- ไม่สร้างบัญชีโซเชียล/ลิงก์ติดต่อ/นโยบายใหม่เพื่อเติม footer ให้เหมือนภาพ
  ส่วน CTA ใช้ planner/calendar ซึ่งมีจริง
- จำนวนรายการคำแนะนำและความยาวเปลี่ยนตามข้อมูล ไม่เติมคำทำนายเพื่อให้การ์ดเต็ม
- ผลตรวจเป็นหลักฐาน implementation ไม่ใช่การอนุมัติจากผู้ใช้
