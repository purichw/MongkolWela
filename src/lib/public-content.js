import { contentRevision } from "./content-revision.js";
import { libraryForPath } from "../data/content-catalog.js";

export function publicContentForPath(content, pathname) {
  const route = `/${String(pathname || "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
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
      return pageRoute === route;
    }),
    ...(templesNeeded ? { temples: content.temples } : {}),
    ...(route === "/temples/planner/" ? { plannerDataRevision: contentRevision(content.temples) } : {}),
  };
}
