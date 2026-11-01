#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Print one version's section of CHANGELOG.md (used for the GitHub release notes).

  tools/changelog_section.py X.Y.Z [--changelog CHANGELOG.md] [--repo OWNER/NAME --ref SHA]

A section starts at a heading "## X.Y.Z" ("## [X.Y.Z]" and "## X.Y.Z - date" work too)
and ends at the next "## " heading. The heading itself is not printed.
With --repo and --ref, relative links become absolute GitHub links at that commit
(release notes are not shown next to the files, so relative links would break).
Hard-wrapped lines are joined (GitHub shows each newline of release notes as a
line break); --keep-wrap keeps them.
Exits 1, with a message on stderr, if there is no section for the version or it is empty.
"""
import argparse
import re
import sys

HEADING = re.compile(r"^##\s+\[?v?([0-9][^\]\s]*)\]?(?:\s.*)?$")
LINK = re.compile(r"(!?\[[^\]]*\]\()([^)\s]+)(\))")


def section(text, version):
    out, inside = [], False
    for line in text.splitlines():
        if line.startswith("## "):
            if inside:
                break
            m = HEADING.match(line)
            inside = bool(m) and m.group(1).lower() == version.lower()
            continue
        if inside:
            out.append(line)
    return "\n".join(out).strip("\n")


def absolute_links(text, repo, ref, changelog):
    base = f"https://github.com/{repo}"

    def fix(m):
        url = m.group(2)
        if re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I):
            return m.group(0)            # http:, mailto:...
        if url.startswith("#"):          # an anchor in the changelog itself
            return m.group(1) + f"{base}/blob/{ref}/{changelog}{url}" + m.group(3)
        if url.startswith("../../"):     # README-style links to the repo's own pages (issues, releases)
            return m.group(1) + f"{base}/{url[6:]}" + m.group(3)
        path = re.sub(r"^(\./)+", "", url)
        kind = "raw" if m.group(1).startswith("!") else "blob"
        return m.group(1) + f"{base}/{kind}/{ref}/{path}" + m.group(3)

    return LINK.sub(fix, text)


BLOCK_START = re.compile(r"^\s*([-*+]\s|\d+[.)]\s|#|>|\||```|<)")


def unwrap(text):
    """Join hard-wrapped lines: GitHub shows each newline of release notes as a line break."""
    out, fence = [], False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            fence = not fence
            out.append(line)
            continue
        joinable = (not fence and out and out[-1].strip() and line.strip()
                    and not BLOCK_START.match(line) and not out[-1].lstrip().startswith(("```", "|", "#")))
        if joinable:
            out[-1] = out[-1].rstrip() + " " + line.strip()
        else:
            out.append(line)
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("version")
    ap.add_argument("--changelog", default="CHANGELOG.md")
    ap.add_argument("--repo")
    ap.add_argument("--ref")
    ap.add_argument("--keep-wrap", action="store_true", help="keep the changelog's line breaks")
    a = ap.parse_args()
    try:
        text = open(a.changelog, encoding="utf-8").read()
    except OSError as e:
        sys.exit(f"{a.changelog}: {e.strerror}")
    body = section(text, a.version)
    if not body.strip():
        print(f"{a.changelog} has no '## {a.version}' section (or it is empty)", file=sys.stderr)
        sys.exit(1)
    if a.repo and a.ref:
        body = absolute_links(body, a.repo, a.ref, a.changelog)
    if not a.keep_wrap:
        body = unwrap(body)
    print(body)


if __name__ == "__main__":
    main()
