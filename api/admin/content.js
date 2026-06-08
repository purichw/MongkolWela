import { publishLiveContent, readJsonBody, readLiveContent, requireAdmin, sendJson } from "./_shared.js";

function normalizeContent(content, actor) {
  const now = new Date().toISOString();
  return {
    ...content,
    schemaVersion: content.schemaVersion || 1,
    updatedAt: now,
    publishedAt: now,
    publishedBy: actor || "admin",
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const content = await readLiveContent();
      sendJson(res, 200, { ok: true, content });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

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
