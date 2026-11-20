"""Standing river ice in metres. Cycles beauty and independently visible projection layers."""

import argparse
import json
import math
import random
import io
import zipfile

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, zoom
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
parser.add_argument(
    "--survey-only",
    action="store_true",
    help="Update camera planes without rendering the plates.",
)
parser.add_argument("--slope", type=float, default=0.52)
parser.add_argument("--distance", type=float, default=38)
parser.add_argument("--aim", type=float, default=-3.45)
parser.add_argument("--height", type=float, default=2.52)
parser.add_argument("--crest", type=float, default=1)
parser.add_argument("--breakage", type=float, default=1)
parser.add_argument("--roll", type=float, default=-2)
parser.add_argument("--debris", type=float, default=1)
parser.add_argument("--target-z", type=float, default=0.25)
parser.add_argument("--push", type=float, default=0)

parser.add_argument("--flux", type=float, default=16)
parser.add_argument("--sun-z", type=float, default=3.19)
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
source = Vector((0, 1, 0.005)).normalized()
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
    light(rear, (0, 2.3, 2.5), (0, 0, 0.8))
    # Broad sky radiance on the snow tongue below the words.
    fill = bpy.data.lights.new("Sky returned by the snow", "AREA")
    fill.energy = 2300 if args.night else 10700
    fill.color = (0.58, 0.71, 1) if args.night else (0.88, 0.94, 1)
    fill.shape = "DISK"
    fill.size = 23
    light(fill, (-6, -16, 13), (-6, -13, 0))
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
    axis.inputs[1].default_value = 0.045
    wt.links.new(split.outputs["X"], axis.inputs[2])
    wt.links.new(axis.outputs[0], axial.inputs[0])
    band = wt.nodes.new("ShaderNodeMapRange")
    band.inputs["From Min"].default_value = 0.055
    band.inputs["From Max"].default_value = 1.04
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
    mix.inputs[0].default_value = 0.40
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


# All seven stations are sawn from the same sheet. The fifth station's
# footprint is open and its three matching fragments lie downstream.
heading = math.atan(args.slope)
pitch = 3.46
step = Vector((cos(heading), sin(heading), 0))
normal = Vector((-sin(heading), cos(heading), 0))


def wall(x):
    return args.slope * x


def ice_window(material, seed):
    """A continuous scan window with an independently surveyed plane of air."""
    local = np.random.default_rng(seed)
    tree = material.node_tree
    tex = next(n for n in tree.nodes if n.type == "TEX_IMAGE")
    source_path = Path(tex.image.filepath)
    # Meter-long striations run obliquely across the cut. Use separate,
    # non-repeating regions of the CC0 ice and snow scans for their two scales.
    cache = Path.home() / ".t3/portfolio-redesign-v4/assets-src"
    cloud = (
        np.asarray(Image.open(cache / source_path.name).convert("L"), np.float32) / 255
    )
    frost = (
        np.asarray(Image.open(cache / "snow_02_disp_2k.jpg").convert("L"), np.float32)
        / 255
    )
    size = 1024
    v, u = np.mgrid[0 : 1 : complex(size), 0 : 1 : complex(size)].astype(np.float32)
    angle = local.uniform(-1.25, 1.25)
    along = (u - 0.5) * cos(angle) + (v - 0.5) * sin(angle)
    across = (v - 0.5) * cos(angle) - (u - 0.5) * sin(angle)
    bend = zoom(local.uniform(-1, 1, (8, 8)).astype(np.float32), size / 8, order=3)

    def window(source, x, y):
        return map_coordinates(
            source,
            [y * (source.shape[0] - 1), x * (source.shape[1] - 1)],
            order=1,
            mode="reflect",
        )

    large = window(
        cloud,
        local.uniform(0.27, 0.73) + 0.40 * along + 0.08 * bend,
        local.uniform(0.27, 0.73) + 0.33 * across,
    )
    sheet = window(
        cloud,
        local.uniform(0.25, 0.75) + 0.85 * along + 0.08 * bend,
        0.5 + 0.16 * across + 0.09 * bend,
    )
    grain = window(frost, 0.5 + 0.76 * u - 0.19 * v, 0.58 - 0.18 * u + 0.60 * v)
    strata = 0.5 + 0.5 * np.tanh(
        6 * (across + 0.085 * bend - local.uniform(-0.18, 0.18))
    )
    field = np.clip(
        0.11 + 0.52 * large + 0.22 * sheet + 0.38 * (grain - 0.36) + 0.16 * strata, 0, 1
    )
    image = bpy.data.images.new(
        f"Unwrapped cut {seed}", width=size, height=size, alpha=False
    )
    image.colorspace_settings.name = "Non-Color"
    pixels = np.ones((size, size, 4), np.float32)
    pixels[:, :, :3] = (
        np.clip(0.46 + 1.76 * (field[:, :, None] - 0.46), 0.04, 0.98) ** 2.2
    )
    image.pixels.foreach_set(pixels.ravel())
    image.update()
    tex.image = image
    tex.extension = "EXTEND"
    split = tree.nodes.new("ShaderNodeSeparateXYZ")
    coord = tree.nodes.new("ShaderNodeTexCoord")
    tree.links.new(coord.outputs["Generated"], split.inputs[0])
    xy = tree.nodes.new("ShaderNodeCombineXYZ")
    tree.links.new(split.outputs["X"], xy.inputs[0])
    tree.links.new(split.outputs["Z"], xy.inputs[1])
    tree.links.new(xy.outputs[0], tex.inputs[0])
    satin = tree.nodes.get("Diffuse BSDF.001")
    tint = tree.nodes.new("ShaderNodeValToRGB")
    tint.color_ramp.elements[0].position = 0.065
    tint.color_ramp.elements[0].color = (0.028, 0.081, 0.097, 1)
    tint.color_ramp.elements[1].position = 0.49
    tint.color_ramp.elements[1].color = (0.25, 0.38, 0.39, 1)
    tree.links.new(tex.outputs["Color"], tint.inputs[0])
    tree.links.new(tint.outputs[0], satin.inputs["Color"])


