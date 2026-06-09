import type { APIRoute } from "astro";
import { applyTempleImageOverrides, templePlaceholderImage } from "../data/temple-images.js";
import { getTempleDetailUrl } from "../data/temple-slugs.js";
import { tarotMeaningCards } from "../data/tarot-meanings.js";
import popularTemples from "../data/popular-temples.json";
import muTemples from "../data/mu-temples.json";
import sacredTemples from "../data/sacred-temples.json";
import { absoluteUrl } from "../lib/seo.js";

type SitemapEntry = {
  path: string;
  priority: string;
  changefreq: string;
  image?: {
    loc: string;
    title: string;
    caption?: string;
  };
};

const lastmod = new Date().toISOString().slice(0, 10);
const staticEntries: SitemapEntry[] = [
  { path: "/", priority: "1.0", changefreq: "daily", image: imageEntry("/assets/images/hero-temple-red.jpg", "มงคลเวลา") },
  { path: "/calendar/", priority: "0.78", changefreq: "weekly" },
  { path: "/calendar/day/", priority: "0.58", changefreq: "weekly" },
  { path: "/horoscope/life-graph/", priority: "0.72", changefreq: "weekly" },
  { path: "/horoscope/seamsi/", priority: "0.72", changefreq: "weekly" },
  { path: "/horoscope/thai-astrology/", priority: "0.76", changefreq: "weekly" },
  { path: "/horoscope/palmistry/", priority: "0.74", changefreq: "weekly" },
  { path: "/tarot/daily/", priority: "0.72", changefreq: "daily" },
  { path: "/tarot/meanings/", priority: "0.74", changefreq: "monthly", image: imageEntry("/assets/images/tarot/rws-jpg/the-world.jpg", "ความหมายไพ่ยิปซี 78 ใบ") },
  { path: "/tarot/monthly/", priority: "0.68", changefreq: "weekly" },
  { path: "/tarot/love/", priority: "0.7", changefreq: "weekly" },
  { path: "/tarot/money/", priority: "0.7", changefreq: "weekly" },
  { path: "/tarot/career/", priority: "0.7", changefreq: "weekly" },
  { path: "/tarot/luck/", priority: "0.66", changefreq: "weekly" },
  { path: "/temples/", priority: "0.9", changefreq: "weekly", image: imageEntry("/assets/images/hero-temple-red.jpg", "วัดดังเสริมมงคล") },
  { path: "/temples/popular/", priority: "0.95", changefreq: "weekly", image: imageEntry("/assets/images/hero-temple-red.jpg", "สายไหว้พระ 9 วัด") },
  { path: "/temples/mu/", priority: "0.94", changefreq: "weekly", image: imageEntry("/assets/images/hero-temple-red.jpg", "สายมู") },
  { path: "/temples/sacred/", priority: "0.9", changefreq: "weekly", image: imageEntry("/assets/images/hero-temple-red.jpg", "วัดศักดิ์สิทธิ์") },
  { path: "/temples/thailand/", priority: "0.92", changefreq: "weekly" },
];

const templeEntries: SitemapEntry[] = [
  ...createTempleEntries("popular", popularTemples, "0.82"),
  ...createTempleEntries("mu", muTemples, "0.8"),
  ...createTempleEntries("sacred", sacredTemples, "0.78"),
];

const tarotMeaningEntries: SitemapEntry[] = tarotMeaningCards.map((card) => ({
  path: `/tarot/meanings/${card.slug}/`,
  priority: card.group === "major" ? "0.62" : "0.58",
  changefreq: "monthly",
  image: imageEntry(card.image, `${card.thName} ${card.name}`, `ความหมายไพ่ยิปซี ${card.thName}`),
}));

export const GET: APIRoute = async () => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${[
    ...staticEntries,
    ...tarotMeaningEntries,
    ...templeEntries,
  ]
    .map(renderUrl)
    .join("\n")}\n</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};

function createTempleEntries(collection: "popular" | "mu" | "sacred", temples: unknown[], priority: string) {
  const rows = applyTempleImageOverrides(collection, [...temples]);
  return rows.map((temple: any) => {
    const image = temple.imageUrl && temple.imageUrl !== templePlaceholderImage
      ? imageEntry(temple.imageUrl, temple.imageAlt || `${temple.name} ${temple.province}`, `${temple.name} ${temple.province}`)
      : undefined;
    return {
      path: getTempleDetailUrl(collection, temple),
      priority,
      changefreq: "monthly",
      image,
    };
  });
}

function renderUrl(entry: SitemapEntry) {
  const imageXml = entry.image
    ? `\n    <image:image><image:loc>${xml(entry.image.loc)}</image:loc><image:title>${xml(entry.image.title)}</image:title>${entry.image.caption ? `<image:caption>${xml(entry.image.caption)}</image:caption>` : ""}</image:image>`
    : "";
  return `  <url><loc>${xml(absoluteUrl(entry.path))}</loc><lastmod>${lastmod}</lastmod><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority>${imageXml}</url>`;
}

function imageEntry(src: string, title: string, caption = title) {
  return {
    loc: absoluteUrl(src),
    title,
    caption,
  };
}

function xml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
