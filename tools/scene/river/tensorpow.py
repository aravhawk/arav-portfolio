import numpy as np


def shore(xs, y, axis, half):
    return np.sqrt(((xs - 2) / 1.12) ** 2 + (.85 * y) ** 2) - 7.8


def extras(grid, frozen):
    grid("Black ice", [[(-12, -12, .014), (15, -12, .014)],
                       [(-12, 12, .014), (15, 12, .014)]], frozen)


def subject(sawn):
    outline = [(-.52, -.12), (.52, -.12), (.52, 1.68), (.34, 1.76), (-.52, 1.72)]
    for row in range(4):
        for col in range(4):
            a, b = (col - 1.5) * 2.3, (row - 1.5) * 2.55
            x, y = 2 + .94 * a + .34 * b, -.34 * a + .94 * b
            lit = row == 2 and col == 1
            sawn("Transmitted sunlight" if lit else "Shaded cut", outline, .54,
                 (x, y, 0), (0, 0, -.35), "near", 900 + 4 * row + col)
