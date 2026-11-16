#!/usr/bin/env python3
"""在构建/部署时生成 Service Worker 的预缓存清单（含内容哈希）。不要手改 PRECACHE。"""
import hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"
SW = ROOT / "sw.js"
SHELL = [
    "index.html",
    "app.js",
    "app.css",
    "merge.js",
    "studyday.js",
    "notes.js",
    "sync.js",
    "pwa.js",
    "manifest.webmanifest",
    "data/library.json",
]
SKIP_NAMES = {"sw.js"}


def collect():
    files = []
    def add(rel):
        rel = rel.replace("\\", "/")
        if rel in SKIP_NAMES or rel in files:
            return
        if (ROOT / rel).is_file():
            files.append(rel)
    for rel in SHELL:
        add(rel)
    icons = ROOT / "icons"
    if icons.is_dir():
        for p in sorted(icons.rglob("*")):
            if p.is_file():
                add(str(p.relative_to(ROOT)))
    vendor = ROOT / "vendor"
    if vendor.is_dir():
        for p in sorted(vendor.rglob("*")):
            if p.is_file():
                add(str(p.relative_to(ROOT)))
    return files


def version_for(files):
    h = hashlib.sha256()
    for rel in files:
        h.update(rel.encode())
        h.update(b"\0")
        h.update((ROOT / rel).read_bytes())
        h.update(b"\0")
    return h.hexdigest()[:12]


def main():
    files = collect()
    if not files:
        sys.exit("no shell files found under public/")
    ver = version_for(files)
    urls = ["./"] + ["./" + f for f in files]
    block = "const PRECACHE = " + json.dumps({"version": ver, "files": urls}, ensure_ascii=False, indent=2) + ";"
    text = SW.read_text(encoding="utf-8")
    new, n = re.subn(r"const PRECACHE = \{.*?\};", block, text, count=1, flags=re.S)
    if n != 1:
        sys.exit(f"expected exactly one PRECACHE block in {SW}, found {n}")
    if new != text:
        SW.write_text(new, encoding="utf-8")
    print(f"precache {len(urls)} urls, version {ver}")


if __name__ == "__main__":
    main()
