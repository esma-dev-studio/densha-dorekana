"""Download reusable Wikimedia Commons thumbnails and generate credit metadata."""

from __future__ import annotations

import html
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

import certifi
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "image-manifest.json"
IMAGE_DIR = ROOT / "public" / "images"
CREDIT_FILE = ROOT / "src" / "data" / "imageCredits.js"
API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "DenshaDorekana/1.0 (https://github.com/esma-dev-studio; educational image attribution fetcher)"
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
ALLOWED_LICENSE_MARKERS = ("cc by", "cc0", "public domain", "pdm")
PENALTY_WORDS = (
    "interior", "seat", "logo", "map", "diagram", "drawing", "model",
    "cab", "plate", "destination", "headmark", "display", "museum",
)


def strip_html(value: str | None) -> str:
    if not value:
        return ""
    clean = re.sub(r"<[^>]+>", " ", value)
    return " ".join(html.unescape(clean).split())


def api_json(params: dict[str, str | int]) -> dict:
    query = urllib.parse.urlencode({"format": "json", "formatversion": 2, **params})
    request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
        return json.load(response)


def score_candidate(page: dict, query: str) -> float:
    info = page.get("imageinfo", [{}])[0]
    title = page.get("title", "").lower()
    width = info.get("width", 0)
    height = info.get("height", 1)
    ratio = width / max(height, 1)
    query_tokens = [token.lower() for token in re.findall(r"[A-Za-z0-9]+", query) if len(token) > 2]
    score = sum(4 for token in query_tokens if token in title)
    score += 5 if 1.2 <= ratio <= 2.4 else -4
    score += 3 if width >= 1600 else 0
    score -= sum(8 for word in PENALTY_WORDS if word in title)
    return score


def choose_candidate(query: str) -> dict | None:
    data = api_json({
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": 6,
        "gsrlimit": 14,
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": 1280,
    })
    candidates = []
    for page in data.get("query", {}).get("pages", []):
        info = page.get("imageinfo", [{}])[0]
        metadata = info.get("extmetadata", {})
        license_name = metadata.get("LicenseShortName", {}).get("value", "")
        mime = info.get("mime", "")
        if not mime.startswith("image/") or mime == "image/svg+xml":
            continue
        if not any(marker in license_name.lower() for marker in ALLOWED_LICENSE_MARKERS):
            continue
        if not info.get("thumburl"):
            continue
        candidates.append(page)
    return max(candidates, key=lambda page: score_candidate(page, query), default=None)


def download_webp(url: str, destination: Path) -> None:
    hostname = urllib.parse.urlparse(url).hostname or ""
    if hostname != "upload.wikimedia.org" and not hostname.endswith(".wikimedia.org"):
        raise RuntimeError(f"Unexpected image host: {hostname}")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60, context=SSL_CONTEXT) as response:
        raw = response.read()
    temp = destination.with_suffix(".source")
    temp.write_bytes(raw)
    try:
        with Image.open(temp) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((1280, 900), Image.Resampling.LANCZOS)
            image.save(destination, "WEBP", quality=82, method=6)
    finally:
        temp.unlink(missing_ok=True)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    credits: dict[str, dict[str, str | bool]] = {}
    if CREDIT_FILE.exists():
        existing_text = CREDIT_FILE.read_text(encoding="utf-8")
        try:
            credits = json.loads(existing_text.split("=", 1)[1])
        except (IndexError, json.JSONDecodeError):
            credits = {}
    failures: list[str] = []

    for index, item in enumerate(manifest, start=1):
        train_id = item["id"]
        query = item["query"]
        print(f"[{index:02}/{len(manifest)}] {train_id}: {query}", flush=True)
        output = IMAGE_DIR / f"{train_id}.webp"
        if output.exists() and credits.get(train_id, {}).get("license") != "プレースホルダー":
            print("  cached", flush=True)
            continue
        try:
            page = None
            for attempt in range(4):
                try:
                    page = choose_candidate(query)
                    break
                except urllib.error.HTTPError as error:
                    if error.code != 429 or attempt == 3:
                        raise
                    wait_seconds = 6 * (attempt + 1)
                    print(f"  rate limited; retrying in {wait_seconds}s", flush=True)
                    time.sleep(wait_seconds)
            if not page:
                raise RuntimeError("No reusable photo candidate found")
            info = page["imageinfo"][0]
            metadata = info.get("extmetadata", {})
            download_webp(info["thumburl"], output)
            credits[train_id] = {
                "author": strip_html(metadata.get("Artist", {}).get("value")) or "Wikimedia Commons contributor",
                "source": page.get("title", "").removeprefix("File:"),
                "license": strip_html(metadata.get("LicenseShortName", {}).get("value")) or "See source page",
                "licenseUrl": metadata.get("LicenseUrl", {}).get("value", ""),
                "sourceUrl": info.get("descriptionurl", ""),
                "localPath": f"./images/{train_id}.webp",
                "modified": True,
            }
        except Exception as error:  # keep the app usable with an honest fallback
            failures.append(train_id)
            credits[train_id] = {
                "author": "",
                "source": "実車写真を準備中",
                "license": "プレースホルダー",
                "licenseUrl": "",
                "sourceUrl": "",
                "localPath": "./images/placeholder.svg",
                "modified": False,
                "error": str(error),
            }
            print(f"  fallback: {error}", flush=True)
        time.sleep(2.0)

    module = "export const imageCredits = " + json.dumps(credits, ensure_ascii=False, indent=2) + "\n"
    CREDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    CREDIT_FILE.write_text(module, encoding="utf-8")
    print(f"Completed: {len(manifest) - len(failures)} photos, {len(failures)} placeholders")
    if failures:
        print("Placeholders:", ", ".join(failures))


if __name__ == "__main__":
    main()
