import { contentRevision } from "./content-revision.js";
import { libraryForPath } from "../data/content-catalog.js";
import { templeRouteCatalog, resolveTempleRoute } from "./temple-routing.js";
import { getTempleDetailUrl } from "../data/temple-slugs.js";

export function publicContentForPath(content, pathname) {
  const route = `/${String(pathname || "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
  const detail = route.match(/^\/temples\/(popular|mu|sacred)\/([^/]+)\/$/);
  const normalize = value => {
    try { return decodeURIComponent(value); } catch { return value; }
  };
  const place = detail ? resolveTempleRoute(detail[1], normalize(detail[2]), content) : null;
  const pageRoutes = new Set([normalize(route), ...(place ? [place.canonicalPath, ...place.temple.cmsSlugAliases.map(slug => `/temples/${detail[1]}/${slug}/`)] : [])]);
  const templesNeeded = route === "/" || (route.startsWith("/temples/") && route !== "/temples/planner/");
  return {
    schemaVersion: content.schemaVersion,
    cmsContractVersion: content.cmsContractVersion,
    publishedAt: content.publishedAt,
    site: content.site,
    analytics: content.analytics,
    navigation: content.navigation,
    contentLibrary: libraryForPath(content.contentLibrary, route),
    pages: (content.pages || []).filter((page) => {
      const pageRoute = `/${String(page.route || "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
      return pageRoutes.has(normalize(pageRoute));
    }).map(page => place ? { ...page, route } : page),
    ...(templesNeeded ? { temples: {
      ...content.temples,
      routes: Object.fromEntries(templeRouteCatalog(content).map(item => [item.cmsKey, getTempleDetailUrl(item.collection, item)])),
    } } : {}),
    ...(route === "/temples/planner/" ? { plannerDataRevision: contentRevision(content.temples) } : {}),
  };
}
