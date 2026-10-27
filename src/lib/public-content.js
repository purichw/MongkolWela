import { contentRevision } from "./content-revision.js";
import { libraryForPath } from "../data/content-catalog.js";
import { templeRouteCatalog, resolveTempleRoute } from "./temple-routing.js";
import { getTempleDetailUrl } from "../data/temple-slugs.js";
import { thailandDirectoryPage, thailandDirectoryState } from "../data/thailand-places.js";
import { withoutHistoryResearch } from "./place-history.js";

const publicRoute = pathname => `/${String(pathname || "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");

export function publicContentNeedsTempleData(pathname) {
  const route = publicRoute(pathname);
  return !pathname || route === "/" || route.startsWith("/temples/");
}

function visitorTempleRecords(records, place) {
  // Keep lightweight siblings, including tombstones: a previously rendered
  // related card must still receive hide/edit updates after its ranking changes.
  const collection = place?.temple.collection;
  return Object.fromEntries(Object.entries(records || {})
    .filter(([key]) => !collection || key.startsWith(`${collection}:`))
    .map(([key, record]) => {
      if (!record?.fields || key === place?.temple.cmsKey) return [key, record];
      const { description, ...fields } = record.fields;
      return [key, { ...record, fields }];
    }));
}

export function publicContentPayload(content, pathname) {
  const projected = pathname ? publicContentForPath(content, pathname) : withoutHistoryResearch(content);
  // Publication timestamps alone do not indicate changes to the current page.
  const { publishedAt, updatedAt, ...revisionContent } = projected;
  return { ok: true, revision: contentRevision(revisionContent), content: projected };
}

export function publicContentForPath(content, pathname) {
  content = withoutHistoryResearch(content);
  const route = publicRoute(pathname);
  const detail = route.match(/^\/temples\/(popular|mu|sacred)\/([^/]+)\/$/);
  const normalize = value => {
    try { return decodeURIComponent(value); } catch { return value; }
  };
  const place = detail ? resolveTempleRoute(detail[1], normalize(detail[2]), content) : null;
  const pageRoutes = new Set([normalize(route), ...(place ? [place.canonicalPath, ...place.temple.cmsSlugAliases.map(slug => `/temples/${detail[1]}/${slug}/`)] : [])]);
  const templesNeeded = route === "/" || (route.startsWith("/temples/") && !["/temples/planner/", "/temples/thailand/"].includes(route));
  const directory = ["/", "/temples/", "/temples/thailand/"].includes(route) ? thailandDirectoryState(content) : null;
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
      records: visitorTempleRecords(content.temples?.records, place),
      overrides: visitorTempleRecords(content.temples?.overrides, place),
      routes: Object.fromEntries(templeRouteCatalog(content)
        .filter(item => !place || item.collection === place.temple.collection)
        .map(item => [item.cmsKey, getTempleDetailUrl(item.collection, item)])),
    } } : {}),
    ...(route === "/temples/planner/" ? { plannerDataRevision: contentRevision(content.temples) } : {}),
    ...(route === "/temples/thailand/" ? { directoryPage: thailandDirectoryPage(content) } : {}),
    ...(["/", "/temples/"].includes(route) ? { directorySummary: directory.summary } : {}),
  };
}
