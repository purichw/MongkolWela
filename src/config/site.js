export const brandAssets = {
  name: "มงคลเวลา",
  alternateName: "Mongkol Wela",
  label: "มงคลเวลา หน้าแรก",
  alt: "ตรามงคลเวลา",
  mark: {
    src: "/assets/brand/mongkolwela-app-icon.png",
    width: 512,
    height: 512,
  },
  emblem: {
    src: "/assets/brand/mongkolwela-mark.png",
    width: 500,
    height: 560,
  },
  lockup: {
    src: "/assets/brand/mongkolwela-logo-lockup.png",
    width: 1200,
    height: 462,
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
