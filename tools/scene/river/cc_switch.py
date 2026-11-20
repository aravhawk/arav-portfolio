import numpy as np


def courses(y):
    spread = max(0, y + 5)
    trunk = 3.4 - .20 * min(0, y + 5)
    return [trunk + slope * spread for slope in (-.36, .12, .51)]


def shore(xs, y, axis, half):
    return np.minimum.reduce([np.abs(xs - x) - half for x in courses(y)])


def extras(grid, frozen):
    # Sample the curved noses by angle so the first rows already turn
    # across the flow. Each sheet freezes a little way up its own branch.
    for index in (1, 2):
        rows = []
        tip = -2.7 if index == 1 else -1.8
        cap = [(tip + 2.1 * (1 - np.cos(a)), 1.42 * np.sin(a))
               for a in np.linspace(0, np.pi / 2, 22)]
        body = [(y, 1.42) for y in np.linspace(tip + 2.1, 55, 150)[1:]]
        for y, width in cap + body:
            x = courses(y)[index]
            rows.append([(x - width, y, .04), (x + width, y, .04)])
        grid("Sealed lead", rows, frozen)


def subject(sawn):
    pass
