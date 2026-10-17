#!/usr/bin/env python3
"""Keep sw.js's CACHE_NAME in sync with the actual contents of the files it
caches, so a deploy can never silently ship stale service-worker caching
while the CACHE_NAME is forgotten.

Previously CACHE_NAME was a hand-maintained string ('v1', 'v2', ...) that
had to be bumped by hand every time a cached file changed — and that step
was once forgotten, shipping a stale cached app shell. This script removes
the human step entirely: CACHE_NAME is derived from a hash of the exact
files listed in sw.js's own APP_SHELL array, so it only ever changes when
one of those files actually changes, and it can never be forgotten.

Run directly (`python3 scripts/update_sw_cache_version.py`), or via the
pre-commit hook in .githooks/pre-commit, which runs this automatically and
stages the result before every commit.

No third-party dependencies — stdlib only, consistent with
scripts/generate_icons.py.
"""
import hashlib
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SW_PATH = REPO_ROOT / 'sw.js'
CACHE_NAME_PREFIX = 'mvf-food-journal-'
HASH_LENGTH = 12


def extract_app_shell(sw_source):
    match = re.search(r'const APP_SHELL = \[(.*?)\];', sw_source, re.DOTALL)
    if not match:
        raise SystemExit('Could not find an APP_SHELL array in sw.js')
    paths = re.findall(r"'([^']+)'", match.group(1))
    return paths


def compute_hash(paths):
    digest = hashlib.sha256()
    for raw_path in paths:
        rel_path = raw_path.lstrip('./')
        if not rel_path:
            continue  # './' is the directory index, already covered by index.html
        file_path = REPO_ROOT / rel_path
        if not file_path.is_file():
            raise SystemExit(f'sw.js APP_SHELL references a missing file: {raw_path}')
        digest.update(rel_path.encode('utf-8'))
        digest.update(file_path.read_bytes())
    return digest.hexdigest()[:HASH_LENGTH]


def main():
    sw_source = SW_PATH.read_text()
    app_shell = extract_app_shell(sw_source)
    new_hash = compute_hash(app_shell)
    new_cache_name = f'{CACHE_NAME_PREFIX}{new_hash}'

    cache_name_pattern = re.compile(r"const CACHE_NAME = '([^']*)';")
    current_match = cache_name_pattern.search(sw_source)
    if not current_match:
        raise SystemExit('Could not find CACHE_NAME in sw.js')
    current_cache_name = current_match.group(1)

    if current_cache_name == new_cache_name:
        print(f'sw.js CACHE_NAME already up to date ({new_cache_name})')
        return 0

    updated_source = cache_name_pattern.sub(
        f"const CACHE_NAME = '{new_cache_name}';", sw_source, count=1,
    )
    SW_PATH.write_text(updated_source)
    print(f'sw.js CACHE_NAME updated: {current_cache_name} -> {new_cache_name}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
