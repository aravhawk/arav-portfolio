"""Pressure ridge in metres. Cycles beauty and independently visible projection layers."""

import argparse
import json
import math
import random
import io
import zipfile

import numpy as np
from PIL import Image
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


parser = argparse.ArgumentParser()
parser.add_argument("output", type=Path)
parser.add_argument("--library", type=Path)
parser.add_argument("--width", type=int, default=680)
parser.add_argument("--samples", type=int, default=12)
parser.add_argument("--phone", action="store_true")
parser.add_argument("--night", action="store_true")
parser.add_argument("--clay", action="store_true")
parser.add_argument("--layers", action="store_true")
parser.add_argument("--slope", type=float, default=1.62)
parser.add_argument("--distance", type=float, default=8.4)
parser.add_argument("--aim", type=float, default=0.65)
parser.add_argument("--height", type=float, default=1.55)
parser.add_argument("--crest", type=float, default=1)
parser.add_argument("--gap", type=float, default=0.57)
parser.add_argument("--roll", type=float, default=-2)
parser.add_argument("--reach", type=float, default=0.55)
parser.add_argument("--push", type=float, default=0)
parser.add_argument("--seed", type=int, default=529)
args = parser.parse_args()
out = args.output.resolve()
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.refresh_devices()
for dev in prefs.devices:
    dev.use = dev.type == "METAL"
scene.cycles.device = "GPU"
scene.cycles.samples = args.samples
scene.cycles.volume_bounces = 5
scene.cycles.use_denoising = True
scene.cycles.seed = 17
scene.render.resolution_x = args.width
scene.render.resolution_y = round(args.width * (844 / 390 if args.phone else 0.625))
scene.render.resolution_percentage = 100
scene.render.image_settings.color_mode = "RGBA"
rng = random.Random(args.seed)
cos, sin, exp = math.cos, math.sin, math.exp
layers = {"near": [], "jaw": [], "bank": []}


def surface(label, color, rough):
    mat = bpy.data.materials.new(label)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = rough
    return mat


def mesh(label, verts, faces, mat, layer):
    data = bpy.data.meshes.new(label)
    data.from_pydata(verts, [], faces)
    data.update()
    ob = bpy.data.objects.new(label, data)
    scene.collection.objects.link(ob)
    data.materials.append(mat)
    layers[layer].append(ob)
    return ob


def light(data, location, target):
    ob = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(ob)
    ob.location = location
    ob.rotation_euler = (
        (Vector(target) - ob.location).to_track_quat("-Z", "Y").to_euler()
    )
    ob.visible_camera = False
    return ob


clay = surface("Clay", (0.42, 0.42, 0.42), 0.8)
snow = surface("Clay snow", (0.65, 0.65, 0.65), 0.8)
ice = fault = clay
source = Vector((-0.008, 1, 0.06)).normalized()
if args.clay:
    scene.world = bpy.data.worlds.new("Clay sky")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (
        0.5,
        0.5,
        0.5,
        1,
    )
    sun = bpy.data.lights.new("Clay sidelight", "SUN")
    sun.energy = 3
    sun.angle = 0.1
    light(sun, (-3, -5, 7), (0, 0, 0))
else:
    with bpy.data.libraries.load(str(args.library)) as (_, imported):
        imported.materials = ["Slab", "Snow", "Fracture"]
        imported.worlds = ["Lake sky"]
        imported.lights = ["Sun", "Front", "Rear"]
    ice, snow, fault = imported.materials
    scene.world = imported.worlds[0]
    sun, front, rear = imported.lights
    light(sun, source * 10, (0, 0, 0))
    light(front, (-2.8, -5, 3.5), (0, 0, 1.1))
    light(rear, (-0.1, 3.1, 2.5), (0, 0, 0.8))
    scene.view_settings.exposure = -0.45 if args.night else -0.14
    # Align the sky's brightest direction and the real source with the cut.
    for node in scene.world.node_tree.nodes:
        if node.bl_idname == "ShaderNodeVectorMath" and node.operation == "DISTANCE":
            node.inputs[1].default_value = source

