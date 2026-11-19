#!/usr/bin/env python3
"""在构建/部署时生成 Service Worker 的预缓存清单（含内容哈希）。不要手改 PRECACHE。"""
import base64, hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"
SHELL = [
    "index.html",
    "app.css",
    "manifest.webmanifest",
    "data/library.json",
]
SKIP_NAMES = {"sw.js"}


def _ci_order(path):
    # Linux compares path parts with case intact. Windows folds case, which
    # reorders LICENCE/README.md and makes CI reject the committed manifest.
    return tuple(path.as_posix().split("/"))


def collect(root=ROOT):
    files = []
    def add(rel):
        rel = rel.replace("\\", "/")
        if rel in SKIP_NAMES or rel in files:
            return
        if (root / rel).is_file():
            files.append(rel)
    for rel in SHELL:
        if not (root / rel).is_file():
            raise FileNotFoundError(f"required shell asset: {rel}")
        add(rel)
    icons = root / "icons"
    if icons.is_dir():
        for p in sorted(icons.rglob("*"), key=_ci_order):
            if p.is_file():
                add(str(p.relative_to(root)))
    src = root / "src"
    if src.is_dir():
        for p in sorted(src.rglob("*.js"), key=_ci_order):
            add(str(p.relative_to(root)))
    vendor = root / "vendor"
    if vendor.is_dir():
        for p in sorted(vendor.rglob("*"), key=_ci_order):
            if p.is_file():
                add(str(p.relative_to(root)))
    return files


# The worker remains the canonical logic source. Only this block is generated.
BLOCK = re.compile(r"const PRECACHE = \{.*?\};", re.S)


def render(root, source):
    source = source.replace("\r\n", "\n")
    if len(BLOCK.findall(source)) != 1:
        raise ValueError("expected exactly one generated PRECACHE block")
    logic = BLOCK.sub("const PRECACHE = null;", source)
    files = collect(root)
    integrity = {}
    for rel in files:
        digest = hashlib.sha256((root / rel).read_bytes()).digest()
        integrity["./" + rel] = "sha256-" + base64.b64encode(digest).decode("ascii")
    integrity = {"./": integrity["./index.html"], **integrity}
    # Logic-only changes need a separate cache too: never overwrite an active worker's shell.
    payload = logic + "\0" + json.dumps(integrity, ensure_ascii=False, sort_keys=True)
    version = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
    manifest = {"version": version, "files": list(integrity), "integrity": integrity}
    block = "const PRECACHE = " + json.dumps(manifest, ensure_ascii=False, indent=2) + ";"
    return BLOCK.sub(lambda _: block, source), manifest


def build(root=ROOT):
    sw = root / "sw.js"
    source = sw.read_bytes().decode("utf-8").replace("\r\n", "\n")
    generated, manifest = render(root, source)
    generated_bytes = generated.replace("\r\n", "\n").encode("utf-8")
    if sw.read_bytes() != generated_bytes:
        sw.write_bytes(generated_bytes)
    return manifest


def main():
    manifest = build()
    print(f"precache {len(manifest['files'])} urls, version {manifest['version']}")


if __name__ == "__main__":
    main()
