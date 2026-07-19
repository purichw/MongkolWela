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
      description: "ค้นหาวัดดัง สถานที่ศักดิ์สิทธิ์ วันพระ และเส้นทางไหว้พระเสริมมงคลสำหรับผู้ใช้ไทย",
      contact: "ติดต่อมงคลเวลา",
      rituals: "คู่มือก่อนเดินทาง",
      credits: "เครดิตรูปภาพ",
      imageCredits:
        "เครดิตภาพ: ภาพจิตรกรรมหน้าแรกจากเจ้าของโปรเจกต์ และภาพธูปขดในวัดหมั่นโหมวโดย Aethelfirth, CC BY-SA 4.0",
    },
    pages: {
      home: {
        topbar: [
          { label: "คู่มือเดินทางสายมงคล", href: "#guides" },
          { label: "วันที่วันนี้", realtime: "solarToday" },
          { label: "ติดต่อ", href: "#consult" },
        ],
        footerVariant: "home",
      },
      calendar: {
        topbar: [
          { label: "ปฏิทินไทย", href: "calendar/" },
          { label: "วันพระ ดิถี ฤกษ์มงคล และรายละเอียดรายวัน" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      calendarDay: {
        topbar: [
          { label: "ปฏิทินไทย", href: "calendar/" },
          { label: "อ่านรายละเอียดวันก่อนเลือกฤกษ์" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      lifeGraph: {
        topbar: [
          { label: "วันนี้เหมาะกับการตั้งจิตและวางแผน", href: "#today" },
          { label: "กราฟชีวิตเป็นแนวทางพิจารณาจังหวะ ไม่ใช่ข้อสรุปตายตัว" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      seamsi: {
        topbar: [
          { label: "ตั้งจิตก่อนเสี่ยงเซียมซี", href: "horoscope/seamsi/#seamsi-oracle" },
          { label: "ถามเฉพาะเรื่องสำคัญด้วยใจสงบและเคารพคำทำนาย" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      thaiAstrology: {
        topbar: [
          { label: "ผูกดวงโหราศาสตร์ไทย", href: "horoscope/thai-astrology/#thai-astrology-tool" },
          { label: "อ่านลัคนา ภพ ดาวกำเนิด และดวงจรแบบเข้าใจง่าย" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      palmistry: {
        topbar: [
          { label: "อ่านลายมือ", href: "horoscope/palmistry/#palmistry-tool" },
          { label: "เลือกเส้นที่เห็นชัด แล้วอ่านผลจาก rulebook ที่มีแหล่งอ้างอิง" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      tarotMeanings: {
        topbar: [
          { label: "ความหมายไพ่ยิปซี 78 ใบ", href: "tarot/meanings/" },
          { label: "เปิดดูหน้าไพ่และอ่านความหมายแบบไทย พร้อมมุม Western พอดีโทน" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      tarotDaily: {
        topbar: [
          { label: "วันนี้เหมาะกับการตั้งจิตและถามไพ่", href: "tarot/daily/#daily-tarot" },
          { label: "เลือกไพ่ได้วันละครั้งเพื่อรักษาความหมายของคำทำนาย" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      tarotMonthly: {
        topbar: [
          { label: "ไพ่ยิปซีรายเดือน", href: "tarot/monthly/" },
          { label: "เลือกไพ่ 10 ใบเพื่ออ่านภาพรวมเดือนแบบ Celtic Cross" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      tarotLuck: {
        topbar: [
          { label: "ไพ่ยิปซีโชคลาภ เสี่ยงโชค", href: "tarot/luck/" },
          { label: "เลือกไพ่ 1 ใบเพื่ออ่านจังหวะโชคและการเสี่ยงอย่างมีสติ" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      tarotLove: {
        topbar: [
          { label: "ไพ่ยิปซีความรัก", href: "tarot/love/" },
          { label: "เลือกไพ่ 1 ใบเพื่ออ่านจังหวะหัวใจ คนโสด คนคุย และคู่ครอง" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      tarotMoney: {
        topbar: [
          { label: "ไพ่ยิปซีการเงิน", href: "tarot/money/" },
          { label: "เลือกไพ่ 1 ใบเพื่ออ่านสภาพคล่อง รายจ่าย และข้อควรระวัง" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      tarotCareer: {
        topbar: [
          { label: "ไพ่ยิปซีการงาน", href: "tarot/career/" },
          { label: "เลือกไพ่ 1 ใบเพื่ออ่านจังหวะงาน อาชีพ ธุรกิจ และโอกาสใหม่" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      tarotResult: {
        topbar: [
          { label: "กลับไปจับไพ่รายวัน", href: "tarot/daily/" },
          { label: "รับคำทำนายด้วยสติ แล้วใช้เป็นแนวทางประกอบการตัดสินใจ" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
        footerLinks: [
          { label: "จับไพ่ใหม่", href: "tarot/daily/" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      temples: {
        topbar: [
          { label: "วัดดังเสริมมงคล", href: "temples/" },
          { label: "รวมเส้นทางไหว้พระและวัดเด่นสำหรับเสริมมงคล" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      templesPopular: {
        topbar: [
          { label: "สายไหว้พระ 9 วัด", href: "temples/popular/" },
          { label: "รวมเส้นทางไหว้พระและวัดเด่นสำหรับเสริมมงคล" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
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
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      templesSacred: {
        topbar: [
          { label: "วัดศักดิ์สิทธิ์", href: "temples/sacred/" },
          { label: "รวมวัดและสถานที่ศักดิ์สิทธิ์สำหรับไหว้พระ ทำบุญ และขอพร" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      templesThailand: {
        topbar: [
          { label: "วัดทั่วประเทศไทย", href: "temples/thailand/" },
          { label: "ค้นหาจากทะเบียนวัดทั่วประเทศ" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
    },
  },
};