def sawn(name, outline, thickness, center, angles, group, seed):
    local = random.Random(seed)
    n = len(outline)
    cx = sum(u for u, v in outline) / n
    cz = sum(v for u, v in outline) / n
    # Narrow shear steps chip the shoulder of the bevel. Keep the sawn
    # front flat and concentrate broken geometry at the exposed rim.
    chipped = []
    for i, (x, z) in enumerate(outline):
        xx, zz = outline[(i + 1) % n]
        chipped.append((x, z))
        if max(z, zz) > cz and abs(x - xx) > 0.22:
            t = local.uniform(0.36, 0.74)
            for a, chip in [(t - 0.06, 0.0), (t, 0.035), (t + 0.11, 0.013)]:
                chipped.append((x + (xx - x) * a, z + (zz - z) * a - chip))
    outline = chipped
    n = len(outline)
    rings = []
    for depth, inset in [(-0.5, 0.975), (-0.45, 1), (0.41, 1), (0.5, 0.966)]:
        rings.extend(
            (
                cx + (x - cx) * inset,
                thickness * depth
                + (local.uniform(-0.028, 0.028) if abs(depth) < 0.5 else 0),
                cz + (z - cz) * inset,
            )
            for x, z in outline
        )
    faces = [tuple(range(n)), tuple(reversed(range(3 * n, 4 * n)))]
    faces += [
        (r * n + i, (r + 1) * n + i, (r + 1) * n + (i + 1) % n, r * n + (i + 1) % n)
        for r in range(3)
        for i in range(n)
    ]
    ob = mesh(name, rings, faces, ice, group)
    ob.location = center
    ob.rotation_euler = angles
    if args.clay:
        return
    if name != "Heaved collar":
        # Every full face occupies one unique, unwrapped window of the ice
        # scan. Keep the lake's scattering, frost, absorption and light graph.
        variant = ice.copy()
        ob.data.materials[0] = variant
        ice_window(variant, seed)
        # Use a different position in the continuous volume for each cut.
        # Object-space noise restarted at the local origin would stamp every
        # neighbour with the same saw-face grain.
        tree = variant.node_tree
        world = tree.nodes.new("ShaderNodeNewGeometry")
        for node in list(tree.nodes):
            if node.type == "TEX_COORD":
                for link in list(node.outputs["Object"].links):
                    tree.links.new(world.outputs["Position"], link.to_socket)
        # Ice in the unbroken wall is thicker than the glyphs. Turn down
        # their rim return on thick faces and let light enter at the opening.
        body = tree.nodes.get("Math.005")
        factor = (
            (0.45 if args.night else 0.74)
            if abs(center[0]) < 3.5
            else (0.19 if args.night else 0.34)
        )
        body.inputs[1].default_value *= factor
        body.inputs[2].default_value *= factor
        # Only the two exposed endgrain faces receive the east light directly.
        signed = tree.nodes.new("ShaderNodeVectorMath")
        signed.operation = "DOT_PRODUCT"
        signed.inputs[1].default_value = step
        tree.links.new(world.outputs["Position"], signed.inputs[0])
        ab = tree.nodes.new("ShaderNodeMath")
        ab.operation = "ABSOLUTE"
        tree.links.new(signed.outputs["Value"], ab.inputs[0])
        taper = tree.nodes.new("ShaderNodeMapRange")
        taper.interpolation_type = "SMOOTHERSTEP"
        taper.inputs["From Min"].default_value = 1.65
        taper.inputs["From Max"].default_value = 2.40
        taper.inputs["To Min"].default_value = 2.65 if args.night else 2.0
        taper.inputs["To Max"].default_value = 0.76
        tree.links.new(ab.outputs[0], taper.inputs[0])
        through = tree.nodes.get("Emission").inputs["Strength"]
        base = through.links[0].from_socket
        lit = tree.nodes.new("ShaderNodeMath")
        lit.operation = "MULTIPLY"
        tree.links.new(base, lit.inputs[0])
        tree.links.new(taper.outputs[0], lit.inputs[1])
        tree.links.new(lit.outputs[0], through)
        # The spatial variation of cloud should live inside the sawn face.
        # A saw leaves a comparatively even, translucent satin outer skin.
        satin = tree.nodes["Map Range.006"]
        satin.inputs["From Min"].default_value = -0.94
        satin.inputs["From Max"].default_value = -0.40
        satin.inputs["To Min"].default_value = 0.53 if args.night else 0.66
    ob.data.materials.append(snow)
    for face in ob.data.polygons[2:]:
        if (
            ob.rotation_euler.to_matrix() @ face.normal
        ).z > 0.78 and local.random() < 0.61:
            face.material_index = 1
    # A unique, connected fracture fan and smaller air lenses inside each cut.
    span = max(x for x, z in outline) - min(x for x, z in outline)
    rise = max(z for x, z in outline) - min(z for x, z in outline)
    for k in range(1 if name == "Heaved collar" else 7):
        u = cx + local.uniform(-0.20, 0.20) * span
        z = (
            max(v for u, v in outline) + min(v for u, v in outline)
        ) * 0.5 + local.uniform(-0.18, 0.18) * rise
        dx = span * local.uniform(0.086, 0.24)
        dz = rise * local.uniform(0.025, 0.09)
        tilt = local.uniform(-1.3, 1.3)
        vertices = [(u, -thickness * 0.34, z)]
        for i in range(9):
            angle = i * math.tau / 9
            a = dx * cos(angle) * local.uniform(0.79, 1.08)
            b = dz * sin(angle)
            vertices.append(
                (
                    u + a * cos(tilt) - b * sin(tilt),
                    -thickness * (0.3 + local.uniform(-0.13, 0.13)),
                    z + a * sin(tilt) + b * cos(tilt),
                )
            )
        lens = mesh(
            "Sealed shear fan",
            vertices,
            [(0, i + 1, (i + 1) % 9 + 1) for i in range(9)],
            fault,
            group,
        )
        lens.parent = ob
    if name == "Standing slab":
        # Two long air sheets follow different dips, closing to hairlines
        # inside the face. Their tapered ends stay inside the sawn perimeter.
        for sign in (-1, 1):
            dz = local.uniform(0.50, 0.87) * sign
            x0 = local.uniform(-0.43, 0.06) * span
            z0 = local.uniform(0.33, 0.63) * rise
            verts = []
            for k in range(25):
                t = k / 24
                x = x0 + t * span * 0.43
                z = z0 + t * dz + 0.024 * sin(t * 5.7 + seed)
                opening = sin(math.pi * t) * local.uniform(0.039, 0.076)
                verts.extend(
                    [
                        (x, -thickness * 0.43, z),
                        (
                            x + 0.4 * opening,
                            -thickness * 0.43 + opening,
                            z + 0.32 * opening,
                        ),
                    ]
                )
            ribbon = mesh(
                "Air sheet meeting the sawn face",
                verts,
                [(k, k + 1, k + 3, k + 2) for k in range(0, 48, 2)],
                fault,
                group,
            )
            ribbon.parent = ob


