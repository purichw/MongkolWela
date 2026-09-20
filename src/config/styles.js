import tokens from "../styles/tokens.css?url";
import base from "../styles/base.css?url";
import header from "../styles/header.css?url";
import home from "../styles/home.css?url";
import feature from "../styles/feature-template.css?url";
import tarot from "../styles/tarot.css?url";
import seamsi from "../styles/seamsi.css?url";
import life from "../styles/life-graph.css?url";
import astrology from "../styles/thai-astrology.css?url";
import palmistry from "../styles/palmistry.css?url";
import calendar from "../styles/thai-calendar.css?url";
import temples from "../styles/temples.css?url";
import map from "../styles/temple-map.css?url";
import responsive from "../styles/responsive.css?url";
import headlines from "../styles/thai-headlines.css?url";
import admin from "../styles/admin.css?url";
import adminActivities from "../styles/admin-activities.css?url";
import site from "../styles/site.css?url";
import planner from "../styles/temple-planner.css?url";

// Keep the existing cascade order while loading only the route's feature styles.
export function stylesForPath(path) {
  if (path === "/admin/") return [tokens, base, admin, site, adminActivities];
  const featureStyles = path.startsWith("/tarot/") ? [tarot]
    : path.startsWith("/calendar/") ? [calendar]
    : path.includes("/life-graph/") ? [life]
    : path.includes("/seamsi/") ? [seamsi]
    : path.includes("/thai-astrology/") ? [astrology]
    : path.includes("/palmistry/") ? [palmistry]
    : path.startsWith("/temples/") ? [temples, map]
    : [];
  return [tokens, base, header, ...(path === "/" ? [home] : []), feature, ...featureStyles, responsive, headlines, site, ...(path === "/temples/planner/" ? [planner] : [])];
}
