import { createHash } from "node:crypto";

export function contentRevision(content) {
  return createHash("sha256").update(JSON.stringify(content ?? null)).digest("hex").slice(0, 24);
}
