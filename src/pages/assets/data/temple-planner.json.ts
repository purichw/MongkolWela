import type { APIRoute } from "astro";
import { getTemplePlannerData } from "../../../data/temple-planner.js";

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(getTemplePlannerData()).replace(/</g, "\\u003c"), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
