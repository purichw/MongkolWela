import { mkdir, writeFile } from "node:fs/promises";

// Maintenance-only snapshot: never queried by the public site or CMS editor.
const queries = {
  places: `[out:json][timeout:180];area["ISO3166-1"="TH"][admin_level=2]->.th;(nwr(area.th)[amenity=place_of_worship][religion=buddhist];nwr(area.th)[amenity=monastery][religion=buddhist];);out meta center;`,
  provinces: `[out:json][timeout:180];rel[boundary=administrative][admin_level=4]["ISO3166-2"~"^TH-"];out meta geom;`,
};
const kind = process.argv[2];
if (!queries[kind]) throw new Error("Choose places or provinces");
const directory = new URL("../artifacts/directory-places/osm/", import.meta.url);
await mkdir(directory, { recursive: true });
const endpoint = "https://overpass.private.coffee/api/interpreter";
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "User-Agent": "MongkolWela-Directory-Research/1.0 (https://mongkolwela.vercel.app/contact/)", "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ data: queries[kind] }),
  signal: AbortSignal.timeout(210_000),
});
if (!response.ok) throw new Error(`Overpass ${response.status}: ${(await response.text()).slice(0, 700)}`);
const data = await response.json();
if (data.remark || !data.elements?.length) throw new Error(`Incomplete snapshot: ${data.remark || "no elements"}`);
data.query = queries[kind];
data.endpoint = endpoint;
data.retrievedAt = new Date().toISOString();
for (const element of data.elements) { delete element.user; delete element.uid; }
await writeFile(new URL(`${kind}.json`, directory), JSON.stringify(data));
console.log(JSON.stringify({ kind, elements: data.elements.length, timestamp: data.osm3s?.timestamp_osm_base, bytes: JSON.stringify(data).length }));
