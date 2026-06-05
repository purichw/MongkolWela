import { siteConfig } from "./site-config.js";

const DEFAULT_LOCALE = "th";
const DEFAULT_PAGE = "home";

export function renderSiteShell() {
  renderHeaders();
  renderFooters();
}

function renderHeaders() {
  document.querySelectorAll("[data-site-header]").forEach((target) => {
    const context = getContext(target);
    target.replaceWith(createHeader(context));
  });
}

function renderFooters() {
  document.querySelectorAll("[data-site-footer]").forEach((target) => {
    const context = getContext(target);
    target.replaceWith(createFooter(context));
  });
}

function getContext(target) {
  const locale = target.dataset.locale || document.documentElement.lang || DEFAULT_LOCALE;
  const config = siteConfig[locale] || siteConfig[DEFAULT_LOCALE];
  const pageId = target.dataset.page || DEFAULT_PAGE;
  const page = config.pages[pageId] || config.pages[DEFAULT_PAGE] || {};

  return {
    config,
    locale,
    page,
    pageId,
    root: target.dataset.root || "./",
  };
}

function createHeader(context) {
  const { config, page, root } = context;
  const header = element("header", "site-header");

  header.append(createTopbar(page.topbar || config.pages.home.topbar, root));

  const nav = element("nav", "navbar");
  nav.setAttribute("aria-label", config.navLabel);

  nav.append(createBrand(config, root));
  nav.append(createNavToggle(config));
  nav.append(createNavMenu(config, root));
  nav.append(createNavActions(config, root));
  header.append(nav);

  return header;
}

function createTopbar(items, root) {
  const topbar = element("div", "topbar");
  items.forEach((item) => {
    if (item.href) {
      const link = element("a");
      link.href = resolveHref(item.href, root);
      link.textContent = item.label;
      topbar.append(link);
      return;
    }

    const span = element("span");
    span.textContent = item.label;
    topbar.append(span);
  });
  return topbar;
}

function createBrand(config, root) {
  const brand = element("a", "brand");
  brand.href = resolveHref("", root);
  brand.setAttribute("aria-label", config.brandLabel);

  const mark = element("span", "brand-mark");
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "๙";

  const text = element("span");
  const name = element("strong");
  name.textContent = config.brandName;
  const subtitle = element("small");
  subtitle.textContent = config.brandSubtitle;
  if (/^[A-Za-z\s]+$/.test(config.brandSubtitle)) subtitle.lang = "en";
  text.append(name, subtitle);
  brand.append(mark, text);

  return brand;
}

function createNavToggle(config) {
  const button = element("button", "nav-toggle");
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "primary-menu");

  const mark = element("span");
  mark.setAttribute("aria-hidden", "true");
  const label = element("span", "sr-only");
  label.textContent = config.openMenuLabel;
  button.append(mark, label);

  return button;
}

function createNavMenu(config, root) {
  const menu = element("div", "nav-menu");
  menu.id = "primary-menu";

  config.nav.forEach((item) => {
    const navItem = element("div", "nav-item");
    const trigger = element("a");
    trigger.href = resolveHref(item.href, root);
    trigger.textContent = item.label;

    const panel = element("div", "mega-panel");
    item.items.forEach((panelItem) => {
      const link = element("a");
      link.href = resolveHref(panelItem.href, root);
      link.textContent = panelItem.label;
      panel.append(link);
    });

    navItem.append(trigger, panel);
    menu.append(navItem);
  });

  config.utilityNav.forEach((item) => {
    const link = element("a", "plain-link");
    link.href = resolveHref(item.href, root);
    link.textContent = item.label;
    menu.append(link);
  });

  return menu;
}

function createNavActions(config, root) {
  const actions = element("div", "nav-actions");

  const button = element("button", "icon-button");
  button.type = "button";
  button.setAttribute("aria-label", config.searchLabel);
  button.innerHTML = searchIcon();

  const language = element("a", "language");
  language.href = resolveHref(config.languageHref, root);
  language.hreflang = config.languageHrefLang;
  language.lang = config.languageLang;
  language.textContent = config.languageLabel;

  actions.append(button, language);
  return actions;
}

function createFooter(context) {
  const { config, page, root } = context;
  const footer = element("footer", "site-footer");
  footer.id = "consult";

  const intro = element("div");
  const title = element("strong");
  title.textContent = config.footer.title;
  const description = element("p");
  description.textContent = config.footer.description;
  intro.append(title, description);

  const links = element("div", "footer-links");
  const footerLinks =
    page.footerLinks ||
    [
      { label: "TH", href: "", lang: "th" },
      { label: "EN", href: "en/", lang: "en" },
      { label: config.footer.contact, href: "#consult" },
      {
        label: page.footerVariant === "home" ? config.footer.credits : config.footer.rituals,
        href: page.footerVariant === "home" ? "#" : "#rituals",
      },
    ];

  footerLinks.forEach((item) => {
    const link = element("a");
    link.href = resolveHref(item.href, root);
    if (item.lang) link.lang = item.lang;
    link.textContent = item.label;
    links.append(link);
  });

  footer.append(intro, links);

  if (page.footerVariant === "home") {
    const credits = element("p", "credits");
    credits.lang = "en";
    credits.textContent = config.footer.imageCredits;
    footer.append(credits);
  }

  return footer;
}

function resolveHref(href, root) {
  if (!href) return root;
  if (/^(https?:|mailto:|tel:)/.test(href)) return href;
  if (href.startsWith("#")) return `${root}${href}`;
  return `${root}${href}`;
}

function element(tagName, className) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  return node;
}

function searchIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 21-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"></path>
    </svg>
  `;
}