water = surface("Water over the sill", (0.011, 0.044, 0.048), 0.163)
water.pass_index = 1
foam = surface("Air entrained at impact", (0.72, 0.85, 0.81), 0.41)
foam.pass_index = 1
if not args.clay:
    wt = water.node_tree
    grain = wt.nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 37
    wt.links.new(wt.nodes.new("ShaderNodeTexCoord").outputs["Object"], grain.inputs[0])
    bump = wt.nodes.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = 0.012
    wt.links.new(grain.outputs[0], bump.inputs["Height"])
    wt.links.new(bump.outputs[0], wt.nodes["Principled BSDF"].inputs["Normal"])
    # The protected reach reflects the shadowed undersides of the banks.
    # The solar glints are restricted to the sun's footprint on the ripples.
    bs = wt.nodes["Principled BSDF"]
    bs.inputs["IOR"].default_value = 1.332
    bs.inputs["Specular IOR Level"].default_value = 0.12
    bs.inputs["Roughness"].default_value = 0.26
    geom = wt.nodes.new("ShaderNodeNewGeometry")
    split = wt.nodes.new("ShaderNodeSeparateXYZ")
    wt.links.new(geom.outputs["Position"], split.inputs[0])
    axial = wt.nodes.new("ShaderNodeMath")
    axial.operation = "ABSOLUTE"
    axis = wt.nodes.new("ShaderNodeMath")
    axis.operation = "MULTIPLY_ADD"
    wt.links.new(split.outputs["Y"], axis.inputs[0])
    axis.inputs[1].default_value = 0.47
    wt.links.new(split.outputs["X"], axis.inputs[2])
    wt.links.new(axis.outputs[0], axial.inputs[0])
    band = wt.nodes.new("ShaderNodeMapRange")
    band.inputs["From Min"].default_value = 0.055
    band.inputs["From Max"].default_value = 0.71
    band.inputs["To Min"].default_value = 1
    band.inputs["To Max"].default_value = 0
    wt.links.new(axial.outputs[0], band.inputs[0])
    # The water normal selects individual raked crests from that path.
    facing = wt.nodes.new("ShaderNodeVectorMath")
    facing.operation = "DOT_PRODUCT"
    facing.inputs[1].default_value = (0, -0.75, 0.66)
    wt.links.new(geom.outputs["Normal"], facing.inputs[0])
    flash = wt.nodes.new("ShaderNodeMapRange")
    flash.inputs["From Min"].default_value = 0.68
    flash.inputs["From Max"].default_value = 0.81
    wt.links.new(facing.outputs["Value"], flash.inputs[0])
    strength = wt.nodes.new("ShaderNodeMath")
    strength.operation = "MULTIPLY"
    wt.links.new(flash.outputs[0], strength.inputs[0])
    wt.links.new(band.outputs[0], strength.inputs[1])
    bs.inputs["Emission Color"].default_value = (
        (1.5, 1.45, 1.27, 1) if not args.night else (0.48, 0.68, 0.86, 1)
    )
    wt.links.new(strength.outputs[0], bs.inputs["Emission Strength"])
    dark = wt.nodes.new("ShaderNodeBsdfDiffuse")
    dark.inputs["Color"].default_value = (0.009, 0.03, 0.036, 1)
    mix = wt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.24
    wt.links.new(dark.outputs[0], mix.inputs[1])
    wt.links.new(bs.outputs[0], mix.inputs[2])
    fleck = wt.nodes.new("ShaderNodeEmission")
    fleck.inputs["Color"].default_value = (
        (1.8, 1.67, 1.36, 1) if not args.night else (0.69, 0.90, 1.1, 1)
    )
    wt.links.new(strength.outputs[0], fleck.inputs["Strength"])
    radiance = wt.nodes.new("ShaderNodeAddShader")
    wt.links.new(mix.outputs[0], radiance.inputs[0])
    wt.links.new(fleck.outputs[0], radiance.inputs[1])
    wt.links.new(radiance.outputs[0], wt.nodes["Material Output"].inputs["Surface"])


