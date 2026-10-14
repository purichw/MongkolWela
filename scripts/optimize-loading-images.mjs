import sharp from "sharp";
import { fileURLToPath } from "node:url";

const names = ["temple", "stupa", "incense", "lotus", "amulet", "altar", "gate", "sacred-thread", "candle", "temple-map"];
const directory = new URL("../src/assets/loading/", import.meta.url);

// Checked-in derivatives keep the shared loader off the SSR image-transform path.
for (const name of names) {
  await sharp(fileURLToPath(new URL(`${name}.png`, directory)))
    .resize(384, 384)
    .webp({ quality: 90 })
    .toFile(fileURLToPath(new URL(`${name}.webp`, directory)));
}
