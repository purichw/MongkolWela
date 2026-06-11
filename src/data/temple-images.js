import templeImageOverrides from "./temple-image-overrides.json" with { type: "json" };
import { applyTempleCmsRecords } from "./temple-cms.js";

export const templePlaceholderImage =
  templeImageOverrides._meta?.placeholderImage || "/assets/images/temple-placeholder-auspicious.png";

export function applyTempleImageOverrides(collection, temples) {
  return applyTempleCmsRecords(collection, temples);
}
