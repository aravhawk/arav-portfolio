import numpy as np


def shore(xs, y, axis, half):
    return np.abs(xs-.20*y)-2.1*half


def subject(sawn):
    for side in [-1,1]:
        x = 2.85*side
        sawn("Standing abutment", [(-.57,-.4),(.57,-.4),(.55,3.6),(.23,3.8),(-.57,3.71)],
             .94,(x,side*.7,0),(0,0,.24),"near",400+side)
    # Cut the span upright, then lay it down. The internal fractures rotate
    # with the length of the cut and remain beneath the horizontal surface.
    sawn("Bank to bank ice span", [(-.27,-3.1),(.27,-3.1),(.25,3.1),(-.26,3.08)],
         1.24,(0,0,1.4),(0,np.pi/2,.24),"near",406)
