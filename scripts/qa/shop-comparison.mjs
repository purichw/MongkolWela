import sharp from "sharp";

const reference = process.env.SHOP_REFERENCE || "/var/folders/3k/m69pt27s00bd_l2yzfjvmk8w0000gn/T/codex-clipboard-058796ae-7346-4279-99fa-712a9995a5f1.png";
const output = "artifacts/shop-mockup";
const label = (text, width) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40"><rect width="100%" height="100%" fill="#fff"/><text x="12" y="26" font-family="Arial" font-size="16" fill="#222">${text}</text></svg>`);
for (const { viewport, width, crop } of [
  { viewport: 1440, width: 720, crop: { left: 25, top: 5, width: 943, height: 1193 } },
  { viewport: 390, width: 390, crop: { left: 1000, top: 6, width: 289, height: 1178 } },
]) {
  const ref = await sharp(reference).extract(crop).resize({ width }).toBuffer();
  const actual = await sharp(`${output}/actual-${viewport}.png`).resize({ width }).toBuffer();
  const height = Math.max((await sharp(ref).metadata()).height, (await sharp(actual).metadata()).height) + 40;
  await sharp({ create: { width: width * 2 + 16, height, channels: 3, background: "#e9e9e5" } }).composite([
    { input: label(`Reference / inferred ${viewport}px`, width), left: 0, top: 0 }, { input: ref, left: 0, top: 40 },
    { input: label(`Actual / ${viewport}px / closed service`, width), left: width + 16, top: 0 }, { input: actual, left: width + 16, top: 40 },
  ]).png().toFile(`${output}/comparison-${viewport}.png`);
}
const desktop = await sharp(`${output}/actual-1440.png`).resize({ width: 900 }).toBuffer();
const mobile = await sharp(`${output}/actual-390.png`).resize({ width: 244 }).toBuffer();
await sharp({ create: { width: 1164, height: Math.max((await sharp(desktop).metadata()).height, (await sharp(mobile).metadata()).height) + 40, channels: 3, background: "#e9e9e5" } }).composite([
  { input: label("Desktop / 1440px", 900), left: 0, top: 0 }, { input: desktop, left: 0, top: 40 },
  { input: label("Mobile / 390px", 244), left: 920, top: 0 }, { input: mobile, left: 920, top: 40 },
]).png().toFile(`${output}/actual-overview.png`);
console.log(`${output}/comparison-1440.png\n${output}/comparison-390.png\n${output}/actual-overview.png`);
