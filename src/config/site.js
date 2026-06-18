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
          { label: "ดูดวงไพ่ยิปซี", section: true },
          { label: "ความหมายไพ่ยิปซี 78 ใบ", href: "tarot/meanings/" },
          { label: "ไพ่ยิปซีรายวัน", href: "tarot/daily/" },
          { label: "ไพ่ยิปซีรายเดือน", href: "tarot/monthly/" },
          { label: "ไพ่ยิปซีความรัก", href: "tarot/love/" },
          { label: "ไพ่ยิปซีการเงิน", href: "tarot/money/" },
          { label: "ไพ่ยิปซีการงาน อาชีพ", href: "tarot/career/" },
          { label: "ไพ่ยิปซีโชคลาภ เสี่ยงโชค", href: "tarot/luck/" },
          { label: "เลข ๗ ตัว", href: "#horoscope" },
          { label: "อ่านลายมือ", href: "horoscope/palmistry/" },
          { label: "โหราศาสตร์ไทย", href: "horoscope/thai-astrology/" },
          { label: "เสี่ยงเซียมซี", href: "horoscope/seamsi/" },
          { label: "สมพงษ์คู่รัก", href: "#horoscope" },
        ],
      },
      {
        label: "วันพระ",
        href: "calendar/",
        items: [],
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
        href: "temples/",
        items: [
          { label: "วางแผนไหว้พระ", href: "temples/planner/" },
          { label: "วัดเด่นวัดดัง", section: true },
          { label: "สายไหว้พระ 9 วัด", href: "temples/popular/" },
          { label: "สายมู", href: "temples/mu/" },
          { label: "วัดศักดิ์สิทธิ์", href: "temples/sacred/" },
          { label: "วัดทั่วประเทศไทย", section: true },
          { label: "ค้นหาวัดทั่วประเทศไทย", href: "temples/thailand/" },
        ],
      },
    ],
    utilityNav: [
      { label: "ความรู้", href: "#learn" },
    ],
    pages: {
      home: {
        topbar: [
          { label: "วันนี้", href: "#today", realtime: "lunarToday" },
          { label: "วันที่วันนี้", realtime: "solarToday" },
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
      palmistry: {
        topbar: [
          { label: "อ่านลายมือ", href: "horoscope/palmistry/#palmistry-tool" },
          { label: "เลือกเส้นที่เห็นชัด แล้วอ่านผลจาก rulebook ที่มีแหล่งอ้างอิง" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      tarotMeanings: {
        topbar: [
          { label: "ความหมายไพ่ยิปซี 78 ใบ", href: "tarot/meanings/" },
          { label: "เปิดดูหน้าไพ่และอ่านความหมายแบบไทย พร้อมมุม Western พอดีโทน" },
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
      tarotMonthly: {
        topbar: [
          { label: "ไพ่ยิปซีรายเดือน", href: "tarot/monthly/" },
          { label: "เลือกไพ่ 10 ใบเพื่ออ่านภาพรวมเดือนแบบ Celtic Cross" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      tarotLuck: {
        topbar: [
          { label: "ไพ่ยิปซีโชคลาภ เสี่ยงโชค", href: "tarot/luck/" },
          { label: "เลือกไพ่ 1 ใบเพื่ออ่านจังหวะโชคและการเสี่ยงอย่างมีสติ" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      tarotLove: {
        topbar: [
          { label: "ไพ่ยิปซีความรัก", href: "tarot/love/" },
          { label: "เลือกไพ่ 1 ใบเพื่ออ่านจังหวะหัวใจ คนโสด คนคุย และคู่ครอง" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      tarotMoney: {
        topbar: [
          { label: "ไพ่ยิปซีการเงิน", href: "tarot/money/" },
          { label: "เลือกไพ่ 1 ใบเพื่ออ่านสภาพคล่อง รายจ่าย และข้อควรระวัง" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      tarotCareer: {
        topbar: [
          { label: "ไพ่ยิปซีการงาน", href: "tarot/career/" },
          { label: "เลือกไพ่ 1 ใบเพื่ออ่านจังหวะงาน อาชีพ ธุรกิจ และโอกาสใหม่" },
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
      temples: {
        topbar: [
          { label: "วัดดังเสริมมงคล", href: "temples/" },
          { label: "รวมเส้นทางไหว้พระและวัดเด่นสำหรับเสริมมงคล" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      templesPopular: {
        topbar: [
          { label: "สายไหว้พระ 9 วัด", href: "temples/popular/" },
          { label: "รวมเส้นทางไหว้พระและวัดเด่นสำหรับเสริมมงคล" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      templesPlanner: {
        topbar: [
          { label: "วางแผนไหว้พระ", href: "temples/planner/" },
          { label: "เลือก 3, 5 หรือ 9 แห่ง พร้อมเวลาประมาณการสำหรับรถยนต์และแท็กซี่" },
          { label: "ดูวัดดังเสริมมงคล", href: "temples/" },
        ],
      },
      templesMu: {
        topbar: [
          { label: "สายมู", href: "temples/mu/" },
          { label: "รวมพิกัดขอพร การงาน การเงิน ความรัก สุขภาพ และโชคลาภ" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      templesSacred: {
        topbar: [
          { label: "วัดศักดิ์สิทธิ์", href: "temples/sacred/" },
          { label: "รวมวัดและสถานที่ศักดิ์สิทธิ์สำหรับไหว้พระ ทำบุญ และขอพร" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
      templesThailand: {
        topbar: [
          { label: "วัดทั่วประเทศไทย", href: "temples/thailand/" },
          { label: "ค้นหาจากทะเบียนวัดทั่วประเทศ" },
          { label: "ปรึกษาครูโหร", href: "#consult" },
        ],
      },
    },
  },
};
