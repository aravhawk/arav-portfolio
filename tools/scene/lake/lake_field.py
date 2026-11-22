"""Filter the surveyed ice skin, then resolve its fracture faces and powder edge in metres."""

import numpy as np
from PIL import Image
from scipy.interpolate import CubicSpline
from scipy.ndimage import (
    distance_transform_edt,
    gaussian_filter,
    grey_opening,
    map_coordinates,
)
from surface_detail import scan


def encode_lake(source, day_source, radiance, target, night):
    width, height = source.size
    yy, xx = np.indices((height, width), dtype=np.float32)
    x = (xx + 0.5) * 18 / width - 10
    y = 3 - (yy + 0.5) * 16 / height
    day = np.asarray(day_source.convert("RGB"), np.float32) / 255
    # Separate the achromatic windbank from the darker lead. Use the same
    # measured contour for first light and blue hour.
    inside = (day[:, :, 0] > 0.51) & (day[:, :, 0] > day[:, :, 1] - 0.037)
    signed = distance_transform_edt(
        inside, sampling=(16 / height, 18 / width)
    ) - distance_transform_edt(~inside, sampling=(16 / height, 18 / width))
    mask = np.clip(0.5 + signed / 0.54, 0, 1)
    smoother = mask * mask * (3 - 2 * mask)
    signal = np.log2(1 + 1024 * radiance(source)) / 14
    # The oblique survey includes fine reflections of crossing fracture
    # fronts. Remove the thin returns in the near field before baking the
    # dipped, branching joint. Preserve the broad lighting of the lake.
    for c in range(3):
        channel = signal[:, :, c]
        opened = grey_opening(channel, size=(9, 9))
        channel -= np.maximum(0, channel - opened) * (1 - smoother) * 0.95
    # Reconstruct the colour on each side from samples beyond the powder
    # ramp. Store residual colour relative to the implicit material blend.
    # The GPU resolves individual uncovered crystals with the same SDF.
    snow_core = signed > 0.26
    ice_core = signed < -0.26
    ns = distance_transform_edt(~snow_core, return_distances=False, return_indices=True)
    ni = distance_transform_edt(~ice_core, return_distances=False, return_indices=True)
    snow = np.stack(
        [gaussian_filter(signal[:, :, k][tuple(ns)], 1.1) for k in range(3)], axis=-1
    )
    ice = signal[tuple(ni)]
    local = np.clip(1 - np.abs(signed) / 0.26, 0, 1)
    signal = (1 - local[:, :, None]) * signal + local[:, :, None] * (
        ice + (snow - ice) * smoother[:, :, None]
    )
    # A curved main front forks toward the shallower ice. Both splays leave
    # the parent at an authored point and run out independently.
    tracks = [
        (
            [
                (-3.95, -8.9),
                (-3.37, -7.15),
                (-2.43, -5.88),
                (-1.47, -4.18),
                (-0.96, -3.62),
                (-0.54, -2.67),
                (0.66, -1.28),
            ],
            0.096,
        ),
        (
            [
                (-1.47, -4.18),
                (-1.13, -3.93),
                (-0.54, -3.83),
                (0.02, -3.44),
                (0.75, -3.04),
            ],
            0.043,
        ),
        ([(-2.43, -5.88), (-2.31, -5.49), (-2.4, -5.11), (-2.18, -4.78)], 0.022),
        ([(-0.54, -3.83), (-0.43, -3.60), (-0.17, -3.49)], 0.015),
    ]
    tex = scan("Ice004", "Color").mean(axis=2)
    air = map_coordinates(
        tex,
        [
            (np.mod(y * 1.45 + x * 0.4, 1) * tex.shape[0]).ravel(),
            (np.mod(x * 0.87 - y * 0.23, 1) * tex.shape[1]).ravel(),
        ],
        order=1,
        mode="wrap",
    ).reshape(x.shape)
    air = (air - np.percentile(air, 10)) / max(
        0.01, np.percentile(air, 92) - np.percentile(air, 10)
    )
    joint = np.zeros_like(x)
    best = np.full(x.shape, 4, np.float32)
    cross_section = np.full(x.shape, -0.55, np.float32)
    return_light = np.zeros_like(x)
    for j, (points, width_m) in enumerate(tracks):
        path = np.array(points)
        distance = np.r_[0, np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))]
        u = np.linspace(0, distance[-1], round(distance[-1] * width / 6))
        line = CubicSpline(distance, path, bc_type="natural")(u)
        tangent = np.gradient(line, axis=0)
        normal = tangent[:, ::-1] * [-1, 1]
        normal /= np.linalg.norm(normal, axis=1)[:, None]
        line += (
            normal * (0.012 * np.sin(u * 13 + j) + 0.006 * np.sin(u * 29 - j))[:, None]
        )
        seed = np.zeros_like(inside)
        iy = np.clip(
            np.rint((3 - line[:, 1]) * height / 16 - 0.5).astype(int), 0, height - 1
        )
        ix = np.clip(
            np.rint((line[:, 0] + 10) * width / 18 - 0.5).astype(int), 0, width - 1
        )
        seed[iy, ix] = True
        lookup = np.zeros_like(x, dtype=int)
        lookup[iy, ix] = np.arange(len(u))
        near = distance_transform_edt(
            ~seed, return_distances=False, return_indices=True
        )
        k = lookup[tuple(near)]
        side = (x - line[k, 0]) * normal[k, 0] + (y - line[k, 1]) * normal[k, 1]
        length = u[k] / distance[-1]
        taper = np.sin(np.pi * np.clip(0.001 + length * 0.998, 0, 1)) ** 0.48
        width_at = (
            width_m
            * (0.36 + 0.64 * taper)
            * (0.76 + 0.20 * np.sin(7 * u[k] + j) + 0.09 * np.sin(19 * u[k]))
        )
        # One thin lit lip and a wider, intermittent wall on the dipped side.
        rim = np.exp(-((side / (0.006 + 0.006 * taper)) ** 2))
        wall = np.exp(-(((side - width_at * 0.56) / (0.005 + width_at * 0.46)) ** 2))
        intensity = (0.42 * rim + wall * (0.30 + 0.46 * np.clip(air, 0, 1))) * taper
        joint = np.maximum(joint, intensity)
        # Keep the signed cross-section between texel centres, so the tip
        # and the trapped-air lip stay resolved at a grazing camera angle.
        dist = np.hypot(x - line[k, 0], y - line[k, 1]) / np.maximum(0.009, width_at)
        nearest = (dist < best) & (dist < 2.5)
        best[nearest] = dist[nearest]
        cross_section[nearest] = (side / np.maximum(0.009, width_at))[nearest]
        return_light[nearest] = (taper * (0.52 + 0.48 * np.clip(air, 0, 1)))[nearest]
    if not night:
        coded = np.clip((cross_section + 0.55) / 2.05, 0, 1)
        response = np.clip(return_light, 0, 1)
        Image.fromarray(
            np.rint(255 * np.stack([coded, response, response], axis=-1)).astype(
                np.uint8
            )
        ).save(
            target.parent / "lake-fractures.avif",
            quality=89,
            speed=6,
            subsampling="4:4:4",
        )
    joint *= 1 - smoother
    tint = np.array([0.105, 0.132, 0.150] if night else [0.16, 0.20, 0.215], np.float32)
    signal += joint[:, :, None] * tint * 0.27
    # Keep the material blend separate. The log-domain difference is small
    # enough to interpolate cleanly through the graded shadows.
    step = np.array(
        [0.285, 0.245, 0.203] if night else [0.315, 0.288, 0.275], np.float32
    )
    residual = signal - smoother[:, :, None] * step
    # Offset alpha away from zero so encoders retain colour in clear ice.
    alpha = 64 + np.round(mask * 191)
    rng = np.random.default_rng(920)
    rgb = np.clip(
        np.rint(255 * residual + rng.uniform(-0.5, 0.5, mask.shape)[:, :, None]), 0, 255
    )
    Image.fromarray(np.dstack((rgb, alpha)).astype(np.uint8)).save(
        target, quality=70, speed=6, subsampling="4:4:4"
    )
