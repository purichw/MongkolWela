import {
  CMS_EDITABLE_CONTRACT_VERSION,
  publishLiveContent,
  readJsonBody,
  readLiveContent,
  requireSameOrigin,
  sendJson,
} from "./_shared.js";
import { requireAdmin } from "./_auth.js";
import { publicContentPayload, publicContentNeedsTempleData } from "../../src/lib/public-content.js";
import { contentRevision } from "../../src/lib/content-revision.js";
import { contentCatalog, validateContentLibrary } from "../../src/data/content-catalog.js";
import { validateContentPatches } from "../../src/lib/content-patches.js";
import { validateHomepageContent } from "../../src/lib/homepage-content.js";
import { validateNavigation } from "../../src/lib/site-navigation.js";
import { prepareTempleSlugPublication } from "../../src/lib/temple-routing.js";
import { thailandDirectoryPage } from "../../src/data/thailand-places.js";
import { synchronizePlaceHistories } from "../../src/lib/place-history.js";

function normalizeContent(content, actor) {
  const now = new Date().toISOString();
  return {
    ...content,
    schemaVersion: content.schemaVersion || 1,
    cmsContractVersion: CMS_EDITABLE_CONTRACT_VERSION,
    updatedAt: now,
    publishedAt: now,
    publishedBy: actor || "admin",
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const params = new URL(req.url, "http://localhost").searchParams;
      const content = await readLiveContent({ includeTemples: Boolean(params.get("view")) || publicContentNeedsTempleData(params.get("path")) });
      validateContentLibrary(content.contentLibrary);
      if (params.get("view") === "editor") {
        if (!await requireAdmin(req, res)) return;
        const { publishedAt, updatedAt, ...fields } = content;
        sendJson(res, 200, { ok: true, revision: contentRevision(fields), content });
        return;
      }
      if (params.get("view") === "directory") {
        const page = thailandDirectoryPage(content, params);
        if (params.get("revision") && params.get("revision") !== page.revision) {
          sendJson(res, 409, { ok: false, error: "รายการสถานที่มีการปรับปรุง กรุณาโหลดผลการค้นหาใหม่" });
        } else sendJson(res, 200, { ok: true, page });
        return;
      }
      if (params.get("view") === "catalog") {
        if (!await requireAdmin(req, res)) return;
        sendJson(res, 200, { ok: true, catalog: contentCatalog() });
        return;
      }
      const pathname = params.get("path");
      const payload = publicContentPayload(content, pathname);
      const { revision } = payload;
      sendJson(res, 200, params.get("revision") === revision
        ? { ok: true, revision, unchanged: true }
        : payload);
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    if (!requireSameOrigin(req, res)) return;

    const session = await requireAdmin(req, res);
    if (!session) return;

    const body = await readJsonBody(req);
    if (!body || !body.content || typeof body.content !== "object") {
      sendJson(res, 400, { ok: false, error: "Missing content payload" });
      return;
    }

    validateContentLibrary(body.content.contentLibrary);
    validateContentPatches(body.content);
    validateHomepageContent(body.content);
    validateNavigation(body.content.navigation);
    const current = await readLiveContent();
    const { publishedAt: oldPublishedAt, updatedAt: oldUpdatedAt, ...currentFields } = current;
    if (!body.expectedRevision || body.expectedRevision !== contentRevision(currentFields)) {
      sendJson(res, 409, { ok: false, error: "เนื้อหามีเวอร์ชันใหม่แล้ว กรุณาบันทึกฉบับร่างและโหลดข้อมูลล่าสุดก่อนเผยแพร่" });
      return;
    }
    const content = normalizeContent(prepareTempleSlugPublication(synchronizePlaceHistories(body.content, current), current), session.actor);
    const publish = await publishLiveContent(content, session.actor, { expectedPublishedAt: current.publishedAt ?? null });
    sendJson(res, 200, {
      ok: true,
      content,
      meta: {
        mode: publish.mode,
        commitSha: publish.commitSha || "",
        contentSha: publish.contentSha || "",
        warnings: publish.warnings || [],
        fast: publish.fast === true,
        publishedAt: content.publishedAt,
        actor: session.actor,
      },
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Content API failed",
    });
  }
}
