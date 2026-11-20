import numpy as np


def shore(xs, y, axis, half):
    return np.abs(xs-.68*y)-half*2.6


def subject(sawn):
    for i, score in enumerate([7.6, 7.4, 6.3]):
        x, y, h = (i-1)*2.35, (i-1)*3.15, score*.57
        outline = [(-1,-.25),(1,-.25),(1,h-.19),(.84,h),(-.7,h-.05),(-1,h-.16)]
        sawn("Benchmark slab", outline, .67, (x,y,0), (0,0,.28), "near", 310+i)
