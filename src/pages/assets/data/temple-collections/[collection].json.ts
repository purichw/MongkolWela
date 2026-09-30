import type { APIRoute, GetStaticPaths } from "astro";
import popularTemples from "../../../../data/popular-temples.json";
import muTemples from "../../../../data/mu-temples.json";
import sacredTemples from "../../../../data/sacred-temples.json";
import { applyTempleImageOverrides, templePlaceholderImage } from "../../../../data/temple-images.js";
import { getTempleDetailUrl } from "../../../../data/temple-slugs.js";

type CollectionKey = "popular" | "sacred" | "mu";

type TempleCard = {
  rank: number;
  name: string;
  region: string;
  province: string;
  district?: string;
  imageUrl?: string;
  imageMobileUrl?: string;
  imageAlt?: string;
  placeType?: string;
  blessings?: string;
  objectHero?: string;
  latitude?: number;
  longitude?: number;
  travelDetail?: {
    confidence?: string;
  };
};

const collectionSources: Record<CollectionKey, TempleCard[]> = {
  popular: popularTemples as TempleCard[],
  sacred: sacredTemples as TempleCard[],
  mu: muTemples as TempleCard[],
};

export const getStaticPaths = (() =>
  (Object.keys(collectionSources) as CollectionKey[]).map((collection) => ({
    params: { collection },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const collection = params.collection as CollectionKey;
  if (!collectionSources[collection]) return new Response("Not found", { status: 404 });

  return new Response(JSON.stringify({ items: getCollectionItems(collection) }).replace(/</g, "\\u003c"), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};

function getCollectionItems(collection: CollectionKey) {
  return applyTempleImageOverrides(collection, [...collectionSources[collection]])
    .sort((a: TempleCard, b: TempleCard) => Number(a.rank) - Number(b.rank))
    .map((temple: TempleCard) => {
      const hasTempleImage = Boolean(temple.imageUrl) && temple.imageUrl !== templePlaceholderImage;
      const imageUrl = hasTempleImage ? String(temple.imageUrl) : templePlaceholderImage;
      const blessings = splitTags(temple.blessings);
      const objectHero = splitTags(temple.objectHero);
      const confidence = confidenceFor(temple, hasTempleImage);

      return {
        key: `${collection}:${temple.rank}`,
        cmsKey: temple.cmsKey,
        collection,
        rank: temple.rank,
        name: temple.name,
        region: temple.region,
        province: temple.province,
        district: temple.district || "",
        imageUrl,
        imageMobileUrl: temple.imageMobileUrl || imageUrl,
        imageAlt: temple.imageAlt || `${temple.name} ${temple.province}`,
        placeType: temple.placeType || "",
        blessings: temple.blessings || "",
        objectHero: temple.objectHero || "",
        latitude: temple.latitude,
        longitude: temple.longitude,
        confidence,
        intent: blessings[0] || objectHero[0] || temple.placeType || "สิริมงคล",
        detailUrl: getTempleDetailUrl(collection, temple),
        plannerUrl: `/temples/planner/?start=${encodeURIComponent(temple.name)}&province=${encodeURIComponent(temple.province)}`,
        searchText: `${temple.name} ${temple.region} ${temple.province} ${temple.district || ""} ${temple.blessings || ""} ${temple.objectHero || ""}`,
        hasTempleImage,
      };
    });
}

function splitTags(value?: string) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && item !== "0" && item.toLowerCase() !== "nan" && item.toLowerCase() !== "null");
}

function confidenceFor(temple: TempleCard, hasTempleImage: boolean) {
  const value = String(temple.travelDetail?.confidence || "").toLowerCase();
  if (value === "high") return { key: "high", label: "มั่นใจสูง" };
  if (value === "medium") return { key: "medium", label: "ปานกลาง" };
  if (Number.isFinite(Number(temple.latitude)) && Number.isFinite(Number(temple.longitude)) && hasTempleImage) {
    return { key: "medium", label: "ปานกลาง" };
  }
  return { key: "check", label: "ควรตรวจสอบ" };
}
