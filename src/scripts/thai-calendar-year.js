import { mountCalendar } from "./calendar-overview.js";

const root = document.querySelector("[data-calendar-app]");
if (root) mountCalendar(root);
