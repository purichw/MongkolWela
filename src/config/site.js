export const siteConfig = {
  th: {
    brandName: "มงคลเวลา",
    brandSubtitle: "Mongkol Wela",
    brandLabel: "มงคลเวลา หน้าแรก",
    navLabel: "เมนูหลัก",
    openMenuLabel: "เปิดเมนู",
    searchLabel: "ค้นหา",
    topbar: [
      { label: "คู่มือเดินทางสายมงคล", href: "temples/" },
      { label: "ปฏิทินไทย", href: "calendar/" },
      { label: "วันพระ ดิถี ฤกษ์มงคล และรายละเอียดรายวัน", href: "calendar/day/", featured: true },
      { label: "ติดต่อมงคลเวลา", href: "#consult" },
    ],
    footer: {
      title: "มงคลเวลา",
      description: "ค้นหาวัดดัง สถานที่ศักดิ์สิทธิ์ วันพระ และเส้นทางไหว้พระเสริมมงคลสำหรับผู้ใช้ไทย",
      contact: "ติดต่อมงคลเวลา",
      credits: "เครดิตรูปภาพ",
      imageCredits:
        "เครดิตภาพ: ภาพจิตรกรรมหน้าแรกจากเจ้าของโปรเจกต์ และภาพวัดไทยโดย Nomadic Julien, Unsplash",
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
