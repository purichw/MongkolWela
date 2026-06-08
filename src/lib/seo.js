export const SEO_SITE_URL = "https://mongkolwela.vercel.app";
export const SEO_SITE_NAME = "มงคลเวลา";
export const SEO_DEFAULT_IMAGE = "/assets/images/hero-temple-red.jpg";
export const SEO_DEFAULT_IMAGE_WIDTH = 1200;
export const SEO_DEFAULT_IMAGE_HEIGHT = 630;

const SITE_DESCRIPTION =
  "มงคลเวลา รวมดูดวง ปฏิทินไทย ฤกษ์มงคล ไพ่ยิปซี และพิกัดวัดดังสายมูสายไหว้พระ พร้อมข้อมูลวัดทั่วประเทศไทยสำหรับผู้ใช้ไทย";

export function absoluteUrl(path = "/") {
  if (!path) return SEO_SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, SEO_SITE_URL).toString();
}

export function canonicalUrl(path = "/") {
  const url = new URL(absoluteUrl(path));
  url.hash = "";
  url.search = "";
  return url.toString();
}

export function cleanDescription(value, fallback = SITE_DESCRIPTION) {
  const text = String(value || fallback)
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 165 ? `${text.slice(0, 162).trim()}...` : text;
}

export function splitSeoList(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && !["0", "nan", "null", "undefined", "-"].includes(item.toLowerCase()));
}

export function createOrganizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SEO_SITE_NAME,
    alternateName: "Mongkol Wela",
    url: SEO_SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/favicon.svg"),
    },
  };
}

export function createWebSiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SEO_SITE_NAME,
    alternateName: "Mongkol Wela",
    url: SEO_SITE_URL,
    inLanguage: "th-TH",
    description: SITE_DESCRIPTION,
    publisher: { "@id": absoluteUrl("/#organization") },
  };
}

/**
 * @param {{
 *   title: string,
 *   description?: string,
 *   url: string,
 *   image?: string,
 *   breadcrumbs?: Array<{ label: string, href?: string }>
 * }} params
 */
export function createWebPageJsonLd({ title, description, url, image, breadcrumbs = [] }) {
  const page = {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description: cleanDescription(description),
    inLanguage: "th-TH",
    isPartOf: { "@id": absoluteUrl("/#website") },
    publisher: { "@id": absoluteUrl("/#organization") },
  };

  if (image) {
    page.primaryImageOfPage = {
      "@type": "ImageObject",
      url: image,
    };
  }

  if (breadcrumbs.length) page.breadcrumb = { "@id": `${url}#breadcrumb` };
  return page;
}

export function createBreadcrumbJsonLd(items, pageUrl) {
  const normalizedItems = normalizeBreadcrumbs(items);
  if (!normalizedItems.length) return null;

  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: normalizedItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: canonicalUrl(item.href || pageUrl),
    })),
  };
}

export function createItemListJsonLd({ name, description, url, items }) {
  return {
    "@type": "ItemList",
    "@id": `${canonicalUrl(url)}#itemlist`,
    name,
    description: cleanDescription(description, name),
    url: canonicalUrl(url),
    inLanguage: "th-TH",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name || item.title,
      url: canonicalUrl(item.url || item.href),
    })),
  };
}

export function createTempleJsonLd({ temple, collectionLabel, collectionHref, pageUrl, imageUrl }) {
  const blessings = splitSeoList(temple.blessings);
  const objects = splitSeoList(temple.objectHero);
  const travelModes = splitSeoList(temple.travelModes);
  const lat = Number(temple.latitude);
  const lng = Number(temple.longitude);
  const address = [temple.district, temple.province, "ประเทศไทย"].filter(Boolean).join(" ");
  const keywords = [
    temple.name,
    temple.province,
    temple.district,
    collectionLabel,
    ...blessings,
    ...objects,
    ...travelModes,
  ].filter(Boolean);

  const place = {
    "@type": ["TouristAttraction", "Place"],
    "@id": `${pageUrl}#place`,
    name: temple.name,
    url: pageUrl,
    image: imageUrl,
    description: cleanDescription(
      `${temple.name} ${temple.province}${temple.district ? ` ${temple.district}` : ""} ${blessings.length ? `เหมาะสำหรับ${blessings.slice(0, 4).join(" ")}` : `อยู่ใน${collectionLabel}`}`,
    ),
    inLanguage: "th-TH",
    address: {
      "@type": "PostalAddress",
      addressCountry: "TH",
      addressRegion: temple.province,
      addressLocality: temple.district || temple.province,
      streetAddress: address,
    },
    isPartOf: {
      "@type": "CollectionPage",
      name: collectionLabel,
      url: canonicalUrl(collectionHref),
    },
    keywords: keywords.join(", "),
  };

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    place.geo = {
      "@type": "GeoCoordinates",
      latitude: lat,
      longitude: lng,
    };
    place.hasMap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(temple.plusCode || `${lat},${lng}`)}`;
  }

  if (objects.length) place.touristType = objects.slice(0, 6);
  return place;
}

export function normalizeBreadcrumbs(items = []) {
  const hasHome = items.some((item) => item.href === "/" || item.label === "หน้าแรก");
  const normalized = hasHome ? [...items] : [{ label: "หน้าแรก", href: "/" }, ...items];
  return normalized.filter((item) => item?.label).map((item) => ({ label: item.label, href: item.href || "/" }));
}

export function toJsonLdGraph(nodes) {
  const compactNodes = nodes.flat().filter(Boolean);
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": compactNodes,
    },
    null,
    0,
  );
}