for index, meters in zip((-4, -3, -2, -1, 1, 2), (3.44, 3.99, 3.36, 3.89, 3.62, 3.41)):
    shape = random.Random(2027 + index)
    w = (pitch - 0.035) / 2
    h = meters * args.crest
    top = [
        (w, h - shape.uniform(0.19, 0.45)),
        (w - shape.uniform(0.13, 0.41), h + shape.uniform(-0.09, 0.12)),
    ]
    heights = [shape.uniform(-0.24, 0.14) * args.breakage for _ in range(4)]
    top += [(w * f, h + d) for f, d in zip((0.69, 0.21, -0.34, -0.79), heights)]
    top += [(-w + 0.07, h - 0.11), (-w, h - 0.24)]
    outline = [(-w, -0.26), (w - 0.04, -0.26), (w, 0.02)] + top
    origin = step * (index * pitch) + normal * shape.uniform(-0.08, 0.08)
    sawn(
        "Standing slab",
        outline,
        shape.uniform(0.64, 0.79),
        origin,
        (
            shape.uniform(-0.025, 0.025),
            shape.uniform(-0.012, 0.012),
            heading + shape.uniform(-0.018, 0.018),
        ),
        "jaw",
        230 + index,
    )
    # Low wedge-shaped ice collars straddle the contact line in the snow.
    for j in range(11):
        s = shape.uniform(0.16, 0.61)
        x = origin + step * shape.uniform(-w, w) - normal * shape.uniform(0.25, 0.74)
        sawn(
            "Heaved collar",
            [
                (-s, -0.14),
                (s * 0.8, -0.11),
                (s * 0.69, 0.10 + s * 0.26),
                (-s * 0.53, 0.15 + s * 0.21),
            ],
            s * 0.48,
            x,
            (
                shape.uniform(-0.5, 0.4),
                shape.uniform(-0.2, 0.2),
                heading + shape.uniform(-0.8, 0.8),
            ),
            "jaw",
            index * 73 + j,
        )