# A separate deposit leaves the hero's entire optical material intact. Its
# thickness dwindles from packed upper crust to scattered frost downslope.
crust = bpy.data.materials.new("Wind-packed hoarfrost on the shear")
crust.use_nodes = True
ct = crust.node_tree
shader = ct.nodes["Principled BSDF"]
shader.inputs["Base Color"].default_value = (0.80, 0.88, 0.86, 1)
shader.inputs["Roughness"].default_value = 0.78
coords = ct.nodes.new("ShaderNodeTexCoord")
z = ct.nodes.new("ShaderNodeSeparateXYZ")
ct.links.new(coords.outputs["Generated"], z.inputs[0])
grain = ct.nodes.new("ShaderNodeTexNoise")
grain.inputs["Scale"].default_value = 6.3
grain.inputs["Detail"].default_value = 5
ct.links.new(coords.outputs["Object"], grain.inputs[0])
density = ct.nodes.new("ShaderNodeMath")
density.operation = "MULTIPLY_ADD"
ct.links.new(grain.outputs[0], density.inputs[0])
density.inputs[1].default_value = 1.23
ct.links.new(z.outputs["Z"], density.inputs[2])
patches = ct.nodes.new("ShaderNodeMapRange")
patches.inputs["From Min"].default_value = 1.04
patches.inputs["From Max"].default_value = 1.45
ct.links.new(density.outputs[0], patches.inputs[0])
grains = ct.nodes.new("ShaderNodeBump")
grains.inputs["Distance"].default_value = 0.015
ct.links.new(grain.outputs[0], grains.inputs["Height"])
ct.links.new(grains.outputs[0], shader.inputs["Normal"])
coating = ct.nodes.new("ShaderNodeMixShader")
ct.links.new(patches.outputs[0], coating.inputs[0])
ct.links.new(ct.nodes.new("ShaderNodeBsdfTransparent").outputs[0], coating.inputs[1])
ct.links.new(shader.outputs[0], coating.inputs[2])
ct.links.new(coating.outputs[0], ct.nodes["Material Output"].inputs[0])


def wall(x):
    return (
        1.52 * x
        + (args.slope - 1.52) * max(0, x - 1.45)
        + 0.055 * x * x / (1 + abs(x) * 0.10)
    )


def plate(x, y, size, height, thick, dip, cant, yaw, layer, small=False):
    # A fractured sheet has large straight perimeter runs interrupted by shorter
    # shear offsets. A second broken ring bevels only part of its damaged lip.
    count = rng.randint(5, 8)
    ring = []
    for i in range(count):
        a = (i + rng.uniform(-0.25, 0.25)) * math.tau / count
        r = rng.uniform(0.84, 1.12)
        ring.append((cos(a) * size * 0.5 * r, sin(a) * height * 0.5 * r))
    # Short secondary breaks in the long shear edges. Their scale follows
    # the physical thickness rather than the length of the whole plate.
    chips = random.Random(41 + round(abs(x + y) * 530))
    boundary = []
    for i, (u, v) in enumerate(ring):
        b, c = ring[(i + 1) % len(ring)]
        for t in (0, 0.21, 0.47, 0.71, 0.88):
            chip = 1 - chips.uniform(0, 0.075) if t else 1
            boundary.append(
                ((u * (1 - t) + b * t) * chip, (v * (1 - t) + c * t) * chip)
            )
    ring = boundary
    count = len(ring)
    verts = []
    for band, depth in ((0.97, -0.5), (1, -0.31), (0.99, 0.44), (0.95, 0.52)):
        for u, v in ring:
            verts.append(
                (
                    u * band,
                    thick
                    * (depth + 0.17 * sin(2 * u + v) + 0.043 * sin(6 * u - 3 * v)),
                    v * band,
                )
            )
    faces = [tuple(range(count)), tuple(reversed(range(3 * count, 4 * count)))]
    for k in range(3):
        faces += [
            (
                k * count + i,
                (k + 1) * count + i,
                (k + 1) * count + (i + 1) % count,
                k * count + (i + 1) % count,
            )
            for i in range(count)
        ]
    ob = mesh("Pressure plate", verts, faces, ice, layer)
    ob.rotation_euler = (dip, cant, yaw)
    rot = ob.rotation_euler.to_matrix()
    low = min((rot @ v.co).z for v in ob.data.vertices)
    ob.location = (
        x,
        y,
        -low - height * rng.uniform(0.09, 0.18) + (0.23 if not small else 0.06),
    )
    if args.clay:
        return
    # Translucent sheets at two depths break up the broad face. Sweep thin
    # tapered splays between successive shear steps rather than painting veins.
    if not small and x < 6:
        flaws = random.Random(807 + round(abs(x + y) * 201))
        for j in range(9):
            u = flaws.uniform(-0.26, 0.28) * size
            v = flaws.uniform(-0.19, 0.19) * height
            a = flaws.uniform(0.3, 2.9)
            span = flaws.uniform(0.12, 0.35) * min(size, height)
            vertices = []
            for k in range(11):
                t = k / 10
                du, dv = cos(a) * span * t, sin(a) * span * t
                shell = thick * (
                    -0.49
                    + 0.17 * sin(2 * (u + du) + v + dv)
                    + 0.043 * sin(6 * (u + du) - 3 * (v + dv))
                )
                w = 0.004 + 0.017 * sin(t * math.pi)
                vertices.extend(
                    [
                        (u + du, shell, v + dv),
                        (
                            u + du + w,
                            shell + 0.043 * sin(t * math.pi),
                            v + dv + w * 0.21,
                        ),
                    ]
                )
                a += flaws.uniform(-0.092, 0.092)
            crack = mesh(
                "Air along a slipping face",
                vertices,
                [(k, k + 1, k + 3, k + 2) for k in range(0, 20, 2)],
                fault,
                layer,
            )
            crack.parent = ob
    # Separate windward crusts leave the actual hero shader on the cut ice.
    ob.data.materials.append(snow)
    for pol in ob.data.polygons[2:]:
        if (rot @ pol.normal).z > 0.58 and rng.random() < 0.79:
            pol.material_index = 1
    if small:
        return
    if x < 7:
        powder = mesh("Adhering wind crust", verts, faces, crust, layer)
        powder.parent = ob
        powder.scale = (1.002, 1.023, 1.003)
    for j in range(rng.randint(3, 7)):
        u, v = rng.uniform(-0.19, 0.19) * size, rng.uniform(-0.13, 0.13) * height
        du, dv = rng.uniform(0.035, 0.15) * size, rng.uniform(0.08, 0.19) * height
        points = [
            (u - du, 0, v - dv),
            (u + du * 0.1, -thick * 0.24, v + dv),
            (u + du, 0, v + dv * 0.54),
            (u + 0.2 * du, thick * 0.22, v - dv * 0.38),
        ]
        lens = mesh("Submerged air shear", points, [(0, 1, 2, 3)], fault, layer)
        lens.parent = ob


