export function contentUnavailable(cause) {
  return Object.assign(new Error("ไม่สามารถโหลดข้อมูลล่าสุดได้ กรุณาลองใหม่", { cause }), { statusCode: 503 });
}

// A configured live source must succeed; absence and failure are not equivalent.
export async function readPublishedContent({ read, normalize }) {
  try {
    const content = normalize(await read());
    if (!content) throw new Error("Published content is invalid or missing");
    return content;
  } catch (error) {
    throw contentUnavailable(error);
  }
}
