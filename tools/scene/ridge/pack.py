"""Encode the survey in the lake renderer's log-radiance coordinates."""

import argparse
import json
from pathlib import Path

import bpy
import numpy as np
import PyOpenColorIO as ocio
from PIL import Image, ImageFilter

parser = argparse.ArgumentParser()
parser.add_argument("folder", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument(
    "--ledger", type=Path, default=Path("src/scene/flight/ridge-assets.json")
)
args = parser.parse_args()
config = ocio.Config.CreateFromFile(
    bpy.utils.resource_path("LOCAL") + "/datafiles/colormanagement/config.ocio"
)
grade = ocio.DisplayViewTransform(src="Linear Rec.709", display="sRGB", view="AgX")
grade.setDirection(ocio.TRANSFORM_DIR_INVERSE)
inverse = config.getProcessor(grade).getDefaultCPUProcessor()
for gate in ("wide", "tall"):
    survey = Image.open(args.folder / f"{gate}-day-survey-0001.png").convert("RGB")
    survey = survey.filter(ImageFilter.MedianFilter(3))
    survey.thumbnail((560, 560), Image.Resampling.LANCZOS)
    for theme in ("day", "night"):
        name = f"{gate}-{theme}"
        im = Image.open(args.folder / f"{name}.png").convert("RGB")
        rgb = np.asarray(im, np.float32) / 255
        if theme == "day":
            # A graduated shadow lift across the near bank keeps the DOM's
            # dark ink legible throughout the push. Preserve the lit snow
            # and the distant sill. The adjustment becomes part of the bake.
            height = rgb.shape[0]
            row = np.linspace(0, 1, height, dtype=np.float32)
            start = 0.57 if gate == "wide" else 0.60
            weight = np.clip((row - start) / 0.13, 0, 1)
            weight = (weight * weight * (3 - 2 * weight))[:, None]
            light = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            # Keep the open lead dark. Lift only the broad tonal field on
            # the windward shore, retaining its scanned grain and fractures.
            water = (
                np.asarray(
                    survey.getchannel("G").resize(im.size, Image.Resampling.BILINEAR),
                    np.float32,
                )
                / 255
            )
            x = np.linspace(0, 1, im.width, dtype=np.float32)
            shore = np.clip(((0.71 if gate == "wide" else 1.25) - x) / 0.29, 0, 1)
            shore = shore * shore * (3 - 2 * shore)
            broad = Image.fromarray(np.uint8(light * 255)).filter(
                ImageFilter.GaussianBlur(im.width / 160)
            )
            shadow = np.maximum(0, 0.65 - np.asarray(broad, np.float32) / 255)
            lift = (
                (0.77 if gate == "wide" else 0.88)
                * weight
                * shore[None, :]
                * (1 - water)
                * shadow
            )
            rgb += lift[:, :, None]
        inverse.applyRGB(rgb)
        field = np.log2(1 + 1024 * np.maximum(0, rgb)) / 14
        dither = np.random.default_rng(339).uniform(-0.5, 0.5, field.shape[:2])
        # Full native luminance in R8; the two quieter opponent axes fit
        # beside the depth and water channels in the survey texture.
        y = 0.25 * field[:, :, 0] + 0.5 * field[:, :, 1] + 0.25 * field[:, :, 2]
        baked = np.uint8(np.clip(np.rint(255 * y + dither), 0, 255))
        Image.fromarray(baked).save(args.output / f"{name}.avif", quality=83, speed=4)
        channels = list(survey.split()[:2])
        for a in (0, 2):
            axis = np.uint8(
                np.clip(np.rint(128 + 1530 * (field[:, :, a] - field[:, :, 1])), 1, 255)
            )
            channels.append(
                Image.fromarray(axis).resize(survey.size, Image.Resampling.LANCZOS)
            )
        Image.merge("RGBA", channels).save(
            args.output / f"{name}-survey.webp", lossless=True, exact=True, method=6
        )

# The registry ledger follows the encoded files, including both camera gates.
args.ledger.write_text(
    json.dumps(
        {
            p.name: p.stat().st_size
            for p in sorted(args.output.iterdir())
            if p.is_file()
        },
        indent=2,
    )
    + "\n"
)