# The two large broken faces occupy opposite lips of the same ridge. The
# rest folds away downriver. The close western toe leaves the lower bank clear.
g = args.gap
plate(-g - 0.92, -0.80, 2.88, 3.85 * args.crest, 0.36, -0.57, -0.36, 0.65, "near")
plate(g + 0.76, 1.52, 2.65, 2.21 * args.crest, 0.33, -0.35, -0.38, 0.92, "jaw")
# Secondary faces overlap the loaded jaws, leaving the principal cuts exposed.
plate(-g - 1.5, -1.46, 2.65, 2.75 * args.crest, 0.29, -0.78, 0.46, 0.32, "near")
plate(g + 1.49, 2.46, 3.1, 2.21 * args.crest, 0.28, -0.62, -0.25, 0.74, "jaw")
# Oblique fracture faces overlap at the near foot. A half-submerged plate
# narrows the skylight behind the spill without damming the dark water.
plate(-1.64, -2.43, 2.45, 2.18, 0.28, -0.54, 0.66, -0.69, "near")
plate(-1.06, -1.64, 1.42, 1.38, 0.22, -0.40, -0.52, 0.66, "near")
plate(-2.22, -3.45, 2.41, 2.48, 0.31, -0.66, -0.51, 0.88, "near")
plate(g + 0.69, 2.48, 2.72, 2.33, 0.31, -0.51, -0.70, -0.31, "jaw")
plate(1.40 - args.reach, 3.50, 1.60, 1.85, 0.24, -0.52, -0.61, 0.83, "jaw")
for side in (-1, 1):
    for j in range(31 if side > 0 else 4):
        x = side * (g + 2.30 + j * 0.88)
        y = wall(x) + rng.uniform(-0.42, 0.42)
        group = "near" if side < 0 else ("jaw" if j < 2 else "bank")
        plate(
            x,
            y,
            rng.uniform(2.4, 4.25),
            rng.uniform(1.45, 2.8) * args.crest,
            rng.uniform(0.16, 0.38),
            rng.uniform(-0.88, 0.78),
            rng.uniform(-0.75, 0.75),
            rng.uniform(0.16, 1.23),
            group,
        )
        plate(
            x + 0.22,
            y + 0.82,
            rng.uniform(1.4, 3),
            rng.uniform(1.3, 2.4),
            0.22,
            rng.uniform(-0.75, 0.4),
            rng.uniform(-0.71, 0.62),
            rng.uniform(-1, 1),
            group,
        )
        for j2 in range(3):
            plate(
                x + rng.uniform(-0.53, 0.53),
                y - rng.uniform(0.50, 1.26),
                rng.uniform(0.46, 1.42),
                rng.uniform(0.27, 1.1),
                rng.uniform(0.09, 0.2),
                rng.uniform(-1.3, -0.50),
                rng.uniform(-0.6, 0.6),
                rng.uniform(-1, 1),
                group,
                True,
            )


