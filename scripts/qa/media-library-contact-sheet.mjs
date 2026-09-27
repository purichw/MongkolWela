import sharp from "sharp";
import path from "node:path";

const root = path.resolve("artifacts/admin-media");
const reference = process.argv[2];
if (!reference) throw new Error("Pass the supplied media-library reference image path");
const label = (text, width) => Buffer.from(`<svg width="${width}" height="36"><rect width="100%" height="100%" fill="#fff"/><text x="10" y="24" font-family="Arial" font-size="14" fill="#24332c">${text}</text></svg>`);
async function sheet(panels, filename) {
  const composites = []; let x = 0, height = 0;
  for (const panel of panels) {
    const pipeline = sharp(panel.file);
    if (panel.crop) pipeline.extract(panel.crop);
    const { data, info } = await pipeline.resize({ width: panel.width }).png().toBuffer({ resolveWithObject: true });
    composites.push({ input: label(panel.label, panel.width), left: x, top: 0 }, { input: data, left: x, top: 36 });
    height = Math.max(height, info.height + 36); x += panel.width + 16;
  }
  await sharp({ create: { width: x - 16, height, channels: 3, background: "#f1f2ee" } }).composite(composites).png().toFile(path.join(root, filename));
}
await sheet([
  { file: reference, crop: { left: 6, top: 8, width: 978, height: 1187 }, width: 720, label: "Reference / desktop / illustrative records" },
  { file: path.join(root, "library-1440.png"), width: 720, label: "Development / 1440 px / 20 records / isolated test data" },
], "comparison-desktop.png");
await sheet([
  { file: reference, crop: { left: 1000, top: 80, width: 304, height: 1094 }, width: 320, label: "Reference / mobile / illustrative records" },
  ...["viewport", "middle", "bottom"].map((part, index) => ({ file: path.join(root, `library-390-${part}.png`), width: 320, label: `Development / 390 px / ${["top", "middle", "bottom"][index]}` })),
], "comparison-mobile.png");
