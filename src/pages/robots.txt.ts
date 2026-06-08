import type { APIRoute } from "astro";
import { absoluteUrl } from "../lib/seo.js";

export const GET: APIRoute = async () => {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /tarot/daily/result/",
    "Disallow: /tarot/monthly/result/",
    "Disallow: /tarot/luck/result/",
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
