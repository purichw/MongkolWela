// Shared by the API and existing CMS editor. The national data is loaded only
// by the server or authenticated editor, never the visitor's search bundle.
import { mergePlaceMetadata } from "./place-metadata.js";

export function directorySnapshotBase(curated, snapshot, enrichment = null) {
  const evidence = new Map();
  for (const place of snapshot.places) if (place.curatedKey) {
    const key = `thailand:${place.curatedKey}`;
    evidence.set(key, mergePlaceMetadata(evidence.get(key), place.metadata));
  }
  const places = [...curated.map(place => ({ ...place, temple: { ...place.temple,
    metadata: mergePlaceMetadata(place.temple.metadata, evidence.get(place.key)) } })),
    ...snapshot.places.filter(place => !place.curatedKey).map((place, index) => ({
    key: `thailand:osm:${place.id}`, source: "osm",
    temple: {
      name: place.name, province: place.province, region: place.region,
      district: place.district || "", latitude: place.latitude, longitude: place.longitude,
      coordinateAddress: place.address || "", plusCode: "", rank: curated.length + index + 1,
      coordinateSourceUrl: `https://www.openstreetmap.org/${place.id}`,
      metadata: place.metadata,
    },
  }))];
  if (!enrichment) return places;
  return places.map(place => ({ ...place, temple: { ...place.temple,
    metadata: mergePlaceMetadata(place.temple.metadata, enrichment.byKey?.[place.key]) } }));
}
