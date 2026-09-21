# Design notes เฉพาะหน้ารายละเอียดวัน

อ่านร่วมกับ `03-BRANDING-AND-CI.md` ซึ่งเป็น CI ทั้งเว็บไซต์ หน้านี้เป็นเครื่องมือข้อมูล ไม่จำเป็นต้องคัดโครง Home หรือ dark footer มาใช้ ความต่างที่มีอยู่ไม่ใช่ drift ทุกจุด

## 1. Visual direction และขอบเขต

**FACT:** มี brand อยู่แล้ว ได้แก่โลโก้มงคลเวลา พื้นกระดาษอุ่น แดงชาด เขียวหยก ทอง และ typography ไทย จึงไม่ใช้ generic design-system tokens มาทับทั้งหมด

**REC:** ให้ออกแบบเป็น “หน้าคู่มืออ่านวัน” ที่อ่านง่าย สุภาพและบอกข้อจำกัดตรงไปตรงมา ความน่าเชื่อถือควรมาจากวันที่ชัดเจน โครงสร้างข้อมูล และที่มาที่ตรวจได้ ไม่ใช่ความอลังการของวงหรือคำรับประกัน

ไม่ใช่งานให้สร้างหน้า marketing ใหม่ เพิ่ม testimonial, fake metric, AI assistant หรือ astrology dashboard การเปลี่ยนสัดส่วนหรือโครงสร้างครั้งต่อไปควรเป็นข้อเสนอที่มีเหตุผล ไม่ใช่ผลของการ standardize ทุกหน้า

## 2. Geometry ปัจจุบัน

วัดบน production วันที่ 20 กันยายน 2026 ที่ viewport **1280×720 CSS px, DPR 2** หน้าสูงประมาณ 2203 CSS px ตัวเลขเป็น baseline ของ viewport นี้ ไม่ใช่ข้อบังคับสำหรับ redesign ทุกจอ

| ส่วน | ค่าที่วัด/อ่านจาก source |
| --- | --- |
| Content width | 1160 px ณ viewport ตัวอย่าง; CSS `min(1160px, calc(100% - 40px))` |
| พื้นหลัง | paper + เส้น grid ห่าง 88 px |
| Hero | ประมาณ 1160×454 px, padding 44 px, radius 8 px |
| Hero H1 | computed Noto Sans Thai, 70.4 px, weight 700, line-height 80.256 px; max-width 820 px |
| Hero navigation | pill, gap 10 px, wrap ได้ |
| Main pair | 2 columns `minmax(320px,.86fr) minmax(360px,1.14fr)`, gap 22 px |
| Facts panel / wheel panel | กว้างประมาณ 489 / 649 px; stretch ให้สูงเท่ากันประมาณ 707 px |
| Facts grid | 2 columns, gap 10 px, tile padding 14 px, radius 8 px |
| Moon icon | 48×48 px |
| Wheel | SVG viewBox 420×420; width สูงสุด 560 px, aspect-ratio 1 |
| Omen cards | 3 columns, gap 18 px, padding 22 px, border-top 4 px; สูงประมาณ 292 px ในวันที่ตัวอย่าง |
| Source panel | 2 columns .65fr / 1.35fr, gap 20 px, padding 26 px; ประมาณ 1160×249 px |
| Footer | generic/light footer ไม่ใช่ dark multi-column footer |

body copy ที่ตรวจใช้ Noto Sans Thai 16 px และ line-height ประมาณ 26.4 px; copy ในรายการ omen ใช้ line-height 1.75 และ source 1.85 ไม่ควรใส่ค่าของ Prompt จาก Home แล้วอ้างว่าเป็น computed font ของหน้านี้

## 3. Palette เฉพาะ route

| บทบาท | ค่าปัจจุบัน |
| --- | --- |
| Hero | linear gradient 135deg `#123F34` → `#24271F` → `#793025` พร้อม radial highlight |
| Hero text / breadcrumb | `#FFF9E8` / `#FFE2A8` |
| Panel surface | `rgba(255,253,247,.92)` |
| Facts tile | `#F4EBDA` |
| Panel line | `rgba(67,48,36,.13)` |
| Panel shadow | `0 18px 60px rgba(58,37,28,.08)` |
| Good / avoid / neutral accents | `#2F6B56` / `#993027` / `#B88C3E` |
| Omen copy / source copy | `#5F5045` / `#65564A` |
| Wheel ring / label | `#634A32` / `#5A4A3A` |
| Sun marker | fill `#F5BD38`, stroke `#B58A21` |
| Moon marker | fill `#235BD7`, stroke `#255BC8` |
| Weekday marker | fill `#2F6B56`, stroke `#174637` |
| Zodiac marker | `#993027` |

สีฟ้าของ marker เป็น functional variant ที่มีอยู่จริง ไม่ได้แปลว่าควรเปลี่ยนแบรนด์เป็นฟ้า และไม่ควรลบทิ้งเพียงเพราะไม่ใช่ primary color ส่วน gradient เป็นข้อเท็จจริงของหน้าปัจจุบัน ไม่ใช่คำสั่งว่าดีไซน์ใหม่ต้องเพิ่ม glow หรือ decoration

## 4. Responsive จาก CSS ไม่ใช่ผล QA มือถือ