# The toes contain small, overlapping chips packed into irregular pockets
# of powder. Leave the open channel and the foreground snow tongue bare.
for j in range(135):
    side = rng.choice((-1, 1))
    x = side * rng.uniform(0.64, 6.7)
    y = wall(x) - rng.uniform(0.23, 1.46)
    if abs(x - 0.14 + y * 0.17) < 0.55:
        continue
    size = 0.08 + 0.57 * rng.random() ** 2
    plate(
        x,
        y,
        size * 1.44,
        size,
        size * 0.29,
        rng.uniform(-1.43, -0.37),
        rng.uniform(-0.8, 0.8),
        rng.uniform(-1.3, 1.3),
        "near" if x < 0 else ("jaw" if x < 4.5 else "bank"),
        True,
    )


def stream(y):
    return 0.10 - y * 0.12 + 0.39 * max(0, -y - 1.38) + 0.08 * sin(y * 1.6)


def width(y):
    return 0.48 + 0.074 * max(0, -y) + 0.08 * cos(y * 2.5)


def spill(x, y):
    lip = 0.35 + 0.09 * sin(x * 9) + 0.08 * sin(x * 4.1)
    drop = 0.39 / (1 + exp(max(-40, min(40, -(y - lip) * 14))))
    waves = (
        0.017
        * sin((12 + 0.7 * sin(3.7 * x)) * y + 4.8 * sin(5 * x + 0.88 * y))
        * exp(-0.29 * abs(y))
    )
    return (
        0.025
        + drop
        + waves
        + 0.013 * cos(y * 4.7 + x * 6.1) * sin(y * 2.3 - x * 2.8)
        + 0.007 * sin(22 * x + 1.1 * sin(9 * x + y)) * exp(-0.58 * abs(y))
    )


def grid(name, rows, mat):
    n = len(rows[0])
    faces = [
        (i, i + 1, i + 1 + n, i + n)
        for j in range(len(rows) - 1)
        for i in range(j * n, (j + 1) * n - 1)
    ]
    ob = mesh(name, [v for row in rows for v in row], faces, mat, "bank")
    for f in ob.data.polygons:
        f.use_smooth = True
    if mat == snow:
        verts = np.array(rows, dtype=np.float32).reshape(-1, 3)
        indices = np.empty(len(ob.data.loops), np.int32)
        ob.data.loops.foreach_get("vertex_index", indices)
        uv = ob.data.uv_layers.new(name="Crust")
        uv.data.foreach_set("uv", (verts[indices, :2] * 0.67).ravel())
    return ob


def bed_height(x, y):
    scour = (
        0.044 * sin(0.5 * x + y * 0.9)
        + 0.026 * cos(2.5 * x + 1.4 * y)
        + 0.013 * sin(5 * y + x) * sin(x * 3)
    )
    shoulder = 0.31 * exp(-(((y - wall(x)) / 1.1) ** 2)) * min(1, abs(x) * 0.9)
    # A measured windpack catches the left bank and wraps the plate feet.
    wind = 0.14 * exp(-(((x + 1.6) / 1.5) ** 2)) * exp(-(((y + 3) / 2.5) ** 2))
    apron = 0.48 * exp(-(((y + 3.65) / 1.32) ** 2)) * exp(-(((x + 1.3) / 1.85) ** 2))
    return 0.14 + scour + shoulder + wind + apron


cache = Path.home() / ".t3/portfolio-redesign-v4/assets-src"
with zipfile.ZipFile(cache / "Snow009A_2K-JPG.zip") as arc:
    relief = (
        np.asarray(
            Image.open(
                io.BytesIO(arc.read("Snow009A_2K-JPG_Displacement.jpg"))
            ).convert("L"),
            np.float32,
        )
        / 255
    )

for side in (-1, 1):
    rows = []
    for i in range(281):
        y = -18 + i * 0.18
        row = []
        for j in range(81):
            off = j * 0.19
            x = stream(y) + side * (width(y) + off)
            h = (
                bed_height(x, y)
                - 0.13 * exp(-off * 7)
                + 0.097
                * (
                    relief[
                        int((y * 0.21 + x * 0.07) % 1 * 2047),
                        int((x * 0.19 - y * 0.08) % 1 * 2047),
                    ]
                    - 0.5
                )
            )
            row.append((x, y, h))
        rows.append(row if side > 0 else row[::-1])
    grid("Settled snow", rows, snow)
