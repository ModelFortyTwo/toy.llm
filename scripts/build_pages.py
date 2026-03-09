#!/usr/bin/env python3

from __future__ import annotations

import html
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

EXCLUDED_DIRS = {
    ".git",
    ".github",
    ".venv",
    "__pycache__",
    "dist",
    "node_modules",
    "venv",
}
EXCLUDED_FILES = {
    ".DS_Store",
}


def is_excluded(path: Path) -> bool:
    return any(part.startswith(".") or part in EXCLUDED_DIRS for part in path.parts)


def ignore_entries(_: str, names: list[str]) -> set[str]:
    ignored: set[str] = set()
    for name in names:
        if name in EXCLUDED_FILES or name in EXCLUDED_DIRS or name.startswith("."):
            ignored.add(name)
    return ignored


def discover_html_files() -> list[Path]:
    html_files: list[Path] = []
    for path in ROOT.rglob("*.html"):
        if not path.is_file():
            continue
        relative_path = path.relative_to(ROOT)
        if is_excluded(relative_path):
            continue
        html_files.append(relative_path)
    return sorted(html_files)


def copy_publishable_content(html_files: list[Path]) -> None:
    publish_roots: set[Path] = set()
    for html_file in html_files:
        if len(html_file.parts) == 1:
            publish_roots.add(html_file)
        else:
            publish_roots.add(Path(html_file.parts[0]))

    for root in sorted(publish_roots):
        source = ROOT / root
        target = DIST / root
        if source.is_dir():
            shutil.copytree(source, target, dirs_exist_ok=True, ignore=ignore_entries)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def build_tree(paths: list[Path]) -> dict[str, object]:
    tree: dict[str, object] = {}
    for path in paths:
        node = tree
        for part in path.parts[:-1]:
            node = node.setdefault(part, {})  # type: ignore[assignment]
        node.setdefault("__files__", []).append(path.name)  # type: ignore[union-attr]
    return tree


def render_tree(node: dict[str, object], parent_parts: tuple[str, ...] = ()) -> str:
    items: list[str] = []

    directories = sorted(key for key in node.keys() if key != "__files__")
    for directory in directories:
        child = node[directory]
        items.append(
            "<li class='group'>"
            f"<details open><summary>{html.escape(directory)}</summary>"
            f"{render_tree(child, parent_parts + (directory,))}"
            "</details>"
            "</li>"
        )

    for filename in sorted(node.get("__files__", [])):  # type: ignore[arg-type]
        href = "/".join((*parent_parts, filename))
        items.append(
            "<li class='file'>"
            f"<a href='{html.escape(href)}'>{html.escape(filename)}</a>"
            f"<code>{html.escape(href)}</code>"
            "</li>"
        )

    return f"<ul>{''.join(items)}</ul>"


def build_index(html_files: list[Path]) -> str:
    tree = build_tree(html_files)
    tree_markup = render_tree(tree)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TOY Benchmark Examples</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5efe3;
      --panel: rgba(255, 252, 247, 0.88);
      --panel-border: rgba(55, 42, 27, 0.14);
      --ink: #23180c;
      --muted: #6f6252;
      --accent: #9b4d24;
      --accent-soft: #efe0cb;
      --shadow: rgba(63, 44, 20, 0.12);
    }}

    * {{
      box-sizing: border-box;
    }}

    body {{
      margin: 0;
      min-height: 100vh;
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.72), transparent 30%),
        linear-gradient(135deg, #f9f3e8 0%, #ecd7b3 50%, #d5b08a 100%);
    }}

    main {{
      width: min(960px, calc(100% - 32px));
      margin: 32px auto;
      padding: 32px;
      border: 1px solid var(--panel-border);
      border-radius: 28px;
      background: var(--panel);
      box-shadow: 0 24px 60px var(--shadow);
      backdrop-filter: blur(12px);
    }}

    h1 {{
      margin: 0 0 12px;
      font-size: clamp(2rem, 4vw, 3.5rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
    }}

    p {{
      margin: 0;
      max-width: 62ch;
      font-size: 1.05rem;
      color: var(--muted);
    }}

    .meta {{
      margin-top: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }}

    .chip {{
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 0.92rem;
      font-weight: 600;
    }}

    .tree {{
      margin-top: 28px;
      padding: 24px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid rgba(55, 42, 27, 0.08);
    }}

    ul {{
      margin: 10px 0 0 18px;
      padding: 0;
    }}

    li {{
      margin: 10px 0;
    }}

    summary {{
      cursor: pointer;
      font-weight: 700;
      color: var(--accent);
    }}

    .file {{
      display: grid;
      gap: 4px;
      list-style: square;
    }}

    a {{
      color: var(--ink);
      font-weight: 700;
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.16em;
    }}

    a:hover {{
      color: var(--accent);
    }}

    code {{
      width: fit-content;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(155, 77, 36, 0.08);
      color: var(--muted);
      font-size: 0.86rem;
    }}

    @media (max-width: 640px) {{
      main {{
        width: min(100% - 20px, 960px);
        margin: 10px auto;
        padding: 22px 18px;
        border-radius: 20px;
      }}

      .tree {{
        padding: 18px;
      }}
    }}
  </style>
</head>
<body>
  <main>
    <h1>TOY Benchmark Examples</h1>
    <p>
      Static GitHub Pages index generated from every HTML example in this repository.
      Links are grouped by the repository folder structure so the published site stays aligned with the source tree.
    </p>
    <div class="meta">
      <span class="chip">{len(html_files)} HTML files published</span>
      <a class="chip" href="https://github.com/ModelFortyTwo/toy.llm">View repository</a>
    </div>
    <section class="tree">
      {tree_markup}
    </section>
  </main>
</body>
</html>
"""


def main() -> None:
    html_files = discover_html_files()
    if not html_files:
        raise SystemExit("No HTML files found to publish.")

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    copy_publishable_content(html_files)
    (DIST / "index.html").write_text(build_index(html_files), encoding="utf-8")
    (DIST / ".nojekyll").write_text("", encoding="utf-8")


if __name__ == "__main__":
    main()
