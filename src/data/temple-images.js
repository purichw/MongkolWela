import templeImageOverrides from "./temple-image-overrides.json";

export const templePlaceholderImage =
  templeImageOverrides._meta?.placeholderImage || "/assets/images/temple-placeholder-auspicious.png";

export function applyTempleImageOverrides(collection, temples) {
  const collectionOverrides = templeImageOverrides[collection] || {};
  const crossCollectionOverrides = getCrossCollectionImageOverrides();

  return temples.map((temple) => {
    const key = getTempleImageKey(temple);
    const override = collectionOverrides[key] || crossCollectionOverrides.get(key);
    if (!override) return temple;

    return {
      ...temple,
      ...override,
      imageAlt: override.imageAlt || temple.imageAlt || `${temple.name} ${temple.province}`,
      adminEditable: override.adminEditable ?? temple.adminEditable ?? true,
    };
  });
}

function getTempleImageKey(temple) {
  return `${temple.name}|${temple.province}`;
}

function getCrossCollectionImageOverrides() {
  const overrides = new Map();
  for (const [collection, collectionOverrides] of Object.entries(templeImageOverrides)) {
    if (collection.startsWith("_") || !collectionOverrides || typeof collectionOverrides !== "object") continue;
    for (const [key, override] of Object.entries(collectionOverrides)) {
      if (!overrides.has(key)) overrides.set(key, override);
    }
  }
  return overrides;
}
