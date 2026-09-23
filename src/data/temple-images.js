import { sitePlaceholderImage } from "../lib/image-placeholder.js";
import { applyTempleCmsRecords } from "./temple-cms.js";

export const templePlaceholderImage = sitePlaceholderImage;

export function applyTempleImageOverrides(collection, temples) {
  return applyTempleCmsRecords(collection, temples);
}
