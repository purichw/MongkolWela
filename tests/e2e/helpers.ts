import type { Page } from "@playwright/test";
import { nfrKeyRoutes } from "../../src/data/nfr-key-routes.js";

export const keyRoutes = nfrKeyRoutes.map((route) => ({
  path: route.path,
  heading: new RegExp(route.headingPattern),
}));

export async function skipIntroLoader(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("mongkolwela.loader.v2.seen", "1");
  });
}

export async function stabilizeVisuals(page: Page) {
  await skipIntroLoader(page);
  await page.addInitScript(() => {
    Date.now = () => new Date("2026-06-08T03:00:00.000Z").getTime();
    const css = `
      *, *::before, *::after {
        animation-duration: 0.001s !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.001s !important;
      }
      .scroll-progress,
      .topbar,
      .site-loader {
        visibility: hidden !important;
      }
    `;
    const inject = () => {
      const style = document.createElement("style");
      style.setAttribute("data-visual-regression-style", "");
      style.textContent = css;
      document.head.appendChild(style);
    };
    if (document.head) inject();
    else document.addEventListener("DOMContentLoaded", inject, { once: true });
  });
}

export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Failed to load resource|favicon|ERR_ABORTED/.test(text)) return;
    errors.push(text);
  });
  return errors;
}