rows = []
for i in range(460):
    y = -18 + i * 0.052
    rows.append(
        [
            (x, y, spill(x, y))
            for x in [stream(y) + width(y) * u / 25 for u in range(-26, 27)]
        ]
    )
grid("Watercourse", rows, water)
for k in range(95):
    x = rng.uniform(-0.32, 0.64)
    y = rng.uniform(-0.40, 0.18)
    length = rng.uniform(0.022, 0.21)
    rows = []
    for i in range(8):
        f = i / 7
        u = x + length * f
        v = y + 0.026 * sin(f * 3 + 0.8 * x) + 0.04 * sin(11 * u - 5 * y)
        w = 0.002 + 0.012 * sin(f * math.pi)
        rows.append([(u, v + d, spill(u, v + d) + 0.007) for d in (-w, w)])
    grid("Broken foam", rows, foam)

# Thin, backlit river mist closes the distant sightline.
if not args.clay:
    # Broken trains entrain air over the lip and disappear into the lower pool.
    foamwash = surface("Air inside the falling water", (0.16, 0.34, 0.34), 0.21)
    foamwash.pass_index = 1
    for k in range(55):
        x = rng.gauss(0.07, 0.19)
        start = rng.uniform(0.20, 0.64)
        stop = rng.uniform(-0.12, 0.30)
        rows = []
        for j in range(13):
            t = j / 12
            y = start + (stop - start) * t
            u = x + 0.014 * sin(12 * y + 21 * x) + 0.009 * sin(t * 5 + x)
            w = 0.001 + rng.uniform(0.001, 0.008) * sin(t * math.pi)
            rows.append([(u + d, y, spill(u + d, y) + 0.006) for d in (-w, w)])
        grid("Foam dragged through the lip", rows, foamwash)
    # Snow ridges beyond the eastern wall recede into the same river mist.
    ranges = surface("Glacial moraine", (0.38, 0.49, 0.50), 0.91)
    # Close the terrain underneath all far ridges. Wind-driven mist obscures
    # its distant foot and open water never meets an artificial mesh edge.
    grid(
        "Distant continuous snowpack",
        [[(-250, 8, -0.21), (250, 8, -0.21)], [(-250, 290, -0.21), (250, 290, -0.21)]],
        snow,
    )
    # Scattered eastern light raises the foothills to the fog's local value.
    diffuse = ranges.node_tree.nodes["Principled BSDF"]
    diffuse.inputs["Emission Color"].default_value = (
        (0.26, 0.31, 0.34, 1) if args.night else (0.51, 0.55, 0.54, 1)
    )
    diffuse.inputs["Emission Strength"].default_value = 0.36 if args.night else 0.82
    for j in range(3):
        yy = 48 + 13 * j
        rows = [[], [], []]
        for i in range(185):
            xx = -40 + i * 0.57
            hill = (
                1.3
                + 0.59 * sin(xx * 0.19 + j * 2.1)
                + 0.22 * sin(xx * 0.76 + j)
                + 0.10 * cos(xx * 1.9)
            )
            rows[0].append((xx, yy - 4, -0.1))
            rows[1].append((xx, yy, hill * (1 + 0.27 * j)))
            rows[2].append((xx, yy + 3, -0.2))
        grid("Far moraine", rows, ranges)
    bpy.ops.mesh.primitive_cube_add(size=2, location=(5, 28, 3))
    ob = bpy.context.object
    ob.scale = (39, 27, 6)
    fog = bpy.data.materials.new("Valley haze")
    fog.use_nodes = True
    tree = fog.node_tree
    tree.nodes.remove(tree.nodes["Principled BSDF"])
    medium = tree.nodes.new("ShaderNodeVolumeScatter")
    medium.inputs["Density"].default_value = 0.019
    medium.inputs["Anisotropy"].default_value = 0.52
    medium.inputs["Color"].default_value = (0.69, 0.85, 0.91, 1)
    tree.links.new(medium.outputs[0], tree.nodes["Material Output"].inputs["Volume"])
    ob.data.materials.append(fog)
    layers["bank"].append(ob)

    # A continuous bank of illuminated spray meets the cirrus behind the
    # cleft. No sight line through the throat reaches the incidental horizon.
    mistmat = bpy.data.materials.new("Suspended ice crystals at the breach")
    mistmat.use_nodes = True
    mt = mistmat.node_tree
    mt.nodes.remove(mt.nodes["Principled BSDF"])
    coord = mt.nodes.new("ShaderNodeTexCoord")
    delta = mt.nodes.new("ShaderNodeVectorMath")
    delta.operation = "DISTANCE"
    delta.inputs[1].default_value = (0.5, 0.5, 0.5)
    mt.links.new(coord.outputs["Generated"], delta.inputs[0])
    profile = mt.nodes.new("ShaderNodeMapRange")
    profile.interpolation_type = "SMOOTHERSTEP"
    profile.inputs["From Min"].default_value = 0.06
    profile.inputs["From Max"].default_value = 0.50
    profile.inputs["To Min"].default_value = 1
    profile.inputs["To Max"].default_value = 0
    mt.links.new(delta.outputs["Value"], profile.inputs[0])
    glow = mt.nodes.new("ShaderNodeVolumePrincipled")
    mt.links.new(profile.outputs[0], glow.inputs["Density"])
    mt.links.new(profile.outputs[0], glow.inputs["Emission Strength"])
    glow.inputs["Emission Color"].default_value = (
        (13, 10.3, 7.2, 1) if not args.night else (5.1, 6.1, 7.2, 1)
    )
    mt.links.new(glow.outputs[0], mt.nodes["Material Output"].inputs["Volume"])
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0.1, 5.5, 1.18))
    steam = bpy.context.object
    steam.scale = (2.6, 2.3, 1.95)
    steam.data.materials.append(mistmat)
    layers["bank"].append(steam)

