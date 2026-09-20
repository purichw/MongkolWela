export const homeHeroMetadata = {
  position: "data-image-position",
  credit: "data-image-credit",
  sourceUrl: "data-image-source",
  license: "data-image-license",
  licenseUrl: "data-image-license-url",
};

export function homeHeroAttributes(patch = {}) {
  return Object.fromEntries(Object.entries(homeHeroMetadata).map(([field, attr]) => [attr, patch[field] || ""]));
}

export function imageCreditUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}
