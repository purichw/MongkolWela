"""Import a cached Geofabrik Thailand PBF using real OSM geometries.

Maintenance only. Requires osmium==4.3.1 and shapely==2.1.2 in a project-local
environment. No geocoding, network calls, or changes to existing temple data.
"""
import collections
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import unicodedata

import osmium
from shapely import Point, STRtree, from_wkb

ROOT = Path(__file__).resolve().parent.parent
REGIONS = json.loads((ROOT / "src/data/thailand-regions.json").read_text())
PROVINCES = {name: region for region, names in REGIONS.items() for name in names}
GEOMETRY = osmium.geom.WKBFactory()


def name_key(value):
    return re.sub(r"[\s\W_]+", "", unicodedata.normalize("NFC", value).lower())


def candidate(tags):
    return tags.get("religion") == "buddhist" and tags.get("amenity") in ("place_of_worship", "monastery")


def record(obj, kind, point, tags):
    return {"id": f"{kind}/{obj.orig_id() if kind != 'node' else obj.id}",
            "name": tags.get("name:th") or tags.get("name", ""),
            "latitude": round(point.y, 7), "longitude": round(point.x, 7),
            "timestamp": str(obj.timestamp), "version": obj.version, "tags": tags}


class Extract(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.places = []
        self.provinces = []
        self.errors = []

    def node(self, obj):
        if not candidate(obj.tags):
            return
        if not obj.location.valid():
            self.errors.append({"id": f"node/{obj.id}", "reason": "invalid-location"})
            return
        self.places.append(record(obj, "node", Point(obj.location.lon, obj.location.lat), dict(obj.tags)))

    def area(self, obj):
        province = obj.tags.get("boundary") == "administrative" and obj.tags.get("admin_level") == "4" and obj.tags.get("ISO3166-2", "").startswith("TH-")
        if not province and not candidate(obj.tags):
            return
        tags = dict(obj.tags)
        kind = "way" if obj.from_way() else "relation"
        try:
            shape = from_wkb(GEOMETRY.create_multipolygon(obj))
            if not shape.is_valid or shape.is_empty:
                raise ValueError("invalid polygon")
        except Exception as error:
            self.errors.append({"id": f"{kind}/{obj.orig_id()}", "reason": "invalid-geometry", "error": str(error)})
            return
        if province:
            name = (tags.get("name:th") or tags.get("name", "")).removeprefix("จังหวัด")
            self.provinces.append({"name": name, "id": f"{kind}/{obj.orig_id()}", "shape": shape})
        else:
            # An interior point stays within the footprint, unlike bbox centres.
            self.places.append(record(obj, kind, shape.representative_point(), tags))


def main():
    source = Path(sys.argv[1]).resolve()
    if not source.is_relative_to(ROOT):
        raise ValueError("Keep the source snapshot inside this project")
    reader = osmium.io.Reader(str(source))
    timestamp = reader.header().get("osmosis_replication_timestamp")
    reader.close()
    extract = Extract()
    extract.apply_file(str(source), locations=True, idx="flex_mem")
    boundary_names = {row["name"] for row in extract.provinces}
    missing = set(PROVINCES) - boundary_names
    if missing or len(extract.provinces) != 77:
        raise ValueError(f"Incomplete provincial boundaries: {len(extract.provinces)}, missing {sorted(missing)}, extra {sorted(boundary_names - set(PROVINCES))}")
    tree = STRtree([row["shape"] for row in extract.provinces])
    decisions = list(extract.errors)
    accepted = []
    by_name = collections.defaultdict(list)
    generic = {name_key(value) for value in ["วัด", "อุโบสถ", "โบสถ์", "วิหาร", "ศาลา", "เจดีย์", "พระพุทธรูป", "Buddhist temple", "Temple", "Buddhist Monastery", "Wat"]}
    # Stable preference: a relation/footprint before a duplicate isolated node.
    for row in sorted(extract.places, key=lambda row: (row["id"].startswith("node/"), row["id"])):
        tags, name = row["tags"], row["name"].strip()
        reason = ""
        if not name or name_key(name) in generic:
            reason = "unnamed-or-generic"
        if any(tags.get(key) not in (None, "no", "false", "0") for key in ["abandoned", "disused", "demolished", "destroyed", "ruins", "construction"]) or any(key.startswith(("abandoned:", "disused:", "demolished:", "destroyed:", "construction:")) for key in tags):
            reason = "inactive-or-ruins"
        if tags.get("access") in ("private", "no"):
            reason = "restricted-access"
        if re.search(r"ร้าง|\b(?:ruins?|abandoned|disused)\b", name, re.I):
            reason = "inactive-name"
        point = Point(row["longitude"], row["latitude"])
        boundaries = tree.query(point, predicate="covered_by")
        if len(boundaries) != 1:
            reason = "outside-or-ambiguous-province"
        if reason:
            decisions.append({"id": row["id"], "name": name, "reason": reason})
            continue
        province = extract.provinces[boundaries[0]]["name"]
        aliases = {name_key(value) for key, value in tags.items() if key in ("name", "name:th", "name:en", "official_name", "alt_name")}
        duplicate = None
        for alias in aliases:
            for other in by_name[(province, alias)]:
                dy = (other["latitude"] - row["latitude"]) * 111_195
                dx = (other["longitude"] - row["longitude"]) * 111_195 * math.cos(math.radians(row["latitude"]))
                if math.hypot(dx, dy) < 200:
                    duplicate = other
                    break
            if duplicate:
                break
        if duplicate:
            duplicate["duplicates"].append(row["id"])
            decisions.append({"id": row["id"], "name": name, "reason": "same-name-within-200m", "kept": duplicate["id"]})
            continue
        row.update(name=name, province=province, region=PROVINCES[province], provinceBoundary=extract.provinces[boundaries[0]]["id"], duplicates=[])
        accepted.append(row)
        for alias in aliases:
            by_name[(province, alias)].append(row)
    counts = collections.Counter(row["province"] for row in accepted)
    if set(counts) != set(PROVINCES) or len(accepted) < 1000:
        raise ValueError(f"Coverage gate failed: {len(accepted)} places, {len(counts)} provinces")
    output = ROOT / "artifacts/directory-places/osm/extracted.json"
    payload = {"meta": {"source": "https://download.geofabrik.de/asia/" + source.name,
        "sourceTimestamp": timestamp, "sourceSha256": hashlib.file_digest(source.open("rb"), "sha256").hexdigest(),
        "license": "ODbL-1.0", "attribution": "OpenStreetMap contributors", "provinceCount": len(counts), "placeCount": len(accepted),
        "candidateCount": len(extract.places), "countsByProvince": dict(sorted(counts.items())),
        "decisionsByReason": dict(collections.Counter(row["reason"] for row in decisions))}, "places": accepted, "decisions": decisions}
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
