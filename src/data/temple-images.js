import templeImageOverrides from "./temple-image-overrides.json";

export const templePlaceholderImage =
  templeImageOverrides._meta?.placeholderImage || "/assets/images/temple-placeholder-auspicious.png";

export function applyTempleImageOverrides(collection, temples) {
  const collectionOverrides = templeImageOverrides[collection] || {};

  return temples.map((temple) => {
    const key = getTempleImageKey(temple);
    const override = collectionOverrides[key];
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