- ที่ความกว้างไม่เกิน 760 px: main pair, omen grid และ source panel เปลี่ยนเป็น 1 column
- ที่ความกว้างไม่เกิน 700 px: content width เหลือ `calc(100% - 28px)` และ facts เป็น 1 column
- หัวข้อปัจจุบันมีขนาดแบบ CSS clamp; หากปรับ typography ให้ระบุ mobile/desktop size ที่ตรวจการตัดบรรทัดภาษาไทยแล้ว ไม่ยึดเลข desktop ไปทุกหน้าจอ
- Mobile, zoom 200%, keyboard และ screen reader **ยังไม่ได้ทดสอบในงานทำ brief นี้** ห้ามเขียนว่า responsive/a11y ผ่านแล้ว

**REC สำหรับงานดีไซน์รอบหน้า:** ส่งตัวอย่างอย่างน้อย desktop 1280 px และ mobile 390 px พร้อมพิจารณา narrow 320 px, วันที่ชื่อเดือนยาว, events หลายรายการ และคำแนะนำยาว ลิงก์เปลี่ยนวันไม่ควรหายหรือเกิด horizontal overflow

## 5. Product decision review

| สิ่งที่จะพิจารณา | ประเภท | หลักตัดสินใจ |
| --- | --- | --- |
| ย่อ hero/จัดวันที่กับ navigation ใหม่ | REC: design-only | ทำวันและการเปลี่ยนวันชัดขึ้นโดยคง route |
| ลดช่องว่างฝั่ง facts | REC: design-only | ปรับสัดส่วน/align ไม่เพิ่มเนื้อหาเพื่อเติมช่องว่าง |
| แสดงคำอธิบายว่า wheel เป็น schematic | REC: clarify existing meaning | ใช้ logic จริง; ไม่เติมคำอธิบายทางดาราศาสตร์ที่ไม่มี |
| ลด/ย้าย/แทน wheel | needs owner decision | เสนอ tradeoff ก่อน ไม่ลบทิ้งในชื่อ consistency |
| จัดภาษา “คำแนะนำวันนี้” เมื่อดูวันอื่น | REC: align existing | ใช้วันที่เลือกอย่างสอดคล้อง |
| แยก WanJom ที่เป็นงานเหมาะทำออกจาก avoid | needs data-owner review | ยืนยันความหมายกฎก่อนเปลี่ยนหมวด |
| เปลี่ยนสูตร/ต่อ API/รับรองวันหยุด | data/integration scope | ต้องแหล่งที่มา สิทธิ์ใช้ข้อมูล และ verification แยก |
| date picker/วันนี้/แชร์/บันทึก/ส่งเข้า planner | new addition requiring approval | อย่ารวมเป็น feature ที่มีอยู่แล้ว |
| footer พื้นอ่อน/radius 8/สี marker | preserve coexisting variant | ต่างจาก Home ได้ถ้าเหมาะกับหน้าที่ |

## 6. Accessibility และ acceptance สำหรับดีไซน์ใหม่

รายการนี้เป็น **REC สำหรับตรวจในรอบ implementation** ไม่ใช่ใบรับรองปัจจุบัน:

- Heading/date สแกนได้ชัด; ข้อความไทยไม่ชนสระ/วรรณยุกต์และไม่ถูกตัดกลางคำโดยไม่จำเป็น
- ใช้ anchor สำหรับ navigation และมี focus-visible; ไม่เปลี่ยนทุกอย่างเป็น clickable div
- ข้อจำกัดความแม่นยำอ่านได้ใกล้ข้อมูล มีรายละเอียดแหล่งข้อมูลให้เข้าถึงโดยไม่ซ่อนทั้งหมดหลัง hover
- ไม่ใช้แดง/เขียวอย่างเดียวบอกควรทำ/ควรระวัง; มีหัวข้อภาษาไทยประกอบ
- ตรวจ contrast ทองหรือ muted text บน paper และ gradient จากค่าจริง
- ถ้าคง wheel: มี text alternative/legend ที่บอกความหมายและสถานะ schematic ไม่ใช่แค่ชื่อวัน
- เลข พ.ศ./ค.ศ., weekday, lunar, event และ title ต้องเป็น state เดียวกันทั้งหน้า
- วันก่อนหน้า/ถัดไป/กลับปีต้องใช้ได้ที่ขอบเดือนและปี; error state ไม่ควรเงียบ ๆ แสดงวันอื่น
- ชื่อวันที่ยาวและเนื้อหาหลายรายการต้องไม่ขยายวงหรือ panel จนบังข้อมูลอื่น
- ไม่ทำ animation ให้ข้อมูลวันอ่านยากหรือเลื่อนย้ายโดยไม่จำเป็น

## 7. ภาพและ provenance

- `assets/calendar-day-user-reference.png`: ภาพเต็มที่ผู้ใช้ให้ เป็น visual reference ของ desktop จอกว้าง
- `assets/calendar-day-part-1.png` ถึง `part-4.png`: production viewport captures 1280×720 ของวันที่ล็อก มีช่วงซ้อนทับเพื่อไม่พลาดเนื้อหา
- `assets/calendar-day-production-desktop.png`: contact sheet รวม 4 ภาพ มีหัวข้อกำกับนอก UI ไม่ใช่ screenshot stitched เต็มหน้า
- `assets/capture-provenance.json`: URL, วันที่, viewport, scroll positions และ interaction ที่ตรวจจริง
- โลโก้ 3 variant ใน assets คือของแบรนด์ปัจจุบัน; ห้ามแทนด้วย logo เลข ๙ จาก prototype เก่า

ภาพอ้างอิงผู้ใช้กับภาพ capture รอบนี้มี viewport ต่างกัน จึงไม่ควรเทียบด้วย pixel-diff ตรง ๆ แล้วสรุปว่า layout เปลี่ยน
