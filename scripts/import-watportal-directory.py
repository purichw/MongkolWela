"""Cache Watportal's public directory facts without copying articles or photos."""
import argparse
import json
import time
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs

import requests

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www.watportal.com"
CACHE = ROOT / "artifacts/directory-places/watportal"
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class Element:
    def __init__(self, tag="root", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def walk(self, tag=None, cls=None):
        if (tag is None or self.tag == tag) and (cls is None or cls in self.attrs.get("class", "").split()):
            yield self
        for child in self.children:
            if isinstance(child, Element):
                yield from child.walk(tag, cls)

    def text(self):
        return " ".join(" ".join(c.text() if isinstance(c, Element) else c for c in self.children).split())


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Element()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                self.stack = self.stack[:index]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def listing(html):
    records = []
    for card in Document(html).root.walk(cls="infocard"):
        title = next(card.walk(cls="detail-title"), None)
        link = next(title.walk(tag="a"), None) if title else None
        if link is None:
            raise ValueError("Directory card missing its title link")
        url = urljoin(BASE, link.attrs["href"])
        parts = urlparse(url).path.split("/")
        if "iid" not in parts or not parts[-1].isdigit():
            raise ValueError(f"Unexpected detail URL: {url}")
        address = next(card.walk(cls="detail-address"), Element()).text()
        district, _, province = address.rpartition(",")
        records.append({"id": parts[-1], "name": link.text(), "url": url,
                        "district": district.strip(), "province": province.strip(),
                        "listingAddress": address})
    return records


def detail(html):
    document = Document(html).root
    # Preserve every labelled factual field, including categories not known today.
    fields = {}
    for node in document.walk(cls="detail-topic"):
        fields[node.text()] = ""  # Older layouts are handled by sibling rows below.
    for node in document.walk():
        children = [child for child in node.children if isinstance(child, Element)]
        if len(children) != 2:
            continue
        label = children[0].text().strip()
        if label.endswith(":") and len(label) < 70:
            value = children[1].text()
            if value and len(value) <= 2000:
                fields[label.removesuffix(":").strip()] = value
    coordinates = None
    for frame in document.walk(tag="iframe"):
        url = urlparse(frame.attrs.get("src", ""))
        if url.hostname not in {"www.google.com", "maps.google.com"}:
            continue
        value = parse_qs(url.query).get("q", [""])[0].split(",")
        try:
            lat, lng = map(float, value)
            if 5.5 <= lat <= 20.5 and 97.3 <= lng <= 105.7:
                coordinates = {"latitude": lat, "longitude": lng}
        except (ValueError, TypeError):
            pass
    return {"fields": fields, "coordinates": coordinates}


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf8")


def read(path):
    return json.loads(path.read_text(encoding="utf8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=0, help="Maximum new pages this run; zero means all")
    parser.add_argument("--details", nargs="*", help="Fetch detail IDs already present in the index")
    parser.add_argument("--categories", nargs="+", type=int, choices=[1, 2, 3, 4, 5], help="Cache the public category filters")
    args = parser.parse_args()
    session = requests.Session()
    session.headers.update({"User-Agent": "MongkolWelaDirectoryResearch/1.0 (+https://mongkolwela.vercel.app/contact/)"})
    last_request = 0

    def request(url, **kwargs):
        nonlocal last_request
        time.sleep(max(0, 1 - (time.monotonic() - last_request)))
        last_request = time.monotonic()
        response = session.request(url=url, timeout=45, **kwargs)
        response.raise_for_status()  # Stop on errors; never skip a failed page.
        return response

    if args.categories:
        labels = {1: "พระอารามหลวง", 2: "วัดราษฎร์", 3: "วัดร้าง", 4: "วัดเพื่อการท่องเที่ยว", 5: "วิปัสนากรรมฐาน"}
        for category in args.categories:
            target = CACHE / "categories" / f"{category}.json"
            if target.exists():
                continue
            records, page, total_pages, total = [], 1, 1, None
            while page <= total_pages:
                payload = request(f"{BASE}/th/wat/search/getwats", method="POST",
                                  headers={"x-requested-with": "XMLHttpRequest"},
                                  data={"pageIndex": page, "q": "", "region": 0, "province": 0, "type": category}).json()
                if int(payload["pageIndex"]) != page or (total is not None and int(payload["total"]) != total):
                    raise ValueError("Category pagination changed; discard this incomplete run")
                total, total_pages = int(payload["total"]), int(payload["totalPage"])
                records.extend(listing(payload["html"]))
                page += 1
            unique = {row["id"]: row for row in records}
            complete = len(records) == total and len(unique) == total
            # A duplicated result can still evidence that specific place's
            # category, but never establishes complete category coverage.
            duplicates = sorted(key for key, count in Counter(row["id"] for row in records).items() if count > 1)
            save(target, {"category": labels[category], "filter": category, "total": total,
                          "url": f"{BASE}/th/wat/search/getwats", "method": "POST",
                          "retrievedAt": datetime.now(timezone.utc).isoformat(), "records": list(unique.values()),
                          "complete": complete, "rowsRead": len(records), "duplicateIds": duplicates})
            print(f"category {category} ({labels[category]}): {len(unique)}/{total} unique; rows={len(records)}; duplicates={duplicates}; complete={complete}", flush=True)
        return

    if args.details is not None:
        if (CACHE / "index.json").exists():
            index = read(CACHE / "index.json")
        elif args.details:
            index = {"records": [record for page in sorted((CACHE / "pages").glob("*.json")) for record in read(page)["records"]]}
        else:
            raise ValueError("Complete the index before requesting every detail")
        wanted = set(args.details)
        missing = wanted - {record["id"] for record in index["records"]}
        if missing:
            raise ValueError(f"Detail IDs must come from the public listing: {sorted(missing)}")
        for record in index["records"]:
            if wanted and record["id"] not in wanted:
                continue
            target = CACHE / "details" / f'{record["id"]}.json'
            if target.exists():
                continue
            result = detail(request(record["url"], method="GET").text)
            save(target, {**record, **result, "retrievedAt": datetime.now(timezone.utc).isoformat()})
            print(f'detail {record["id"]}: {len(result["fields"])} fields; coordinates={bool(result["coordinates"])}', flush=True)
        return

    page, total_pages, total, fetched = 1, 1, None, 0
    records, seen = [], set()
    while page <= total_pages:
        target = CACHE / "pages" / f"{page:04d}.json"
        if target.exists():
            data = read(target)
        else:
            if args.pages and fetched >= args.pages:
                break
            response = request(f"{BASE}/th/wat/search/getwats", method="POST",
                               headers={"x-requested-with": "XMLHttpRequest"},
                               data={"pageIndex": str(page), "q": "", "region": "0", "province": "0", "type": "0"})
            payload = response.json()
            data = {"page": int(payload["pageIndex"]), "total": int(payload["total"]),
                    "totalPages": int(payload["totalPage"]), "records": listing(payload["html"]),
                    "retrievedAt": datetime.now(timezone.utc).isoformat()}
            if data["page"] != page or not data["records"]:
                raise ValueError(f"Invalid/empty page {page}")
            save(target, data)
            fetched += 1
        if total is not None and data["total"] != total:
            raise ValueError("Source total changed during crawl; reconcile before deleting anything")
        total, total_pages = data["total"], data["totalPages"]
        for record in data["records"]:
            if record["id"] in seen:
                raise ValueError(f'Duplicate ID across pages: {record["id"]}; source ordering may have changed')
            seen.add(record["id"])
            records.append(record)
        if page % 100 == 0 or page == total_pages:
            print(f"Watportal {page}/{total_pages} pages; {len(records)}/{total} records", flush=True)
        page += 1
    complete = page > total_pages and len(records) == total
    result = {"source": BASE, "total": total, "pagesRead": page - 1, "totalPages": total_pages,
              "complete": complete, "records": records,
              "policy": "Source-listed facts only; not proof of current opening or map accuracy. No articles/photos copied."}
    save(CACHE / ("index.json" if complete else "index.partial.json"), result)
    print(json.dumps({key: value for key, value in result.items() if key != "records"}, ensure_ascii=False), flush=True)
    if not complete and not args.pages:
        raise ValueError("Index incomplete; do not use absence as evidence for deletion")


if __name__ == "__main__":
    main()
