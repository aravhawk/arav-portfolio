"""Verify and restore the CC0 source cache used by the frozen lake."""
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.parse import quote, unquote

root = Path(__file__).resolve().parent
cache = Path.home() / ".t3/portfolio-redesign-v4/assets-src"

def checksum(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()

for asset in json.loads((root / "inputs.json").read_text()):
    dest = cache / asset["file"]
    if dest.exists() and checksum(dest) == asset["sha256"]:
        continue
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = asset["url"]
    if url.startswith("https://ambientcg.com/"):
        headers = subprocess.check_output(["curl", "-fsSI", url], text=True)
        location = next(line.split(":", 1)[1].strip() for line in headers.splitlines()
                        if line.lower().startswith("location:"))
        url = quote(unquote(location), safe=":/")
    tmp = dest.with_suffix(dest.suffix + ".part")
    subprocess.run(["curl", "-fsSL", "--retry", "2", url, "-o", str(tmp)], check=True)
    if checksum(tmp) != asset["sha256"]:
        raise ValueError(f"Checksum mismatch for {dest.name}")
    tmp.replace(dest)
