import sharp from "sharp";
import path from "node:path";

const root = path.resolve("artifacts/admin-analytics");
const [desktop, mobile] = process.argv.slice(2);
if (!desktop || !mobile) throw new Error("Pass desktop and mobile reference image paths");
const label = (text, width) => Buffer.from(`<svg width="${width}" height="34"><rect width="100%" height="100%" fill="#fff"/><text x="10" y="23" font-family="Arial" font-size="13" fill="#24332c">${text}</text></svg>`);
async function sheet(panels, filename) {
  const composites = []; let x = 0, height = 0;
  for (const panel of panels) {
    const pipeline = sharp(panel.file);
    if (panel.crop) pipeline.extract(panel.crop);
    const { data, info } = await pipeline.resize({ width: panel.width }).png().toBuffer({ resolveWithObject: true });
    composites.push({ input: label(panel.label, panel.width), left: x, top: 0 }, { input: data, left: x, top: 34 });
    height = Math.max(height, info.height + 34); x += panel.width + 16;
  }
  await sharp({ create: { width: x - 16, height, channels: 3, background: "#f1f2ee" } }).composite(composites).png().toFile(path.join(root, filename));
}
await sheet([
  { file: desktop, width: 720, label: "Reference / illustrative analytics" },
  { file: path.join(root, "analytics-1440.png"), width: 720, label: "Development / 1440 px / isolated test events" },
], "comparison-desktop.png");
await sheet([
  { file: mobile, crop: { left: 112, top: 56, width: 720, height: 1551 }, width: 390, label: "Reference / phone content (approximate crop)" },
  { file: path.join(root, "analytics-390.png"), width: 390, label: "Development / 390 px / isolated test events" },
], "comparison-mobile.png");
