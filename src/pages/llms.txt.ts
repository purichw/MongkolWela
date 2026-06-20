import type { APIRoute } from "astro";
import { absoluteUrl } from "../lib/seo.js";

export const GET: APIRoute = async () => {
  const body = `# มงคลเวลา (Mongkol Wela)

This site does not grant permission for automated extraction, model training, dataset building, or bulk republication of its content.

Human visitors may browse the public website at ${absoluteUrl("/")}.

Automated agents must follow the robots policy at ${absoluteUrl("/robots.txt")}.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    },
  });
};
