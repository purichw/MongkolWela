const selectors = {
  navToggle: ".nav-toggle",
  navMenu: "#primary-menu",
};

export function initMobileNavigation() {
  const navToggle = document.querySelector(selectors.navToggle);
  const navMenu = document.querySelector(selectors.navMenu);

  if (!navToggle || !navMenu) return;

  const mobileQuery = window.matchMedia("(max-width: 720px)");
  syncMenuAvailability(navToggle, navMenu, mobileQuery.matches);

  navToggle.addEventListener("click", (event) => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    setMenuOpen(navToggle, navMenu, !isOpen);
  });

  navMenu.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setMenuOpen(navToggle, navMenu, false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
      setMenuOpen(navToggle, navMenu, false, { returnFocus: true });
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || navMenu.contains(target) || navToggle.contains(target)) return;
    if (navToggle.getAttribute("aria-expanded") === "true") {
      setMenuOpen(navToggle, navMenu, false);
    }
  });

  mobileQuery.addEventListener?.("change", (event) => {
    syncMenuAvailability(navToggle, navMenu, event.matches);
  });
}

function setMenuOpen(navToggle, navMenu, shouldOpen, options = {}) {
  navToggle.setAttribute("aria-expanded", String(shouldOpen));
  navMenu.classList.toggle("is-open", shouldOpen);
  navMenu.toggleAttribute("inert", !shouldOpen && navMenu.dataset.mobileMenu === "true");
  document.body.classList.toggle("has-open-mobile-nav", shouldOpen);

  if (!shouldOpen && options.returnFocus) {
    navToggle.focus({ preventScroll: true });
  }
}

function syncMenuAvailability(navToggle, navMenu, isMobile) {
  navMenu.dataset.mobileMenu = String(isMobile);

  if (isMobile) {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navMenu.toggleAttribute("inert", !isOpen);
    return;
  }

  navToggle.setAttribute("aria-expanded", "false");
  navMenu.classList.remove("is-open");
  navMenu.removeAttribute("inert");
  document.body.classList.remove("has-open-mobile-nav");
}
