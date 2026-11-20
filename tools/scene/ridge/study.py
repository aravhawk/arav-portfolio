"""Cycles look development for the breach, in metres. Run with the lake bake venv."""

import argparse
import math
import random
import tempfile
import zipfile
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument("output", type=Path)
parser.add_argument("--width", type=int, default=960)
parser.add_argument("--samples", type=int, default=16)
parser.add_argument("--clay", action="store_true")
parser.add_argument("--phone", action="store_true")
args = parser.parse_args()
unpacked = tempfile.TemporaryDirectory()
rng = random.Random(611)
veils = random.Random(252)
cache = Path.home() / ".t3/portfolio-redesign-v4/assets-src"
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
scene.cycles.use_denoising = True
scene.render.resolution_x = args.width
scene.render.resolution_y = round(args.width * (844 / 390 if args.phone else 0.625))
scene.render.resolution_percentage = 100


def material(label, color, roughness, transmission=0):
    mat = bpy.data.materials.new(label)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    for key, value in {
        "Base Color": (*color, 1),
        "Transmission Weight": transmission,
        "Roughness": roughness,
        "IOR": 1.31,
    }.items():
        shader.inputs[key].default_value = value
    return mat


def scan(mat, filename, scale, distance):
    tree = mat.node_tree
    coord = tree.nodes.new("ShaderNodeTexCoord")
    mapping = tree.nodes.new("ShaderNodeVectorMath")
    mapping.operation = "SCALE"
    mapping.inputs["Scale"].default_value = scale
    tree.links.new(coord.outputs["Object"], mapping.inputs[0])
    tex = tree.nodes.new("ShaderNodeTexImage")
    path = cache / filename
    if filename.startswith("Ice"):
        path = Path(unpacked.name) / filename
        if not path.exists():
            archive = filename.split("_Color")[0] + ".zip"
            with zipfile.ZipFile(cache / archive) as source:
                path.write_bytes(source.read(filename))
    tex.image = bpy.data.images.load(str(path), check_existing=True)
    tex.projection = "BOX"
    tex.projection_blend = 0.18
    tree.links.new(mapping.outputs[0], tex.inputs[0])
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = distance
    tree.links.new(tex.outputs[0], bump.inputs["Height"])
    tree.links.new(bump.outputs[0], tree.nodes.get("Principled BSDF").inputs["Normal"])
    return tex


def mesh(label, verts, faces, mat):
    data = bpy.data.meshes.new(label)
    data.from_pydata(verts, [], faces)
    data.materials.append(mat)
    obj = bpy.data.objects.new(label, data)
    scene.collection.objects.link(obj)
    return obj


clay = material("Clay", (0.36, 0.36, 0.36), 0.8)
ice = material("Blue congelation ice", (0.65, 0.81, 0.83), 0.115, 0.94)
scan(ice, "Ice004_2K-JPG_Color.jpg", 0.50, 0.009)
snow = material("Wind packed grains", (0.77, 0.81, 0.81), 0.82)
scan(snow, "snow_02_diff_2k.jpg", 0.36, 0.045)
bed = material("Dark lake pane", (0.041, 0.051, 0.053), 0.335, 0.08)
scan(bed, "Ice003_2K-JPG_Color.jpg", 0.23, 0.016)
water = material("Open lead", (0.022, 0.038, 0.043), 0.175)
rime = material("Air along a shear", (0.68, 0.77, 0.78), 0.30, 0.79)
scan(rime, "Ice003_2K-JPG_Color.jpg", 1.2, 0.018)

air = material("Partly healed fracture", (0.72, 0.77, 0.76), 0.27, 0.36)
tr = air.node_tree
tex = scan(air, "Ice004_2K-JPG_Color.jpg", 1.81, 0.009)
mix_air = tr.nodes.new("ShaderNodeMixShader")
tr.links.new(tex.outputs[0], mix_air.inputs[0])
tr.links.new(tr.nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix_air.inputs[1])
tr.links.new(tr.nodes.get("Principled BSDF").outputs[0], mix_air.inputs[2])
tr.links.new(mix_air.outputs[0], tr.nodes.get("Material Output").inputs[0])

frost_texture = bpy.data.textures.new("Fractured plane", type="CLOUDS")
frost_texture.noise_scale = 0.18
frost_texture.noise_depth = 2


