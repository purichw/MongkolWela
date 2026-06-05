export const siteConfig = {
  th: {
    brandName: "มงคลเวลา",
    brandSubtitle: "Mongkol Wela",
    brandLabel: "มงคลเวลา หน้าแรก",
    navLabel: "เมนูหลัก",
    openMenuLabel: "เปิดเมนู",
    searchLabel: "ค้นหา",
    languageLabel: "EN",
    languageHref: "en/",
    languageLang: "en",
    languageHrefLang: "en",
    footer: {
      title: "มงคลเวลา",
      description: "ดูดวง ฤกษ์ ปฏิทินมงคล บทสวด และความรู้โหราศาสตร์ไทยจีน",
      contact: "ติดต่อครูโหร",
      rituals: "บทสวดและพิธี",
      credits: "เครดิตรูปภาพ",
      imageCredits:
        "Images: hero murals supplied by the project owner; “Burning incense coils in the Man Mo temple” by Aethelfirth, CC BY-SA 4.0.",
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
          { label: "TH", href: "", lang: "th" },
          { label: "EN", href: "en/", lang: "en" },
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
  en: {
    brandName: "Mongkol Wela",
    brandSubtitle: "Thai Astrology",
    brandLabel: "Mongkol Wela home",
    navLabel: "Main navigation",
    openMenuLabel: "Open menu",
    searchLabel: "Search",
    languageLabel: "TH",
    languageHref: "",
    languageLang: "th",
    languageHrefLang: "th",
    footer: {
      title: "Mongkol Wela",
      description: "Horoscope, auspicious dates, calendars, prayers, and Thai-Chinese astrology knowledge.",
      contact: "Contact an astrologer",
      rituals: "Prayers and rituals",
      credits: "Image credits",
      imageCredits:
        "Images: hero murals supplied by the project owner; “Burning incense coils in the Man Mo temple” by Aethelfirth, CC BY-SA 4.0.",
    },
    nav: [
      {
        label: "Horoscope",
        href: "/en/#horoscope",
        items: [
          { label: "Life graph", href: "/en/horoscope/life-graph/" },
          { label: "Daily tarot", href: "/en/tarot/daily/" },
          { label: "Seven-star numerology", href: "/en/#horoscope" },
          { label: "Thai astrology", href: "/en/horoscope/thai-astrology/" },
          { label: "Kau chim oracle", href: "/en/horoscope/seamsi/" },
          { label: "Love compatibility", href: "/en/#horoscope" },
        ],
      },
      {
        label: "Dates and Calendar",
        href: "/en/calendar/",
        items: [
          { label: "Thai lunar calendar", href: "/en/calendar/" },
          { label: "Car blessing dates", href: "/en/calendar/" },
          { label: "Wedding dates", href: "/en/calendar/" },
          { label: "Buddhist holy days", href: "/en/calendar/" },
          { label: "Chinese calendar", href: "/en/#calendar" },
        ],
      },
      {
        label: "Names and Numbers",
        href: "/en/#names",
        items: [
          { label: "Baby names", href: "/en/#names" },
          { label: "Name analysis", href: "/en/#names" },
          { label: "Phone numbers", href: "/en/#names" },
          { label: "License plates", href: "/en/#names" },
          { label: "Personal numbers", href: "/en/#names" },
        ],
      },
      {
        label: "Prayers and Rituals",
        href: "/en/#rituals",
        items: [
          { label: "Buddhist chants", href: "/en/#rituals" },
          { label: "Metta prayers", href: "/en/#rituals" },
          { label: "Remedy rituals", href: "/en/#rituals" },
          { label: "Lucky colors", href: "/en/#rituals" },
          { label: "Year clash", href: "/en/#rituals" },
        ],
      },
      {
        label: "Auspicious Temples",
        href: "/en/temples/thailand/",
        items: [
          { label: "All Temples in Thailand", href: "/en/temples/thailand/" },
        ],
      },
    ],
    utilityNav: [
      { label: "Learn", href: "/en/#learn" },
      { label: "Consult", href: "/en/#consult" },
    ],
    pages: {
      home: {
        topbar: [
          { label: "Today: Waxing 5th, Lunar Month 7", href: "#today" },
          { label: "Friday, June 5, 2026" },
          { label: "Consult an astrologer", href: "#consult" },
        ],
        footerVariant: "home",
      },
      calendar: {
        topbar: [
          { label: "Thai calendar", href: "/en/calendar/" },
          { label: "Holy days, lunar markers, auspicious notes, and daily detail" },
          { label: "Consult an astrologer", href: "/en/#consult" },
        ],
      },
      calendarDay: {
        topbar: [
          { label: "Thai calendar", href: "/en/calendar/" },
          { label: "Read the day before choosing an auspicious time" },
          { label: "Consult an astrologer", href: "/en/#consult" },
        ],
      },
      lifeGraph: {
        topbar: [
          { label: "Life graph", href: "/en/horoscope/life-graph/" },
          { label: "A timing guide, not a fixed verdict" },
          { label: "Consult an astrologer", href: "/en/#consult" },
        ],
      },
      seamsi: {
        topbar: [
          { label: "Set your intention", href: "/en/horoscope/seamsi/#seamsi-oracle" },
          { label: "Ask one important question calmly and respectfully" },
          { label: "Consult an astrologer", href: "/en/#consult" },
        ],
      },
      thaiAstrology: {
        topbar: [
          { label: "Thai astrology chart", href: "/en/horoscope/thai-astrology/#thai-astrology-tool" },
          { label: "Read ascendant, houses, natal planets, and transits in plain language" },
          { label: "Consult an astrologer", href: "/en/#consult" },
        ],
      },
      tarotDaily: {
        topbar: [
          { label: "Daily tarot", href: "/en/tarot/daily/#daily-tarot" },
          { label: "Draw once a day to keep the reading meaningful" },
          { label: "Consult an astrologer", href: "/en/#consult" },
        ],
      },
      tarotResult: {
        topbar: [
          { label: "Draw another card", href: "/en/tarot/daily/" },
          { label: "Receive the reading mindfully and use it as guidance" },
          { label: "Consult an astrologer", href: "/en/#consult" },
        ],
      },
      templesThailand: {
        topbar: [
          { label: "All Temples in Thailand", href: "/en/temples/thailand/" },
          { label: "Search the temple registry from the attached source file" },
          { label: "Consult an astrologer", href: "/en/#consult" },
        ],
      },
    },
  },
};
