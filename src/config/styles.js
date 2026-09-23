import tokens from "../styles/tokens.css?url";
import pdpa from "../styles/pdpa.css?url";
import base from "../styles/base.css?url";
import header from "../styles/header.css?url";
import publicUi from "../styles/public-ui.css?url";
import home from "../styles/home.css?url";
import feature from "../styles/feature-template.css?url";
import tarot from "../styles/tarot.css?url";
import tarotExperience from "../styles/tarot-experience.css?url";
import tarotLibrary from "../styles/tarot-library.css?url";
import seamsi from "../styles/seamsi.css?url";
import life from "../styles/life-graph.css?url";
import astrology from "../styles/thai-astrology.css?url";
import palmistry from "../styles/palmistry.css?url";
import calendar from "../styles/thai-calendar.css?url";
import calendarOverview from "../styles/calendar-overview.css?url";
import temples from "../styles/temples.css?url";
import templeHub from "../styles/temple-hub.css?url";
import map from "../styles/temple-map.css?url";
import responsive from "../styles/responsive.css?url";
import headlines from "../styles/thai-headlines.css?url";
import admin from "../styles/admin.css?url";
import adminActivities from "../styles/admin-activities.css?url";
import site from "../styles/site.css?url";
import planner from "../styles/temple-planner.css?url";
import thailand from "../styles/temple-thailand.css?url";
import popularFilters from "../styles/popular-filters.css?url";
import publicSelect from "../styles/public-select.css?url";
import tools from "../styles/tools.css?url";
import errorPages from "../styles/error-pages.css?url";

// Keep the existing cascade order while loading only the route's feature styles.
export function stylesForPath(path, page = "") {
  if (path === "/admin/") return [tokens, base, pdpa, admin, site, adminActivities];
  const featureStyles = path.startsWith("/tarot/") ? [tarot]
    : path === "/calendar/" ? [calendarOverview]
    : path === "/calendar/day/" ? []
    : path.startsWith("/calendar/") ? [calendar]
    : path.includes("/life-graph/") ? [life]
    : path.includes("/seamsi/") ? [seamsi]
    : path.includes("/thai-astrology/") ? [astrology]
    : path.includes("/palmistry/") ? [palmistry]
    : path === "/temples/" ? [templeHub]
    : path.startsWith("/temples/") ? [temples, map]
    : [];
  const isTool = path.startsWith("/tarot/") || /^\/horoscope\/(life-graph|palmistry|seamsi|thai-astrology)\//.test(path);
  return [tokens, base, publicUi, header, pdpa, ...(path === "/" ? [home] : []), feature, ...featureStyles, responsive, headlines, site, ...(path === "/temples/planner/" ? [planner] : []), ...(path === "/temples/thailand/" ? [thailand] : []), publicSelect, ...(isTool ? [tools] : []), ...(path.startsWith("/tarot/") ? [tarotExperience] : []), ...(path.startsWith("/tarot/meanings/") ? [tarotLibrary] : []), ...(path === "/temples/popular/" ? [popularFilters] : []), ...(/^error-(403|404|500)$/.test(page) ? [errorPages] : [])];
}
