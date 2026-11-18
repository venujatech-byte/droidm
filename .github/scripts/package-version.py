"""Keep the application and lockfile versions aligned for CI packages."""

import re
import sys
from pathlib import Path


def set_version(root, version):
    # WiX MSI limits the third version component to 65535.
    if not re.fullmatch(r"0\.0\.[1-9][0-9]*", version) or int(version.rsplit('.', 1)[1]) > 65535:
        raise ValueError("Expected 0.0.N with N between 1 and 65535")
    replacements = {
        "Cargo.toml": r'(\[package\]\s+name = "droidm"\s+version = ")[^"]+',
        "Cargo.lock": r'(\[\[package\]\]\s+name = "droidm"\s+version = ")[^"]+',
        "tauri.conf.json": r'("version"\s*:\s*")[^"]+',
    }
    updates = {}
    for name, pattern in replacements.items():
        path = root / name
        updated, count = re.subn(pattern, lambda match: match[1] + version, path.read_text())
        if count != 1:
            raise ValueError(f"Expected one application version in {name}, found {count}")
        updates[path] = updated
    for path, updated in updates.items():
        path.write_text(updated)


if __name__ == "__main__":
    set_version(Path.cwd(), sys.argv[1])
