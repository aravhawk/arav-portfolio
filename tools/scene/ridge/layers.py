"""Pack three independently exposed Cycles projections and register their cameras."""

import argparse
import json
from pathlib import Path

import bpy
import numpy as np
import PyOpenColorIO as ocio
from PIL import Image, ImageOps
from scipy.ndimage import distance_transform_edt

parser = argparse.ArgumentParser()
parser.add_argument("folder", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--quality", type=int, default=92)
args = parser.parse_args()
config = ocio.Config.CreateFromFile(
    bpy.utils.resource_path("LOCAL") + "/datafiles/colormanagement/config.ocio"
)
grade = ocio.DisplayViewTransform(src="Linear Rec.709", display="sRGB", view="AgX")
grade.setDirection(ocio.TRANSFORM_DIR_INVERSE)
inverse = config.getProcessor(grade).getDefaultCPUProcessor()
cache = Path.home() / ".t3/portfolio-redesign-v4/assets-src"
registry = {}
layers = ("bank", "jaw", "near")


def rounded(x):
    return (x + 7) // 8 * 8


def read(gate, theme, suffix=""):
    with Image.open(args.folder / f"{gate}-{theme}{suffix}.png") as image:
        return image.convert("RGBA")


def layout(gate):
    size = read(gate, "day", "-bank").size
    w, h = size
    crops = [(0, 0, w, h)]
    for layer in layers[1:]:
        boxes = [
            read(gate, t, "-" + layer).getchannel("A").getbbox()
            for t in ("day", "night")
        ]
        x, y, r, b = (
            min(q[0] for q in boxes),
            min(q[1] for q in boxes),
            max(q[2] for q in boxes),
            max(q[3] for q in boxes),
        )
        crops.append((max(0, x - 7), max(0, y - 7), min(w, r + 7), min(h, b + 7)))
    slots = [(0, 0)]
    x, y, row = 0, rounded(h) + 8, 0
    for left, t, r, b in crops[1:]:
        if x + r - left > w:
            x, y, row = 0, y + row + 8, 0
        slots.append((x, y))
        row = max(row, rounded(b - t))
        x += rounded(r - left) + 8
    return size, crops, slots, (w, rounded(y + row))


def river_glitter(size):
    # The footprint of the low sun is applied in the shader. This independent
    # strip records the raked crests in metres along the river, before camera
    # foreshortening. No patch repeats across the reach.
    w, h = size
    v, u = np.mgrid[0 : 1 : complex(h), 0 : 1 : complex(w)].astype(np.float32)
    source = Image.open(cache / "snow_02_nor_gl_2k.jpg").getchannel("G")
    slope = (
        np.asarray(source.resize((w, h), Image.Resampling.LANCZOS), np.float32) / 255
    )
    grain = (
        np.asarray(
            source.resize((17, 31), Image.Resampling.LANCZOS).resize(
                (w, h), Image.Resampling.BICUBIC
            ),
            np.float32,
        )
        / 255
    )
    wind = np.sin(7 * u + 9 * v) + 0.47 * np.sin(18 * u - 14 * v)
    phase = 35 * v + 7 * v * v + 0.62 * wind + 6 * (grain - 0.5)
    crests = np.maximum(0, np.cos(2 * np.pi * phase)) ** 6
    short = (
        np.maximum(
            0, np.cos(2 * np.pi * (78 * v - 0.87 * wind + 0.8 * np.sin(9 * v + u)))
        )
        ** 8
    )
    broken = np.clip((slope - 0.46) * 6.8, 0, 1)
    field = np.clip(
        (crests + 0.45 * short)
        * (0.2 + 0.8 * broken)
        * np.clip(1.4 - 0.6 * wind, 0.2, 1),
        0,
        1,
    )
    # Opaque alpha in an earlier, colour-only survey contributes no glitter.
    # Keep a nonzero floor so the stored colour is defined across this strip.
    return Image.fromarray(np.uint8(255 - 8 * np.rint(26 * field)))


def shade_water(rgb, wet, projection):
    rows, cols = np.nonzero(np.asarray(wet) > 127)
    h, w = rgb.shape[:2]
    u, v = cols / w, rows / h
    x, y = projection["focus"]
    solar = np.exp(
        -(((u - x - 0.035 * (v - y)) / (0.025 + 0.1 * np.maximum(0, v - y))) ** 2)
    )
    tone = rgb[rows, cols]
    base = np.array([0.10, 0.173, 0.185], np.float32)
    # Preserve the long optically baked ripples beneath the independent
    # capillary detail. The return is broadest inside the sun's reflection.
    rgb[rows, cols] = tone - np.maximum(0, tone - base) * (0.90 - 0.38 * solar)[:, None]


def pack(gate, theme, size, crops, slots, atlas):
    w, h = size
    photo = read(gate, theme).convert("RGB")
    coverage = read(gate, theme, "-near").getchannel("A")
    wet = read(gate, theme, "-water-0001").getchannel("R")
    # Maximum safe advection at the fixed banks. Protect both shores and
    # the overhanging ice from sampling a moving copy of the snow.
    edge = distance_transform_edt(np.asarray(wet) > 127)
    river = Image.fromarray(np.uint8(255 * np.clip(edge / (0.027 * max(w, h)), 0, 1)))
    luminance = Image.new("L", atlas)
    # Keep the slowly varying colour independent of silhouette coverage.
    # A separate, full-resolution matte is shared between both lighting bakes.
    survey = Image.new("RGB", atlas, (128, 128, 0))
    for name, box, xy in zip(layers, crops, slots):
        image = read(gate, theme, "-" + name).crop(box)
        alpha = np.asarray(image.getchannel("A"), np.float32) / 255
        rgb = np.asarray(image.convert("RGB"), np.float32) / 255
        # Interior pixels visible from the opening camera keep its complete
        # physical radiance, including sky refracted through thin cut edges.
        if name != "bank":
            visible = alpha > 0.985
            if name == "jaw":
                visible &= np.asarray(coverage.crop(box)) < 3
            rgb[visible] = np.asarray(photo.crop(box), np.float32)[visible] / 255
            # Supply real edge colour outside the cut before either texture is
            # filtered. Transparent black would otherwise produce a cyan halo.
            distance, nearest = distance_transform_edt(
                alpha < 0.98, return_indices=True
            )
            fringe = (alpha < 0.98) & (distance < 32)
            rgb[fringe] = rgb[nearest[0][fringe], nearest[1][fringe]]
        if name == "bank":
            shade_water(rgb, wet, registry[gate])
        if name == "bank" and theme == "night":
            # In blue hour the western snow tongue faces away from the light.
            # Grade it by metres in the surveyed scene so its exposure holds
            # when the closing camera reaches what was the opening midground.
            gu, gv, bias = registry[gate]["ground"]
            u = (np.arange(w, dtype=np.float32) + 0.5) / w
            v = (np.arange(h, dtype=np.float32) + 0.5)[:, None] / h
            inverse_depth = gu * u + gv * v + bias
            weight = np.clip((inverse_depth - 1 / 53) / (1 / 34 - 1 / 53), 0, 1)
            weight *= weight * (3 - 2 * weight)
            water = np.asarray(wet, np.float32) / 255
            rgb *= 1 - 0.61 * (weight * (1 - water))[:, :, None]
        if theme == "night":
            value = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            # The bank takes its diffuse colour from the blue sky. Fade
            # the tint out across the bright gap and specular ice rims.
            shade = 1 - np.clip((value - 0.42) / 0.48, 0, 1)
            rgb *= 1 + shade[:, :, None] * np.array([-0.15, 0.015, 0.16], np.float32)
        inverse.applyRGB(rgb)
        field = np.log2(1 + 1024 * np.maximum(0, rgb)) / 14
        green = field[:, :, 1]
        y = 0.25 * field[:, :, 0] + 0.5 * green + 0.25 * field[:, :, 2]
        high = np.uint8(np.clip(np.rint(255 * y), 0, 255))
        luminance.paste(Image.fromarray(high), xy)
        chroma = [
            np.uint8(np.clip(np.rint(128 + 1320 * (field[:, :, k] - green)), 0, 255))
            for k in (0, 2)
        ]
        third = river.crop(box) if name == "bank" else Image.new("L", image.size)
        channels = Image.merge(
            "RGB", (Image.fromarray(chroma[0]), Image.fromarray(chroma[1]), third)
        )
        survey.paste(channels, xy)
    stem = args.output / f"{gate}-{theme}"
    luminance.save(stem.with_suffix(".avif"), quality=args.quality, speed=6)
    width = min(560 if gate == "wide" else 256, w)
    survey = survey.resize(
        (width, round(atlas[1] * width / w)), Image.Resampling.LANCZOS
    )
    # Four-code spacing on the opponent axes has a maximum error of
    # 2/1320 in log radiance. Retain native coverage along the silhouettes.
    channels = survey.split()
    palette = [int(np.clip(128 + 4 * round((v - 128) / 4), 0, 255)) for v in range(256)]
    survey = Image.merge("RGB", [ch.point(palette) for ch in channels])
    survey.putalpha(river_glitter(survey.size))
    survey.save(
        stem.with_name(stem.name + "-survey.webp"), lossless=True, exact=True, method=5
    )


for gate in ("wide", "tall"):
    size, crops, slots, atlas = layout(gate)
    w, h = size
    data = json.loads((args.folder / f"{gate}-day.json").read_text())
    data["scale"] = [w / atlas[0], h / atlas[1]]
    for name, box, xy in zip(layers[1:], crops[1:], slots[1:]):
        left, t, r, b = box
        data[name] = {
            "plane": data[name],
            "bounds": [left / w, t / h, r / w, b / h],
            "offset": [(xy[0] - left) / atlas[0], (xy[1] - t) / atlas[1]],
        }
    matte = Image.new("L", (atlas[0], atlas[1] - h))
    for name, box, xy in zip(layers[1:], crops[1:], slots[1:]):
        alpha = read(gate, "day", "-" + name).getchannel("A").crop(box)
        matte.paste(alpha, (xy[0], xy[1] - h))
    matte.save(args.output / f"{gate}-silhouettes.webp", lossless=True, method=5)
    registry[gate] = data
    for theme in ("day", "night"):
        pack(gate, theme, size, crops, slots, atlas)

# Continuous, tileable detail from the same CC0 wind-scoured snow as the
# bank. Two wind speeds advect it in the steam and in the spindrift.
wind = ImageOps.autocontrast(
    Image.open(cache / "snow_02_disp_2k.jpg")
    .convert("L")
    .resize((192, 192), Image.Resampling.LANCZOS)
)
wind.save(args.output / "wind.webp", quality=89, method=6)
target = Path("src/scene/flight")
(target / "ridge-projections.json").write_text(json.dumps(registry, indent=2) + "\n")
(target / "ridge-assets.json").write_text(
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
