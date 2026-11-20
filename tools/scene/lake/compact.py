"""Optimize the lake's gzip streams offline without changing their decoded bytes."""
import gzip
import json
from pathlib import Path

import zopfli.gzip

root = Path(__file__).resolve().parents[3]
lake = root / "public/scene/lake"
ledger = root / "src/scene/flight/lake-assets.json"
sizes = json.loads(ledger.read_text())
for name in sizes:
    path = lake / name
    if name.endswith(".gz"):
        original = path.read_bytes()
        decoded = gzip.decompress(original)
        packed = zopfli.gzip.compress(decoded, numiterations=25)
        if gzip.decompress(packed) != decoded:
            raise ValueError(f"Lossless verification failed for {name}")
        if len(packed) < len(original):
            path.write_bytes(packed)
    sizes[name] = path.stat().st_size
ledger.write_text(json.dumps(sizes, indent=2) + "\n")
