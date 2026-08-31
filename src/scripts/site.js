import { initHeroCarousel } from "./carousel.js";
import { initMobileNavigation } from "./navigation.js";
import { initObservability } from "./observability.js";
import { initPageLoader } from "./page-loader.js";
import { initRealtimeTopbar } from "./realtime-topbar.js";
import { initScrollProgress } from "./scroll-progress.js";

initPageLoader();
initObservability();
initRealtimeTopbar();
initScrollProgress();
initHeroCarousel();
initMobileNavigation();
