from collections import Counter
import json
from pathlib import Path
import numpy as np

snapshot = json.loads(Path("content/metrics.snapshot.json").read_text())
repositories = Counter(p["repo"] for p in snapshot["mergedPrs"]["ledger"]).most_common()


def shore(xs, y, axis, half):
    margin = np.abs(xs-axis)-half
    for i, (_, count) in enumerate(repositories):
        side = (-1)**i
        distance = side*(xs-axis)
        along = -2 + 4.3*i + .72*distance + .36*np.sin(.7*distance)
        channel = np.abs(y-along)/1.23 - max(.36, count*.20)
        margin = np.minimum(margin, np.maximum(-distance, channel))
    return margin


def subject(sawn):
    pass
