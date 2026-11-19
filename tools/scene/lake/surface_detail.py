"""Pack metre-scale scanned snow relief and microfacets of the lake skin."""

import io
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter


def scan(asset, suffix):
    cache = Path.home() / ".t3/portfolio-redesign-v4/assets-src"
    stem = asset + "_2K-JPG"
    with zipfile.ZipFile(cache / (stem + ".zip")) as archive:
        source = Image.open(io.BytesIO(archive.read(stem + "_" + suffix + ".jpg")))
        return (
            np.asarray(source.resize((384, 384), Image.Resampling.LANCZOS), np.float32)
            / 255
        )


def bake_detail(dest):
    snow_normal = scan("Snow008A", "NormalGL")
    ice_color = scan("Ice003", "Color").mean(axis=2)
    # Store the response of a small raking light and the bright microfacet
    # population separately. Both scans are periodic in material coordinates.
    snow_relief = np.clip(
        0.5 + 0.83 * (snow_normal[:, :, 1] - 0.5) - 0.36 * (snow_normal[:, :, 0] - 0.5),
        0,
        1,
    )
    # Use small crystal clusters for coverage. Long wind ridges belong
    # in the surveyed snow lighting, not in the grain of its edge.
    cache = Path.home() / ".t3/portfolio-redesign-v4/assets-src"
    diffuse = (
        np.asarray(
            Image.open(cache / "snow_02_diff_2k.jpg").convert("L").resize((384, 384)),
            np.float32,
        )
        / 255
    )
    grain = diffuse - gaussian_filter(diffuse, 3, mode="wrap")
    grain += 0.18 * (snow_relief - gaussian_filter(snow_relief, 1.4, mode="wrap"))
    lo, hi = np.percentile(grain, [3, 97])
    crystals = np.clip((grain - lo) / (hi - lo), 0, 1)
    wind = (
        np.asarray(
            Image.open(cache / "snow_02_disp_2k.jpg").convert("L").resize((384, 384)),
            np.float32,
        )
        / 255
    )
    lo, hi = np.percentile(wind, [2, 98])
    wind = np.clip((wind - lo) / (hi - lo), 0, 1)
    bright_facets = np.clip((ice_color - 0.16) / 0.30, 0, 1)
    pixels = np.stack((crystals, bright_facets, wind), axis=-1)
    Image.fromarray(np.uint8(np.rint(255 * pixels))).save(
        dest / "lake-detail.avif", quality=67, speed=6, subsampling="4:4:4"
    )
