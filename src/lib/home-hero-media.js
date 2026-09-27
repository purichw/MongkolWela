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

export function contentImageValues(node) {
  return {
    src: node?.getAttribute("data-carousel-src") ?? node?.getAttribute("src") ?? "",
    alt: node?.getAttribute("alt") ?? "",
    ...Object.fromEntries(Object.entries(homeHeroMetadata).map(([field, attr]) => [field, node?.getAttribute(attr) ?? ""])),
  };
}

export function updateImagePatch(patch, values) {
  if (Object.hasOwn(values, "src") && values.src !== patch.src) {
    for (const field of ["credit", "sourceUrl", "license", "licenseUrl"]) patch[field] = "";
  }
  Object.assign(patch, values);
}

export function imageCreditUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}