# Three pieces reproduce the shared, asymmetrical shear lines of the absent slab.
a = [(-1.68, -0.62), (-0.49, -0.38), (0.36, -0.57), (1.68, -0.24)]
b = [(-1.68, 0.54), (-0.72, 0.69), (0.60, 0.37), (1.68, 0.75)]
parts = [
    [(-1.62, -1.7), (1.62, -1.71)] + a[::-1],
    a + b[::-1],
    b + [(1.64, 1.59), (0.37, 1.76), (-1.60, 1.56)],
]
for j, (outline, (xx, yy, zz, tip, turn)) in enumerate(
    zip(
        parts,
        [
            (-1.11, -1.59, 0.21, 1.04, 0.32),
            (1.52, -3.45, 0.12, 1.41, -0.40),
            (-0.98, -5.92, 0.19, 1.14, 0.44),
        ],
    )
):
    mid = (min(z for x, z in outline) + max(z for x, z in outline)) * 0.5
    outline = [(x, z - mid) for x, z in outline]
    sawn(
        "Fallen third",
        outline,
        0.67,
        (xx * args.debris, yy * args.debris, zz),
        (tip, (-0.095, 0.14, -0.065)[j], heading + turn),
        "near",
        673 + j,
    )


def stream(y):
    return 0.04 - y * 0.04 + 0.07 * max(0, -y - 4) + 0.25 * sin(y * 0.43)


def width(y):
    return max(0, min(1.55, (y + 16) * 0.32, (7 - y) * 0.5)) + 0.10 * exp(
        -0.04 * y * y
    ) * cos(y * 1.3)


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
    apron = 0.17 * exp(-(((y + 3.65) / 1.32) ** 2)) * exp(-(((x + 1.3) / 1.85) ** 2))
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

