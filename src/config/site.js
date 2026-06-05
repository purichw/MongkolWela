export const siteConfig = {
  th: {
    brandName: "มงคลเวลา",
    brandSubtitle: "Mongkol Wela",
    brandLabel: "มงคลเวลา หน้าแรก",
    navLabel: "เมนูหลัก",
    openMenuLabel: "เปิดเมนู",
    searchLabel: "ค้นหา",
    footer: {
      title: "มงคลเวลา",
      description: "ดูดวง ฤกษ์ ปฏิทินมงคล บทสวด และความรู้โหราศาสตร์ไทยจีน",
      contact: "ติดต่อครูโหร",
      rituals: "บทสวดและพิธี",
      credits: "เครดิตรูปภาพ",
      imageCredits:
        "เครดิตภาพ: ภาพจิตรกรรมหน้าแรกจากเจ้าของโปรเจกต์ และภาพธูปขดในวัดหมั่นโหมวโดย Aethelfirth, CC BY-SA 4.0",
    },
    nav: [
      {
        label: "ดูดวง",
        href: "#horoscope",
        items: [
          { label: "กราฟชีวิต", href: "horoscope/life-graph/" },
          { label: "ไพ่ยิปซีรายวัน", href: "tarot/daily/" },
          { label: "เลข ๗ ตัว", href: "#horoscope" },
          { label: "โหราศาสตร์ไทย", href: "horoscope/thai-astrology/" },
          { label: "เสี่ยงเซียมซี", href: "horoscope/seamsi/" },
          { label: "สมพงษ์คู่รัก", href: "#horoscope" },
        ],
      },
      {
        label: "ฤกษ์และปฏิทิน",
        href: "calendar/",
        items: [
          { label: "ปฏิทินจันทรคติ", href: "calendar/" },
          { label: "ฤกษ์ออกรถ", href: "calendar/" },
          { label: "ฤกษ์แต่งงาน", href: "calendar/" },
          { label: "วันพระ", href: "calendar/" },
          { label: "ปฏิทินจีน", href: "#calendar" },
        ],
      },
      {
        label: "ชื่อและตัวเลข",
        href: "#names",
        items: [
          { label: "ตั้งชื่อลูก", href: "#names" },
          { label: "วิเคราะห์ชื่อ", href: "#names" },
          { label: "เบอร์โทรศัพท์", href: "#names" },
          { label: "ทะเบียนรถ", href: "#names" },
          { label: "เลขประจำตัว", href: "#names" },
        ],
      },
      {
        label: "บทสวดและพิธี",
        href: "#rituals",
        items: [
          { label: "บทสวดมนต์", href: "#rituals" },
          { label: "คาถาเมตตา", href: "#rituals" },
          { label: "สะเดาะเคราะห์", href: "#rituals" },
          { label: "สีมงคล", href: "#rituals" },
          { label: "ปีชง", href: "#rituals" },
        ],
      },
      {
        label: "วัดดังเสริมมงคล",
        href: "temples/thailand/",
        items: [
          { label: "วัดทั่วประเทศไทย", href: "temples/thailand/" },
        ],
      },
    ],
    utilityNav: [
      { label: "ความรู้", href: "#learn" },
      { label: "ปรึกษาหมอดู", href: "#consult" },
    ],
    pages: {
      home: {
        topbar: [
          { label: "วันนี้ ขึ้น ๕ ค่ำ เดือน ๗", href: "#today" },
          { label: "วันศุกร์ที่ 5 มิถุนายน 2569" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
        footerVariant: "home",
      },
      calendar: {
        topbar: [
          { label: "ปฏิทินไทย", href: "calendar/" },
          { label: "วันพระ ดิถี ฤกษ์มงคล และรายละเอียดรายวัน" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      calendarDay: {
        topbar: [
          { label: "ปฏิทินไทย", href: "calendar/" },
          { label: "อ่านรายละเอียดวันก่อนเลือกฤกษ์" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      lifeGraph: {
        topbar: [
          { label: "วันนี้เหมาะกับการตั้งจิตและวางแผน", href: "#today" },
          { label: "กราฟชีวิตเป็นแนวทางพิจารณาจังหวะ ไม่ใช่ข้อสรุปตายตัว" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      seamsi: {
        topbar: [
          { label: "ตั้งจิตก่อนเสี่ยงเซียมซี", href: "horoscope/seamsi/#seamsi-oracle" },
          { label: "ถามเฉพาะเรื่องสำคัญด้วยใจสงบและเคารพคำทำนาย" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      thaiAstrology: {
        topbar: [
          { label: "ผูกดวงโหราศาสตร์ไทย", href: "horoscope/thai-astrology/#thai-astrology-tool" },
          { label: "อ่านลัคนา ภพ ดาวกำเนิด และดวงจรแบบเข้าใจง่าย" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      tarotDaily: {
        topbar: [
          { label: "วันนี้เหมาะกับการตั้งจิตและถามไพ่", href: "tarot/daily/#daily-tarot" },
          { label: "เลือกไพ่ได้วันละครั้งเพื่อรักษาความหมายของคำทำนาย" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      tarotResult: {
        topbar: [
          { label: "กลับไปจับไพ่รายวัน", href: "tarot/daily/" },
          { label: "รับคำทำนายด้วยสติ แล้วใช้เป็นแนวทางประกอบการตัดสินใจ" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
        footerLinks: [
          { label: "จับไพ่ใหม่", href: "tarot/daily/" },
          { label: "ติดต่อครูโหร", href: "#consult" },
        ],
      },
      templesThailand: {
        topbar: [
          { label: "วัดทั่วประเทศไทย", href: "temples/thailand/" },
          { label: "ค้นหาจากทะเบียนวัดตามไฟล์ข้อมูลที่แนบมา" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
    },
  },
};
