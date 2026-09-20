import {
  CMS_EDITABLE_CONTRACT_VERSION,
  publishLiveContent,
  readJsonBody,
  readLiveContent,
  requireAdmin,
  requireSameOrigin,
  sendJson,
} from "./_shared.js";
import { publicContentForPath } from "../../src/lib/public-content.js";
import { contentRevision } from "../../src/lib/content-revision.js";

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
      const content = await readLiveContent();
      const params = new URL(req.url, "http://localhost").searchParams;
      const pathname = params.get("path");
      const projected = pathname ? publicContentForPath(content, pathname) : content;
      // Publication timestamps alone do not indicate changes to the current page.
      const { publishedAt, updatedAt, ...revisionContent } = projected;
      const revision = contentRevision(revisionContent);
      sendJson(res, 200, params.get("revision") === revision
        ? { ok: true, revision, unchanged: true }
        : { ok: true, revision, content: projected });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    if (!requireSameOrigin(req, res)) return;

    const session = requireAdmin(req, res);
    if (!session) return;

    const body = await readJsonBody(req);
    if (!body || !body.content || typeof body.content !== "object") {
      sendJson(res, 400, { ok: false, error: "Missing content payload" });
      return;
    }

    const content = normalizeContent(body.content, session.actor);
    const publish = await publishLiveContent(content, session.actor);
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