# Wind strips powder along the lead, exposing consolidated blue-black ice.
# The western snow tongue carries the station text over the whole flight.
bank = snow.copy()
if not args.clay:
    tree = bank.node_tree
    outmat = tree.nodes.get("Material Output")
    original = outmat.inputs["Surface"].links[0].from_socket
    sheet = tree.nodes.new("ShaderNodeBsdfPrincipled")
    sheet.inputs["Base Color"].default_value = (0.027, 0.065, 0.073, 1)
    sheet.inputs["Roughness"].default_value = 0.37
    sheet.inputs["IOR"].default_value = 1.31
    split = tree.nodes.new("ShaderNodeAttribute")
    split.attribute_name = "Scour"
    blend = tree.nodes.new("ShaderNodeMixShader")
    normal_map = next(n for n in tree.nodes if n.type == "NORMAL_MAP")
    tree.links.new(normal_map.outputs[0], sheet.inputs["Normal"])
    tree.links.new(split.outputs["Fac"], blend.inputs[0])
    tree.links.new(original, blend.inputs[1])
    tree.links.new(sheet.outputs[0], blend.inputs[2])
    tree.links.new(blend.outputs[0], outmat.inputs["Surface"])

for side in (-1, 1):
    rows = []
    for i in range(345):
        y = -48 + i * 0.24
        row = []
        for j in range(81):
            off = j * 0.35
            x = stream(y) + side * (width(y) + off)
            h = (
                bed_height(x, y)
                - 0.13 * min(1, width(y) * 3) * exp(-off * 7)
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
    shore = grid("Settled snow", rows, snow)
    shore.data.materials[0] = bank
    xyz = np.asarray(rows, np.float32).reshape(-1, 3)
    xx, yy = xyz[:, :2].T
    center = 0.04 - 0.04 * yy + 0.07 * np.maximum(0, -yy - 4) + 0.25 * np.sin(0.43 * yy)
    distance = np.abs(xx - center)
    edge_scan = relief[
        ((yy * 0.073 + xx * 0.012) % 1 * 2047).astype(int),
        ((xx * 0.048 - yy * 0.019) % 1 * 2047).astype(int),
    ]
    # The western bank lies in the lee of the standing wall. Keep its
    # continuous mantle up to the liquid edge. Only the exposed eastern
    # shelf sheds enough powder to show broad sheets of consolidated ice.
    contour = (
        0.24 + 0.40 * edge_scan
        if side < 0
        else 2.8 + 1.55 * np.sin(yy * 0.31) + 2.1 * edge_scan
    )
    # The black ice thins into discrete scoured patches at the downstream end.
    apron = np.clip((yy + 20) / 5, 0, 1) * np.clip((7 - yy) / 3, 0, 1)
    amount = (
        np.clip((contour - distance) * 1.65 + 1.6 * (edge_scan - 0.5), 0, 1) * apron
    )
    attr = shore.data.attributes.new("Scour", "FLOAT", "POINT")
    attr.data.foreach_set("value", np.asarray(amount, dtype=np.float32))
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
        (0.36, 0.43, 0.50, 1) if args.night else (0.66, 0.70, 0.72, 1)
    )
    diffuse.inputs["Emission Strength"].default_value = 0.39 if args.night else 1.12
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
            rows[1].append((xx, yy, hill * (0.34 + 0.10 * j) - 0.28))
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
    medium.inputs["Density"].default_value = 0.008
    medium.inputs["Anisotropy"].default_value = 0.52
    medium.inputs["Color"].default_value = (0.69, 0.85, 0.91, 1)
    tree.links.new(medium.outputs[0], tree.nodes["Material Output"].inputs["Volume"])
    ob.data.materials.append(fog)
    layers["bank"].append(ob)

    # Keep backlit spray low so the sun remains distinct above the spill.
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
        (0.26, 0.24, 0.19, 1) if not args.night else (0.12, 0.18, 0.23, 1)
    )
    mt.links.new(glow.outputs[0], mt.nodes["Material Output"].inputs["Volume"])
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0.1, 5.5, 1.18))
    steam = bpy.context.object
    steam.scale = (2.9, 2.7, 0.89)
    steam.data.materials.append(mistmat)
    layers["bank"].append(steam)

    # A finite solar disc in the air above the far shore. Its physical angular
    # diameter survives the wide opening and remains behind the missing slab.
    glint = bpy.data.materials.new(
        "Low sun in ice haze" if not args.night else "Blue-hour afterglow"
    )
    glint.use_nodes = True
    tr = glint.node_tree
    tr.nodes.remove(tr.nodes["Principled BSDF"])
    coords = tr.nodes.new("ShaderNodeTexCoord")
    radius = tr.nodes.new("ShaderNodeVectorMath")
    radius.operation = "DISTANCE"
    radius.inputs[1].default_value = (0.5, 0.5, 0)
    tr.links.new(coords.outputs["UV"], radius.inputs[0])
    ramp = tr.nodes.new("ShaderNodeValToRGB")
    profile = ramp.color_ramp
    profile.elements.remove(profile.elements[1])
    for i, (t, value) in enumerate(
        (
            [
                (0, 1),
                (0.051, 0.99),
                (0.060, 0.14),
                (0.095, 0.05),
                (0.21, 0.009),
                (0.42, 0),
            ]
            if not args.night
            else [(0, 0.87), (0.065, 0.64), (0.18, 0.17), (0.34, 0.025), (0.5, 0)]
        )
    ):
        k = profile.elements.new(t) if i else profile.elements[0]
        k.color = (value, value, value, 1)
    profile.interpolation = "EASE"
    tr.links.new(radius.outputs["Value"], ramp.inputs[0])
    emit = tr.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (
        (1, 0.89, 0.69, 1) if not args.night else (0.62, 0.80, 1, 1)
    )
    emit.inputs["Strength"].default_value = args.flux * (1 if not args.night else 0.30)
    mix = tr.nodes.new("ShaderNodeMixShader")
    tr.links.new(ramp.outputs[0], mix.inputs[0])
    tr.links.new(tr.nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix.inputs[1])
    tr.links.new(emit.outputs[0], mix.inputs[2])
    tr.links.new(mix.outputs[0], tr.nodes["Material Output"].inputs[0])
    # Carry the distant glow in the bank projection with the surrounding sky.
    bpy.ops.mesh.primitive_plane_add(
        size=14, location=(0, 71, args.sun_z), rotation=(math.pi / 2, 0, 0)
    )
    solar = bpy.context.object
    solar.name = "Sun beyond the far bank"
    if args.night:
        solar.scale = (2.8, 0.43, 1)
    solar.visible_shadow = False
    solar.data.materials.append(glint)
    layers["bank"].append(solar)

