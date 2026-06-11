import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceDir = new URL("./_palm_svg_build/", import.meta.url);
const outputDir = new URL("../public/images/lines/", import.meta.url);
const files = (await readdir(sourceDir)).filter((file) => file.endsWith(".svg"));

await Promise.all(
  files.map(async (file) => {
    const source = fileURLToPath(new URL(file, sourceDir));
    const target = fileURLToPath(new URL(file.replace(/\.svg$/, ".png"), outputDir));
    await sharp(source)
      .resize(300, 400, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toFile(target);
  }),
);

console.log(`rendered ${files.length} palm-line PNGs to ${fileURLToPath(outputDir)}`);
