import { initHeroCarousel } from "./carousel.js";
import { initMobileNavigation } from "./navigation.js";
import { initObservability } from "./observability.js";
import { initPageLoader } from "./page-loader.js";
import { initRealtimeTopbar } from "./realtime-topbar.js";
import { initScrollProgress } from "./scroll-progress.js";
import { initPublicSelects } from "./public-select.js";
import { initMediaMotion } from "./media-motion.js";
import { initTempleSearch } from "./temple-search.js";

initPageLoader();
initMediaMotion();
initObservability();
initRealtimeTopbar();
initScrollProgress();
initHeroCarousel();
initMobileNavigation();
initTempleSearch();
initPublicSelects();
