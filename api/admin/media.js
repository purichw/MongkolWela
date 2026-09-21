import crypto from "node:crypto";
import { readJsonBody, requireSameOrigin, sendJson } from "./_shared.js";
import { requireAdmin } from "./_auth.js";

function mediaConfig() {
  const cloudinary = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    uploadPreset: process.env.CLOUDINARY_UNSIGNED_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET || "",
  };
  const imagekit = {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "",
  };
  const preferred = String(process.env.ADMIN_MEDIA_PROVIDER || "").toLowerCase();
  const cloudinaryReady = Boolean(cloudinary.cloudName && cloudinary.uploadPreset);
  const imagekitReady = Boolean(imagekit.publicKey && imagekit.privateKey);
  const provider =
    preferred === "imagekit" && imagekitReady
      ? "imagekit"
      : preferred === "cloudinary" && cloudinaryReady
        ? "cloudinary"
        : cloudinaryReady
          ? "cloudinary"
          : imagekitReady
            ? "imagekit"
            : "";

  return { cloudinary, imagekit, cloudinaryReady, imagekitReady, provider };
}

export default async function handler(req, res) {
  try {
    const session = await requireAdmin(req, res);
    if (!session) return;

    const config = mediaConfig();
    if (req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        media: {
          provider: config.provider,
          cloudinary: config.cloudinaryReady
            ? { enabled: true, cloudName: config.cloudinary.cloudName, uploadPreset: config.cloudinary.uploadPreset }
            : { enabled: false },
          imagekit: config.imagekitReady
            ? { enabled: true, publicKey: config.imagekit.publicKey, urlEndpoint: config.imagekit.urlEndpoint }
            : { enabled: false },
        },
      });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    if (!requireSameOrigin(req, res)) return;

    const body = await readJsonBody(req, { maxBytes: 8192 });
    if (body.action !== "imagekit-auth" || !config.imagekitReady) {
      sendJson(res, 400, { ok: false, error: "ImageKit is not configured" });
      return;
    }

    const token = crypto.randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 20 * 60;
    const signature = crypto
      .createHmac("sha1", config.imagekit.privateKey)
      .update(`${token}${expire}`)
      .digest("hex");

    sendJson(res, 200, {
      ok: true,
      authentication: {
        token,
        expire,
        signature,
        publicKey: config.imagekit.publicKey,
      },
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message || "Media API failed" });
  }
}
