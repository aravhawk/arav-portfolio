import numpy as np


def courses(y):
    spread = max(0, y + 5)
    trunk = 3.4 - .20 * min(0, y + 5)
    return [trunk + slope * spread for slope in (-.36, .12, .51)]


def shore(xs, y, axis, half):
    return np.minimum.reduce([np.abs(xs - x) - half for x in courses(y)])


def extras(grid, frozen):
    # Two shelves end at the same vertex as the open branch. The thin
    # snow shelf covers their edges as it does the exposed river.
    for index in (1, 2):
        rows = []
        for y in np.linspace(-5, 55, 160):
            x = courses(y)[index]
            width = min(1.42, (y + 5) * .16)
            rows.append([(x - width, y, .04), (x + width, y, .04)])
        grid("Sealed lead", rows, frozen)


def subject(sawn):
    pass