# Snow thins over the dark bed where the wind has lowered its height.
tr = snow.node_tree
separate = tr.nodes.new("ShaderNodeSeparateXYZ")
tr.links.new(
    tr.nodes.new("ShaderNodeNewGeometry").outputs["Position"], separate.inputs[0]
)
coverage = tr.nodes.new("ShaderNodeMapRange")
coverage.inputs["From Min"].default_value = 0.033
coverage.inputs["From Max"].default_value = 0.13
coverage.interpolation_type = "SMOOTHERSTEP"
tr.links.new(separate.outputs["Z"], coverage.inputs[0])
settled = tr.nodes.new("ShaderNodeMixShader")
tr.links.new(coverage.outputs[0], settled.inputs[0])
tr.links.new(tr.nodes.new("ShaderNodeBsdfTransparent").outputs[0], settled.inputs[1])
tr.links.new(tr.nodes.get("Principled BSDF").outputs[0], settled.inputs[2])
tr.links.new(settled.outputs[0], tr.nodes.get("Material Output").inputs[0])


def plate(x, y, z, length, breadth, thick, dip):
    count = rng.randint(6, 10)
    outline = []
    for i in range(count):
        a = (i + rng.uniform(-0.22, 0.22)) * math.tau / count
        outline.append(
            (
                length * math.cos(a) * rng.uniform(0.82, 1),
                breadth * math.sin(a) * rng.uniform(0.8, 1),
            )
        )
    verts = [
        (u, v, h * thick * rng.uniform(0.8, 1.16))
        for h in (-0.5, 0.5)
        for u, v in outline
    ]
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces.extend(
        (i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)
    )
    obj = mesh("Rafted sheet", verts, faces, clay if args.clay else ice)
    obj.location = (x, y, z)
    obj.rotation_euler = (rng.uniform(-0.5, 0.5), dip, rng.uniform(-0.55, 0.55))
    bevel = obj.modifiers.new("Crumbled arris", "BEVEL")
    bevel.width = min(0.025, thick * 0.09)
    bevel.segments = 3
    tess = obj.modifiers.new("Resolve edge chips", "SUBSURF")
    tess.subdivision_type = "SIMPLE"
    tess.levels = tess.render_levels = 2
    chips = obj.modifiers.new("Irregular fracture lips", "DISPLACE")
    chips.texture = frost_texture
    chips.strength = min(0.072, thick * 0.21)
    obj.modifiers.new("Planar reflections", "WEIGHTED_NORMAL")
    if not args.clay:
        obj.data.materials.append(rime)
        bevel.material = 1
        for p in obj.data.polygons[2:]:
            if (p.index * 11 + count) % 8 < 3:
                p.material_index = 1

        # Tapered, discontinuous sheets of trapped air. Set them under
        # the surface so the face refracts them through its full thickness.
        for j in range(veils.randrange(2, 7) if thick > 0.17 else 0):
            cx = veils.uniform(-0.62, 0.62) * length
            cy = veils.uniform(-0.5, 0.5) * breadth
            dx = length * veils.uniform(0.09, 0.29)
            dy = breadth * veils.uniform(0.1, 0.32)
            z0 = veils.uniform(-0.31, 0.31) * thick
            ring = [
                (
                    cx + dx * math.cos(a),
                    cy + dy * math.sin(a),
                    z0 + 0.23 * thick * math.cos(a) + 0.15 * thick * math.sin(a),
                )
                for a in [i * math.tau / 7 for i in range(7)]
            ]
            fissure = mesh("Dipping air lens", ring, [tuple(range(7))], air)
            fissure.parent = obj


# Both jaws recede behind the notch. Long intact plates tilt over a toe
# of rubble, with the highest upright faces immediately beside the cut.
for side in (-1, 1):
    for k in range(57):
        d = k * 0.53
        x = 2.1 + side * (1.55 + d)
        y = 2.1 + 0.33 * d + 0.5 * math.sin(d * 0.7)
        crest = 0.85 + 1.28 * math.exp(-d / 4) + 0.36 * math.sin(d * 0.88)
        for layer in range(3):
            length = rng.uniform(1.1, 2.7)
            plate(
                x + side * 0.4 * length,
                y + layer * 0.89,
                rng.uniform(0.1, 0.5) + crest * layer * (0.65 if side == 1 else 0.4),
                length,
                rng.uniform(0.62, 1.7),
                rng.uniform(0.15, 0.59),
                side * (0.43 * math.cos(d * 0.85) + rng.uniform(-0.56, 0.91)),
            )
        for j in range(3):
            plate(
                x,
                y - rng.uniform(0.4, 2.9),
                rng.uniform(0.02, 0.30),
                rng.uniform(0.28, 1.05),
                rng.uniform(0.23, 0.83),
                rng.uniform(0.13, 0.34),
                rng.uniform(-0.78, 0.78),
            )

# At the windward toe a skirt of comminuted ice settles into the bank.
for j in range(1150):
    side = veils.choice((-1, 1))
    d = veils.uniform(0.1, 16)
    x = 2.1 + side * (1.3 + d)
    y = 0.06 + 0.33 * d + 0.5 * math.sin(d * 0.7) + veils.gauss(0, 0.58)
    size = 0.06 + veils.random() ** 3 * 0.27
    plate(
        x,
        y,
        0.19 + veils.uniform(-0.07, 0.075),
        size,
        size * veils.uniform(0.44, 0.87),
        size * 0.54,
        veils.uniform(-0.67, 0.67),
    )


