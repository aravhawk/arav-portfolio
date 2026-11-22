import numpy as np


def shore(xs, y, axis, half):
    # The near and return reaches wrap around one snow promontory.
    return np.abs(np.hypot(np.minimum(xs - 13, 0), y - 1) - 10.4) - 1.35 * half


def relief(xs, y):
    return 1.65 * np.exp(-((xs - 13) / 6.8) ** 2 - ((y - 1) / 6.0) ** 2)


def subject(sawn):
    sawn("Bend marker", [(-.52,-.25),(.55,-.25),(.51,2.95),(.26,3.12),(-.5,3.01)],
         .74, (.6, 1, 0), (0, -.03, .24), "near", 1031)
