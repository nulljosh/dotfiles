#!/usr/bin/env python3
"""Read Product Hunt launch data without browser automation."""

import argparse
import html
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path.home() / "Documents/Code"
MAKER = "nulljosh1"
PRODUCT_URL = re.compile(r"https://www\.producthunt\.com/products/[a-z0-9-]+", re.I)
QUERY = """query($after: String) { viewer { user { username madePosts(first: 50, after: $after) { edges { node { id name slug tagline description url website votesCount commentsCount reviewsCount reviewsRating dailyRank createdAt featuredAt scheduledAt } } pageInfo { hasNextPage endCursor } } } } }"""


def token():
    value = os.environ.get("PRODUCTHUNT_TOKEN")
    if value:
        return value
    result = subprocess.run(
        ["security", "find-generic-password", "-s", "producthunt-api", "-w"],
        capture_output=True, text=True, check=False,
    )
    return result.stdout.strip() if result.returncode == 0 else None


def request(url, payload=None, bearer=None):
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if bearer:
        headers["Authorization"] = "Bearer " + bearer
    req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def api_list(bearer):
    posts = []
    cursor = None
    username = None
    while True:
        result = json.loads(request("https://api.producthunt.com/v2/api/graphql", {"query": QUERY, "variables": {"after": cursor}}, bearer))
        if result.get("errors"):
            raise RuntimeError(str(result["errors"]))
        user = result["data"]["viewer"]["user"]
        username = user["username"]
        connection = user["madePosts"]
        posts.extend(edge["node"] for edge in connection["edges"])
        if not connection["pageInfo"]["hasNextPage"]:
            break
        cursor = connection["pageInfo"]["endCursor"]
        if not cursor:
            raise RuntimeError("API reported another page without a cursor")
    return {"source": "Product Hunt API", "username": username, "posts": posts, "scope": "madePosts; claimed product pages without a launch may be absent"}


def meta(markup, name):
    match = re.search(r'<meta\b[^>]*(?:property|name)=["\']' + re.escape(name) + r'["\'][^>]*>', markup, re.I)
    if not match:
        return None
    value = re.search(r'content=["\']([^"\']*)["\']', match.group(), re.I)
    return html.unescape(value.group(1)) if value else None


def public_page(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "www.producthunt.com" or not parsed.path.startswith("/products/"):
        raise ValueError("Expected a https://www.producthunt.com/products/... URL")
    result = subprocess.run(["curl", "-fLsS", "--max-time", "20", url], capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "Product Hunt page fetch failed")
    markup = result.stdout
    maker_usernames = sorted(set(re.findall(r'"makers":\[.*?"username":"([^"]+)"', markup)))
    return {"url": url, "title": meta(markup, "og:title"), "description": meta(markup, "og:description"),
            "maker_verified": MAKER in maker_usernames, "maker_usernames": maker_usernames}


def public_list():
    urls = set()
    for path in ROOT.glob("*/launch/producthunt.md"):
        urls.update(PRODUCT_URL.findall(path.read_text(errors="replace")))
    posts = []
    for url in sorted(urls):
        try:
            page = public_page(url)
            if page["maker_verified"]:
                posts.append(page)
        except (urllib.error.URLError, RuntimeError, ValueError) as error:
            posts.append({"url": url, "error": str(error), "maker_verified": False})
    return {"source": "known repo links + public product pages", "posts": posts,
            "complete": False, "note": "Only linked products can be found without an API token."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["list", "page", "prepare"])
    parser.add_argument("url", nargs="?")
    args = parser.parse_args()
    try:
        if args.command == "list":
            result = api_list(token()) if token() else public_list()
        elif args.command == "page":
            if not args.url:
                parser.error("page requires a Product Hunt product URL")
            result = public_page(args.url)
        else:
            if not args.url or not re.fullmatch(r"[a-zA-Z0-9_-]+", args.url):
                parser.error("prepare requires an app directory name")
            kit = ROOT / args.url / "launch/producthunt.md"
            if not kit.is_file():
                parser.error(f"No launch kit: {kit}")
            text = kit.read_text()
            fields = {}
            for line in text.splitlines():
                match = re.match(r"^(Name|Tagline(?: \(\d+\))?|Description(?: \(\d+\))?|Topics|Pricing|Web|App Store|GitHub|Post):\s*(.*)$", line)
                if match:
                    fields[re.sub(r" \(\d+\)$", "", match.group(1))] = match.group(2)
            fields["First comment"] = text.split("## First comment", 1)[1].split("\nPost:", 1)[0].strip() if "## First comment" in text else ""
            fields["Gallery"] = [str(path) for path in sorted((kit.parent / "gallery").glob("*")) if path.is_file()]
            subprocess.run(["open", "-a", "Google Chrome", "https://www.producthunt.com/posts/new"], check=False)
            result = {"app": args.url, "kit": str(kit), "form": fields,
                      "note": "Opened the normal Chrome profile. Enter these fields and review before submitting."}
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (urllib.error.URLError, RuntimeError, ValueError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
