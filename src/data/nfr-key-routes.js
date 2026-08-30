import { getTempleDetailUrl } from "./temple-slugs.js";

export const watArunPopularRoute = getTempleDetailUrl("popular", {
  rank: 2,
  name: "วัดอรุณ",
  province: "กรุงเทพมหานคร",
});

export const nfrKeyRoutes = [
  { path: "/", headingPattern: "วางแผนไหว้\\s*พระ|ให้ตรงกับใจ" },
  { path: "/temples/planner/", headingPattern: "วางแผนไหว้พระ" },
  { path: "/temples/popular/", headingPattern: "สายไหว้พระ\\s*(?:9|๙)\\s*วัด" },
  { path: "/temples/mu/", headingPattern: "สถานที่มงคล" },
  { path: "/horoscope/palmistry/", headingPattern: "อ่านลายมือ" },
  { path: "/tarot/meanings/", headingPattern: "ความหมายไพ่ยิปซี" },
  { path: watArunPopularRoute, headingPattern: "วัดอรุณ" },
  { path: "/temples/thailand/", headingPattern: "วัดทั่วประเทศไทย" },
  { path: "/404.html", headingPattern: "เส้นทางนี้ไม่มีอยู่ในมงคลเวลาแล้ว" },
];

export const nfrKeyRoutePaths = nfrKeyRoutes.map((route) => route.path);