def channel(y):
    return 2.1 - 0.21 * y + 0.30 * math.sin(y * 0.74)


def grid(label, rows, mat):
    cols = len(rows[0])
    faces = [
        (i, i + 1, i + 1 + cols, i + cols)
        for j in range(len(rows) - 1)
        for i in range(j * cols, (j + 1) * cols - 1)
    ]
    obj = mesh(label, [v for row in rows for v in row], faces, mat)
    for p in obj.data.polygons:
        p.use_smooth = True


grid(
    "Ice bed",
    [[(-150.0, y, 0.037), (150.0, y, 0.037)] for y in (-90.0, 120.0)],
    bed if not args.clay else clay,
)
rows = []
for k in range(451):
    y = -29 + k * 0.095
    spread = 1.05 + 0.045 * max(0, -y) + 0.17 * math.sin(y * 0.86)
    row = []
    for j in range(37):
        u = j / 18 - 1
        x = channel(y) + u * spread
        z = 0.034 + 0.28 / (
            1 + math.exp(max(-40, min(40, -(y - 2.15 - 0.09 * math.sin(x * 5)) * 14)))
        )
        z += (
            0.004 * math.sin(y * 31 + math.sin(y * 1.9 + x * 14) + math.cos(x * 3.2))
            + 0.018 * (1 - u**6)
            + 0.007
            * math.sin(y * 17 + u * u * 5 + math.sin(3 * u + y * 0.74))
            * math.cos(2.9 * u + y * 0.4)
        )
        row.append((x, y, z))
    rows.append(row)
grid("Spill over submerged sill", rows, water if not args.clay else clay)
for side in (-1, 1):
    rows = []
    for k in range(163):
        y = -22 + k * 0.26
        row = []
        for j in range(111):
            x = channel(y) + side * (1.34 + j * 0.22)
            h = (
                0.11
                + 0.13 * math.sin(x * 0.39 + y * 0.17)
                + 0.05 * math.sin(y * 1.1 + x * 0.76)
            )
            h += 0.19 * math.exp(-(((x + 3) / 3.1) ** 2) - ((y + 10) / 6) ** 2)
            h += 0.57 * math.exp(-(((y - 1.1 - abs(x - 2) * 0.31) / 1.25) ** 2))
            h += 0.095 * math.sin(y * 0.59 + x * 0.37) * math.sin(y * 0.96 - x * 0.45)
            h += 0.026 * math.sin(5 * x + math.sin(y * 1.6)) * math.cos(y * 3.4 + x)
            h += 0.023 * math.sin(
                y * 3 + x * 1.4 + math.sin(y * 0.9)
            ) + 0.012 * math.sin(y * 5 + x * 3.7)
            row.append((x, y, h - 0.29 * math.exp(-j * 0.28)))
        rows.append(row if side == 1 else row[::-1])
    grid("Scoured bank", rows, snow if not args.clay else clay)

world = bpy.data.worlds.new("Lake morning")
scene.world = world
world.use_nodes = True
tree = world.node_tree
env = tree.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(str(cache / "frozen_lake_2k.hdr"))
tree.links.new(env.outputs[0], tree.nodes.get("Background").inputs[0])
tree.nodes.get("Background").inputs[1].default_value = 0.72
# The illumination probe contains trees. Only indirect rays use it.
# A camera-visible dawn gradient meets the ranges in a low band of mist.
sky = tree.nodes.new("ShaderNodeBackground")
coords = tree.nodes.new("ShaderNodeTexCoord")
distance = tree.nodes.new("ShaderNodeVectorMath")
distance.operation = "DISTANCE"
distance.inputs[1].default_value = Vector((0.156, 1, 0.025)).normalized()
tree.links.new(coords.outputs["Generated"], distance.inputs[0])
ramp = tree.nodes.new("ShaderNodeValToRGB")
colors = [
    (0, (7.8, 7.0, 5.6)),
    (0.009, (4.2, 3.9, 3.3)),
    (0.037, (1.76, 1.62, 1.42)),
    (0.14, (1.09, 1.09, 1.05)),
    (0.52, (0.57, 0.69, 0.8)),
    (1, (0.38, 0.49, 0.61)),
]
for pt in list(ramp.color_ramp.elements)[1:]:
    ramp.color_ramp.elements.remove(pt)
for i, (tint, col) in enumerate(colors):
    e = ramp.color_ramp.elements.new(tint) if i else ramp.color_ramp.elements[0]
    e.color = (*col, 1)
