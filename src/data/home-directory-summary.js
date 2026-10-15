import { thailandPublicPlaces } from "./thailand-places.js";

// Initial markup only; the CMS runtime replaces these with published counts.
const places = thailandPublicPlaces({});

export const homeDirectorySummary = {
  templeCount: places.length,
  provinceCount: new Set(places.map(place => place.province).filter(Boolean)).size,
};
