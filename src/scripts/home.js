import { homeHeroMetadata, imageCreditUrl } from "../lib/home-hero-media.js";
import { getHomeToday } from "../lib/home-today.js";

const weekday = document.querySelector("[data-home-weekday]");
const lunar = document.querySelector("[data-home-lunar]");
const moon = document.querySelector("[data-home-moon]");
const today = getHomeToday();
if (weekday) weekday.textContent = today.weekday;
if (lunar) lunar.textContent = today.lunarLabel;
if (moon) moon.dataset.homeMoon = today.moon;

const carousel = document.querySelector("[data-carousel]");
const credit = document.querySelector("[data-home-hero-credit]");
if (carousel && credit) {
  let previous = "";
  const renderCredit = () => {
    carousel.querySelectorAll("[data-home-hero-image]").forEach(image => {
      image.style.objectPosition = image.dataset.imagePosition || "";
    });
    const image = carousel.querySelector(".is-active [data-home-hero-image]");
    const data = image?.dataset || {};
    const signature = JSON.stringify([image?.getAttribute("src"), image?.className, ...Object.values(homeHeroMetadata).map(attr => image?.getAttribute(attr))]);
    if (signature === previous) return;
    previous = signature;
    credit.replaceChildren();
    const unavailable = !data.imageCredit || !image?.getAttribute("src") || image.getAttribute("src") === data.fallbackSrc;
    credit.hidden = credit.hasAttribute("data-demo-hidden") || unavailable;
    if (unavailable) return;
    const link = (label, url) => {
      const href = imageCreditUrl(url);
      const node = document.createElement(href ? "a" : "span");
      node.textContent = label;
      if (href) { node.href = href; node.target = "_blank"; node.rel = "noopener noreferrer"; }
      return node;
    };
    credit.append(link(data.imageCredit, data.imageSource));
    if (data.imageLicense) credit.append(" · ", link(data.imageLicense, data.imageLicenseUrl));
  };
  new MutationObserver(renderCredit).observe(carousel, {
    subtree: true, attributes: true,
    attributeFilter: ["src", "class", ...Object.values(homeHeroMetadata)],
  });
  renderCredit();
}
