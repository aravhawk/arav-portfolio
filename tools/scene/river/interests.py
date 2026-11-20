import numpy as np


def shore(xs, y, axis, half):
    # One distributary per entry in the site's seven-item INTERESTS list.
    fan = max(0, y + 7)
    origin = 5.2 - .82 * min(0, y + 7)
    channels = [np.abs(xs - origin - slope * fan ** .92 - .35*np.sin(.23*y + slope))
                - (.68 + .17 * half) for slope in np.linspace(-.50, .50, 7)]
    return np.minimum(np.minimum.reduce(channels), 29 - y)


def subject(sawn):
    pass