bpy.ops.object.camera_add()
cam = bpy.context.object
scene.camera = cam
cam.location = (0, -args.distance, args.height)
cam.data.angle = math.radians(38)
aim = Vector((args.aim, 0, args.target_z))
cam.rotation_euler = (aim - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.rotation_euler.rotate_axis("Z", math.radians(args.roll))
if args.push:
    cam.location += args.push * (Vector((0.12, 0.2, 1.15)) - cam.location)
bpy.context.view_layer.update()


def render(path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


if args.layers or args.survey_only:
    # Fit reciprocal camera depth to image coordinates for each proxy plane.
    def project(v):
        q = world_to_camera_view(scene, cam, Vector(v))
        return [float(q.x), 1 - float(q.y), float(q.z)]

    def plane(points):
        a = np.array([project(p) for p in points])
        return np.linalg.lstsq(
            np.column_stack((a[:, :2], np.ones(len(a)))), 1 / a[:, 2], rcond=None
        )[0].tolist()

    # The fallen slab rises out of the river. Fitting the visible break
    # faces avoids stretching the upright edges down the ground plane.
    debris = [
        obj.matrix_world @ vertex.co
        for obj in layers["near"]
        if obj.parent is None
        for vertex in obj.data.vertices
    ]
    focus = project((0, 0, 1.55))
    meta = dict(
        focus=focus[:2],
        near=plane([v for v in debris if v.z > 0.05]),
        jaw=plane([(0, -0.33, 0), (4, wall(4) - 0.33, 0), (0, -0.33, 4)]),
        ground=plane([(0, 0, 0.11), (2, 0, 0.11), (0, -3, 0.11)]),
    )
    out.with_suffix(".json").write_text(json.dumps(meta, indent=2))

if args.survey_only:
    raise SystemExit(0)

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