bpy.ops.object.camera_add()
cam = bpy.context.object
scene.camera = cam
cam.location = (0.06, -args.distance, args.height)
cam.data.angle = math.radians(38)
aim = Vector((args.aim, 0, 0.63 if not args.phone else 0.42))
cam.rotation_euler = (aim - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.rotation_euler.rotate_axis("Z", math.radians(args.roll))
if args.push:
    cam.location += args.push * (Vector((0.12, 0.2, 1.15)) - cam.location)
bpy.context.view_layer.update()


def render(path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


render(out)
if args.layers:
    # Unseen layers continue to cast shadows, refract and reflect in the
    # remaining beauty. This supplies the hidden colour needed at cut edges.
    for layer in ("bank", "jaw", "near"):
        for name, objects in layers.items():
            for obj in objects:
                ground = name == "bank" and obj.name.startswith(
                    ("Settled snow", "Watercourse", "Distant continuous snowpack")
                )
                obj.is_holdout = layer != "bank" and ground
                obj.visible_camera = name == layer or obj.is_holdout
        scene.render.film_transparent = layer != "bank"
        if layer == "bank":
            scene.use_nodes = True
            vl = scene.view_layers[0]
            vl.use_pass_material_index = True
            ct = scene.node_tree
            aux = ct.nodes.new("CompositorNodeOutputFile")
            aux.base_path = str(out.parent)
            aux.file_slots[0].path = out.stem + "-water-"
            aux.file_slots[0].save_as_render = False
            ct.links.new(ct.nodes["Render Layers"].outputs["IndexMA"], aux.inputs[0])
        render(out.with_stem(out.stem + "-" + layer))
        scene.use_nodes = False

    # Fit reciprocal camera depth to image coordinates for each proxy plane.
    def project(v):
        q = world_to_camera_view(scene, cam, Vector(v))
        return [float(q.x), 1 - float(q.y), float(q.z)]

    def plane(points):
        a = np.array([project(p) for p in points])
        return np.linalg.solve(
            np.column_stack((a[:, :2], np.ones(3))), 1 / a[:, 2]
        ).tolist()

    focus = project((0.12, 0.20, 1.15))
    meta = dict(
        focus=focus[:2],
        near=plane([(-1.5, -0.6, 0), (-2.8, -2.35, 0), (-1.5, -0.6, 3)]),
        jaw=plane([(1.3, 1.85, 0), (3, 4.7, 0), (1.3, 1.85, 3)]),
        ground=plane([(0, 0, 0.11), (2, 0, 0.11), (0, -3, 0.11)]),
    )
    out.with_suffix(".json").write_text(json.dumps(meta, indent=2))
