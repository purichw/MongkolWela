export const brandAssets = {
  name: "มงคลเวลา",
  alternateName: "Mongkol Wela",
  label: "มงคลเวลา หน้าแรก",
  alt: "ตรามงคลเวลา",
  mark: {
    src: "/assets/brand/mongkolwela-mark-192.webp",
    width: 192,
    height: 192,
    alt: "ตรามงคลเวลา",
  },
  emblem: {
    src: "/assets/brand/mongkolwela-mark.png",
    width: 500,
    height: 560,
    alt: "ตรามงคลเวลา",
  },
  lockup: {
    src: "/assets/brand/mongkolwela-logo-lockup.webp",
    width: 760,
    height: 293,
    alt: "มงคลเวลา Mongkol Wela",
  },
  favicon: {
    src: "/assets/brand/favicon-32.png",
    sizes: "32x32",
    type: "image/png",
  },
  favicon192: {
    src: "/assets/brand/favicon-192.png",
    sizes: "192x192",
    type: "image/png",
  },
  favicon512: {
    src: "/assets/brand/favicon-512.png",
    sizes: "512x512",
    type: "image/png",
  },
  appleTouchIcon: {
    src: "/assets/brand/apple-touch-icon.png",
    sizes: "180x180",
  },
};

export const siteConfig = {
  th: {
    brandName: brandAssets.name,
    brandSubtitle: brandAssets.alternateName,
    brandLabel: brandAssets.label,
    navLabel: "เมนูหลัก",
    openMenuLabel: "เปิดเมนู",
    searchLabel: "ค้นหา",
    topbar: [
      { label: "คู่มือวางแผนเดินทางมงคล", href: "temples/" },
      { label: "ปฏิทินไทย", href: "calendar/" },
      { label: "วันพระ ดิถี ฤกษ์มงคล และรายละเอียดรายวัน", href: "calendar/day/", featured: true },
      { label: "ติดต่อมงคลเวลา", href: "#consult" },
    ],
    footer: {
      title: "มงคลเวลา",
      description: "คู่มือวางแผนไหว้พระ ค้นหาวัด สถานที่ศักดิ์สิทธิ์ ปฏิทินไทย และเครื่องมือมงคลสำหรับผู้ใช้ไทย",
      contact: "ติดต่อมงคลเวลา",
    },
    copy: {
      nav: {
        drawerTitle: "เมนูหลัก",
        drawerHint: "เลือกหมวดข้อมูล",
        mobileMeta: {
          "popular-temples": "ยอดนิยม",
          "sacred-temples": "ศรัทธา",
          "mu-temples": "มงคล",
          "all-temples": "ฐานข้อมูล",
        },
      },
      footer: {
        homeDescription:
          "คู่มือวางแผนไหว้พระและค้นหาสถานที่มงคล พร้อมข้อมูลประกอบการเดินทางที่ควรตรวจสอบก่อนออกเดินทาง",
        templeDescription:
          "คู่มือวางแผนเดินทางไหว้พระ ค้นหาวัดและสถานที่มงคล พร้อมพิกัดและข้อมูลประกอบที่ตรวจสอบได้",
        templeRoutesLabel: "เส้นทางและสถานที่",
        toolsLabel: "เครื่องมือเสริม",
        templeRoutes: [
          { label: "วางแผนไหว้พระ", href: "/temples/planner/" },
          { label: "เส้นทางไหว้พระ ๙ วัด", href: "/temples/popular/" },
          { label: "วัดศักดิ์สิทธิ์", href: "/temples/sacred/" },
          { label: "สถานที่มงคล", href: "/temples/mu/" },
          { label: "วัดทั่วประเทศไทย", href: "/temples/thailand/" },
        ],
        tools: [
          { label: "ปฏิทินไทย", href: "/calendar/" },
          { label: "คำเซียมซี", href: "/horoscope/seamsi/" },
          { label: "ไพ่ยิปซีรายวัน", href: "/tarot/daily/" },
          { label: "อ่านลายมือ", href: "/horoscope/palmistry/" },
        ],
        templeCreditNote:
          "ข้อมูลวัดอ้างอิงจากทะเบียนวัด สำนักงานพระพุทธศาสนาแห่งชาติ · ควรตรวจสอบเวลาเปิด-ปิดก่อนเดินทาง",
      },
    },
    pages: {
      home: {
        footerVariant: "home",
      },
      calendar: {},
      calendarDay: {},
      lifeGraph: {},
      seamsi: {},
      thaiAstrology: {},
      palmistry: {},
      tarotMeanings: {},
      tarotDaily: {},
      tarotMonthly: {},
      tarotLuck: {},
      tarotLove: {},
      tarotMoney: {},
      tarotCareer: {},
      tarotResult: {
        footerLinks: [
          { label: "จับไพ่ใหม่", href: "tarot/daily/" },
          { label: "ติดต่อมงคลเวลา", href: "#consult" },
        ],
      },
      temples: {},
      templesPopular: {},
      templesPlanner: {},
      templesMu: {},
      templesSacred: {},
      templesThailand: {},
    },
  },
};