tree.links.new(distance.outputs["Value"], ramp.inputs[0])
clouds = tree.nodes.new("ShaderNodeTexEnvironment")
clouds.image = bpy.data.images.load(str(cache / "wasteland_clouds_puresky_2k.hdr"))
veil = tree.nodes.new("ShaderNodeMixRGB")
veil.blend_type = "SOFT_LIGHT"
veil.inputs[0].default_value = 0.25
tree.links.new(ramp.outputs[0], veil.inputs[1])
tree.links.new(clouds.outputs[0], veil.inputs[2])
tree.links.new(veil.outputs[0], sky.inputs[0])
mix = tree.nodes.new("ShaderNodeMixShader")
tree.links.new(
    tree.nodes.new("ShaderNodeLightPath").outputs["Is Camera Ray"], mix.inputs[0]
)
tree.links.new(tree.nodes.get("Background").outputs[0], mix.inputs[1])
tree.links.new(sky.outputs[0], mix.inputs[2])
tree.links.new(mix.outputs[0], tree.nodes.get("World Output").inputs[0])
for k in range(3):
    y = 80 - k * 16
    haze = material("Far shore", (0.58 - 0.04 * k, 0.66 - 0.04 * k, 0.70 - 0.04 * k), 1)
    hshader = haze.node_tree.nodes.get("Principled BSDF")
    hshader.inputs["Emission Color"].default_value = (
        0.66 - 0.08 * k,
        0.70 - 0.07 * k,
        0.74 - 0.07 * k,
        1,
    )
    hshader.inputs["Emission Strength"].default_value = 1.3
    rows = [[], []]
    for j in range(351):
        x = -100 + j * 0.58
        h = (
            (
                0.9
                + 0.65 * math.sin(0.14 * x + k * 13)
                + 0.32 * math.cos(0.49 * x + 3 * k)
                + 0.1 * math.sin(1.4 * x)
            )
            * (3 - k)
            * 0.52
        )
        h += 0.14 * math.sin(x * 2.64 + k) * math.cos(x * 0.64) + 0.07 * math.sin(
            x * 4.9
        )
        rows[0].append((x, y, -1))
        rows[1].append((x, y, h))
    grid("Distant ridge", rows, haze)
bpy.ops.object.light_add(type="AREA", location=(2.1, 6, 4))
lamp = bpy.context.object
lamp.data.energy = 1050
lamp.data.shape = "DISK"
lamp.data.size = 3
receivers = bpy.data.collections.new("Ice receiving light from the sill")
scene.collection.children.link(receivers)
for ob in list(scene.objects):
    if ob.name.startswith(("Rafted sheet", "Dipping air lens", "Spill over")):
        receivers.objects.link(ob)
lamp.light_linking.receiver_collection = receivers
lamp.rotation_euler = (
    (Vector((2.1, 0.2, 0.35)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
)
# A bank of suspended ice crystals occupies the far shore. Set a soft
# density shoulder along the river so the dark channel remains legible.
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 18, 3))
mist = bpy.context.object
mist.scale = (80, 29, 5)
fog = bpy.data.materials.new("River steam")
fog.use_nodes = True
ft = fog.node_tree
ft.nodes.remove(ft.nodes.get("Principled BSDF"))
volume = ft.nodes.new("ShaderNodeVolumeScatter")
volume.inputs["Color"].default_value = (0.86, 0.91, 0.96, 1)
volume.inputs["Density"].default_value = 0.0075
volume.inputs["Anisotropy"].default_value = 0.32
ft.links.new(volume.outputs[0], ft.nodes.get("Material Output").inputs["Volume"])
mist.data.materials.append(fog)
# Only the narrow crest and the lower plunge carry air. The broken
# trains have individual lengths and phase instead of parallel white bars.
foam = material("Air at the sill", (0.75, 0.82, 0.81), 0.46, 0.23)
for k in range(420):
    x = 2.1 + veils.uniform(-0.94, 0.94)
    y = 1.96 + veils.gauss(0, 0.048) + 0.09 * math.sin(x * 5)
    z = 0.034 + 0.28 / (1 + math.exp(-(y - 2.15 - 0.09 * math.sin(x * 5)) * 14)) + 0.024
    length = veils.uniform(0.018, 0.095)
    w = veils.uniform(0.002, 0.011)
    mesh(
        "Air train",
        [
            (x - w, y, z),
            (x, y - length, z - 0.009),
            (x + w, y, z),
            (x, y + length * 0.65, z + 0.011),
        ],
        [(0, 1, 2, 3)],
        foam,
    )
bpy.ops.object.camera_add(location=(-1.12, -18.6, 1.98))
cam = bpy.context.object
scene.camera = cam
cam.data.lens = 46
cam.rotation_euler = (
    (Vector((2.05 if args.phone else -0.2, 2, 1.16)) - cam.location)
    .to_track_quat("-Z", "Y")
    .to_euler()
)
args.output.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(args.output.resolve())
bpy.ops.render.render(write_still=True)
