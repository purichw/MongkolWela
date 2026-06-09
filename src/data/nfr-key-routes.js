import { getTempleDetailUrl } from "./temple-slugs.js";

export const watArunPopularRoute = getTempleDetailUrl("popular", {
  rank: 2,
  name: "วัดอรุณ",
  province: "กรุงเทพมหานคร",
});

export const nfrKeyRoutes = [
  { path: "/", headingPattern: "มงคลเวลา|วันนี้" },
  { path: "/temples/popular/", headingPattern: "สายไหว้พระ 9 วัด" },
  { path: "/temples/mu/", headingPattern: "สายมู" },
  { path: "/tarot/meanings/", headingPattern: "ความหมายไพ่ยิปซี" },
  { path: watArunPopularRoute, headingPattern: "วัดอรุณ" },
  { path: "/temples/thailand/", headingPattern: "วัดทั่วประเทศไทย" },
  { path: "/404.html", headingPattern: "เส้นทางนี้ไม่มีอยู่ในมงคลเวลาแล้ว" },
];

export const nfrKeyRoutePaths = nfrKeyRoutes.map((route) => route.path);
