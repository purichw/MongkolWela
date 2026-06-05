const selectors = {
  navToggle: ".nav-toggle",
  navMenu: "#primary-menu",
};

export function initMobileNavigation() {
  const navToggle = document.querySelector(selectors.navToggle);
  const navMenu = document.querySelector(selectors.navMenu);

  if (!navToggle || !navMenu) return;

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    setMenuOpen(navToggle, navMenu, !isOpen);
  });

  navMenu.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setMenuOpen(navToggle, navMenu, false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(navToggle, navMenu, false);
    }
  });
}

function setMenuOpen(navToggle, navMenu, shouldOpen) {
  navToggle.setAttribute("aria-expanded", String(shouldOpen));
  navMenu.classList.toggle("is-open", shouldOpen);
}
