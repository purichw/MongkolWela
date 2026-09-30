import { readLiveContent } from "../../api/admin/_shared.js";
import { resolveTempleRoute } from "../lib/temple-routing.js";

export async function loadTemplePage(collection, slug, url, read = readLiveContent) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const content = await read();
    const route = resolveTempleRoute(collection, slug, content);
    if (!route) return { response: unavailable(404, headers) };
    if (route.redirect || url.pathname !== route.canonicalPath) {
      return { response: new Response(null, { status: 308, headers: { ...headers, Location: route.canonicalPath + url.search } }) };
    }
    return { ...route, content, headers };
  } catch {
    return { response: unavailable(503, { ...headers, "Retry-After": "60" }) };
  }
}

function unavailable(status, headers) {
  const title = status === 404 ? "ไม่พบสถานที่นี้หรือยังไม่เปิดเผยแพร่" : "ไม่สามารถโหลดข้อมูลล่าสุดได้ กรุณาลองใหม่";
  return new Response(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${title}</title></head><body><main><h1>${title}</h1><a href="/temples/">ดูสถานที่ทั้งหมด</a></main></body></html>`, {
    status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
}
