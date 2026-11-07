#!/usr/bin/env python3
"""Dependency-free smoke checks for the static GARAGE 78 site."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_FILE = ROOT / "index.html"
ERRORS: list[str] = []


class SiteParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.anchors: list[str] = []
        self.local_assets: list[str] = []
        self.images_without_alt: list[str] = []
        self.title = False
        self.description = False
        self.language = False
        self.tags: dict[str, int] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        self.tags[tag] = self.tags.get(tag, 0) + 1

        element_id = attrs_map.get("id")
        if element_id:
            if element_id in self.ids:
                ERRORS.append(f"Duplicate id: {element_id}")
            self.ids.add(element_id)

        if tag == "html" and attrs_map.get("lang") == "ru":
            self.language = True
        if tag == "title":
            self.title = True
        if tag == "meta" and attrs_map.get("name", "").lower() == "description":
            self.description = bool(attrs_map.get("content", "").strip())
        if tag == "img" and attrs_map.get("alt") is None:
            self.images_without_alt.append(attrs_map.get("src", "(unknown image)"))

        href = attrs_map.get("href", "")
        if href.startswith("#") and len(href) > 1:
            self.anchors.append(href[1:])

        for attribute in ("src", "href"):
            value = attrs_map.get(attribute)
            if not value:
                continue
            parsed = urlparse(value)
            if parsed.scheme or parsed.netloc or value.startswith("#"):
                continue
            path = unquote(parsed.path)
            if path:
                self.local_assets.append(path)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)


def fail(message: str) -> None:
    ERRORS.append(message)


if not HTML_FILE.exists():
    fail("index.html is missing")
else:
    html = HTML_FILE.read_text(encoding="utf-8")
    parser = SiteParser()
    parser.feed(html)
    parser.close()

    if not html.lstrip().lower().startswith("<!doctype html>"):
        fail("HTML5 doctype is missing")
    if not parser.language:
        fail('The document must declare lang="ru"')
    if not parser.title:
        fail("Page title is missing")
    if not parser.description:
        fail("Meta description is missing")
    if parser.images_without_alt:
        fail("Images without alt text: " + ", ".join(parser.images_without_alt))

    for target in parser.anchors:
        if target not in parser.ids:
            fail(f"Broken in-page anchor: #{target}")

    for asset in parser.local_assets:
        candidate = (ROOT / asset).resolve()
        if not candidate.is_relative_to(ROOT.resolve()):
            fail(f"Asset path escapes project root: {asset}")
        elif not candidate.is_file():
            fail(f"Missing local asset: {asset}")

    if parser.tags.get("main", 0) != 1:
        fail("The page must have exactly one <main> element")
    if parser.tags.get("h1", 0) != 1:
        fail("The page must have exactly one primary <h1> heading")
    if parser.tags.get("form", 0) < 1:
        fail("Booking form is missing")

css_file = ROOT / "assets/css/style.css"
js_file = ROOT / "assets/js/main.js"
config_file = ROOT / "assets/js/site-config.js"
worker_file = ROOT / "cloudflare/worker.js"

for required in (css_file, js_file, config_file, worker_file):
    if not required.is_file():
        fail(f"Required file is missing: {required.relative_to(ROOT)}")

if css_file.is_file():
    css = css_file.read_text(encoding="utf-8")
    if "@media" not in css:
        fail("Responsive CSS media queries are missing")
    if "prefers-reduced-motion" not in css:
        fail("Reduced-motion support is missing")

if config_file.is_file():
    config = config_file.read_text(encoding="utf-8")
    if "TELEGRAM_BOT_TOKEN" in config or "api.telegram.org/bot" in config:
        fail("A Telegram secret must never be stored in public site configuration")

if worker_file.is_file():
    worker = worker_file.read_text(encoding="utf-8")
    for required_fragment in (
        "ALLOWED_ORIGINS",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "Access-Control-Allow-Origin",
        "payload.website",
    ):
        if required_fragment not in worker:
            fail(f"Worker security / configuration check missing: {required_fragment}")

for required in (ROOT / "robots.txt", ROOT / "sitemap.xml", ROOT / "404.html", ROOT / ".nojekyll"):
    if not required.exists():
        fail(f"Publishing file is missing: {required.relative_to(ROOT)}")

if ERRORS:
    print("SITE CHECK FAILED")
    for error in ERRORS:
        print(" - " + error)
    sys.exit(1)

print("SITE CHECK PASSED")
print(f" - HTML document: {HTML_FILE.relative_to(ROOT)}")
print(f" - Unique IDs: {len(parser.ids)}")
print(f" - Internal anchors: {len(parser.anchors)}")
print(f" - Local asset references: {len(parser.local_assets)}")
print(" - Metadata, accessibility basics, responsive CSS, security config and publishing files: OK")
