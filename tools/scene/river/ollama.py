import json
from pathlib import Path
import numpy as np

models = json.loads(Path("content/metrics.snapshot.json").read_text())["ollama"]["models"]


def shore(xs, y, axis, half):
    margin = np.full_like(xs, 100.)
    for i, model in enumerate(models):
        radius = 3.24*np.sqrt(model["pulls"]/models[0]["pulls"])
        cy = 1 + 5.8*i
        margin = np.minimum(margin,np.hypot(xs-(2.2-.22*cy),y-cy)-radius)
    return margin


def subject(sawn):
    pass

def place_steam(template, collection):
    for i, model in enumerate(models):
        plume = template if i == 0 else template.copy()
        if i:
            collection.objects.link(plume)
        y = 1 + 5.8*i
        radius = 3.24*np.sqrt(model["pulls"]/models[0]["pulls"])
        plume.location = (2.2-.22*y, y+.3*radius, .18*radius)
        plume.scale = (.91*radius,.46*radius,.19*radius)
