import numpy as np


def shore(xs, y, axis, half):
    return 4.5 - y - .32 * xs + .36 * np.sin(xs * .58)


def horizon(grid, water):
    grid("Sea beyond the shelf", [[(-900, 55, 0), (900, 55, 0)],
                                  [(-900, 1100, 0), (900, 1100, 0)]], water)


def subject(sawn):
    cut = [(-.87,-.18),(.87,-.18),(.84,3.48),(.63,3.56),(-.85,3.49)]
    sawn("Last standing slab", cut, .69, (2,1,0), (0,-.04,.24), "near", 1201)
    sawn("Unraised slab", cut, .69, (4,-.8,.44), (1.54,0,-.72), "near", 1202)
