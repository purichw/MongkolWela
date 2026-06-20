import type { APIRoute } from "astro";
import { absoluteUrl } from "../lib/seo.js";

export const GET: APIRoute = async () => {
  const aiUserAgents = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "Google-Extended",
    "CCBot",
    "PerplexityBot",
    "Bytespider",
    "Amazonbot",
    "Applebot-Extended",
    "FacebookBot",
    "meta-externalagent",
    "Diffbot",
    "PetalBot",
  ];

  const body = [
    ...aiUserAgents.flatMap((agent) => [`User-agent: ${agent}`, "Disallow: /", ""]),
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /api/",
    "Disallow: /assets/data/",
    "Disallow: /llms.txt",
    "Disallow: /p/",
    "Disallow: /tarot/daily/result/",
    "Disallow: /tarot/monthly/result/",
    "Disallow: /tarot/love/result/",
    "Disallow: /tarot/money/result/",
    "Disallow: /tarot/career/result/",
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
