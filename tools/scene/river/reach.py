"""Downstream topography in metres; the water intersects the scoured snow shelf."""
import math
import numpy as np


def landscape(reach, grid, snow, water, sawn, frozen):
    from importlib import import_module
    design = import_module(reach.replace("-", "_"))
    design.subject(sawn)
    if hasattr(design, "extras"):
        design.extras(grid, frozen)
    if hasattr(design, "horizon"):
        design.horizon(grid, water)
    xs = np.linspace(-46, 46, 511)
    rows = []
    for y in np.linspace(-45, 55, 451):
        axis = 3.4 - .19*y + 1.35*math.sin(y*.14)
        half = 1.05 + .23*math.sin(.48*y) + .08*math.cos(1.9*y)
        margin = design.shore(xs, y, axis, half)
        drift = .036*np.sin(.46*xs+.67*y) + .017*np.cos(.88*xs-.33*y)
        elevation = .16*np.tanh(3.8*margin) + drift
        if hasattr(design, "relief"):
            elevation += design.relief(xs, y)
        rows.append(list(zip(xs, np.full_like(xs,y), elevation)))
    grid("Scalloped snow shelf", rows, snow)
    grid("Open lead", [[(-46,-45,0),(46,-45,0)],[(-46,55,0),(46,55,0)]], water)
