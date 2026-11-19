"""Render the O1 art proof from the repository root with Blender's Python module."""

import argparse
import math
import random
from pathlib import Path

import bpy
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("--width", type=int, default=2880)
parser.add_argument("--samples", type=int, default=64)
parser.add_argument("--output", default=".tools/out/o1/day.png")
args = parser.parse_args()
out = Path(args.output).resolve()
out.parent.mkdir(parents=True, exist_ok=True)
cache = Path.home() / ".t3/portfolio-redesign-v4/assets-src"
random.seed(421)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.refresh_devices()
for device in prefs.devices:
    device.use = device.type == "METAL"
scene.cycles.device = "GPU"
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.cycles.transparent_max_bounces = 8
scene.render.resolution_x = args.width
scene.render.resolution_y = round(args.width * 5 / 8)
scene.render.resolution_percentage = 100
scene.render.filepath = str(out)
scene.world = bpy.data.worlds.new("Winter light")
scene.world.use_nodes = True


def node(tree, kind, **values):
    n = tree.nodes.new(kind)
    for key, val in values.items():
        n.inputs[key].default_value = val
    return n


def wire(tree, a, output, b, inp):
    tree.links.new(a.outputs[output], b.inputs[inp])


def surface(name, color, roughness, **values):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    for key, value in {
        "Base Color": (*color, 1),
        "Roughness": roughness,
        **values,
    }.items():
        bs.inputs[key].default_value = value
    return mat, bs


def relief(mat, bs, scale, distance, strength):
    tree = mat.node_tree
    tex = node(tree, "ShaderNodeTexNoise", Scale=scale, Detail=4)
    coords = node(tree, "ShaderNodeTexCoord")
    wire(tree, coords, "Object", tex, "Vector")
    bump = node(tree, "ShaderNodeBump", Distance=distance, Strength=strength)
    wire(tree, tex, "Fac", bump, "Height")
    wire(tree, bump, "Normal", bs, "Normal")


def geometry(name, vertices, faces, material, smooth=True):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(material)
    if smooth:
        mesh.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=bool))
    return obj


def sheet(name, xs, ys, height, mat):
    width = len(xs)
    verts = [(x, y, height(x, y)) for y in ys for x in xs]
    faces = [
        (i, i + 1, i + width + 1, i + width)
        for j in range(len(ys) - 1)
        for k in range(width - 1)
        for i in [j * width + k]
    ]
    return geometry(name, verts, faces, mat)


tree = scene.world.node_tree
env = node(tree, "ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(str(cache / "frozen_lake_2k.hdr"))
bg = tree.nodes.get("Background")
wire(tree, env, "Color", bg, "Color")
bg.inputs["Strength"].default_value = 0.7

# A sky dome shares its horizon colour with the atmospheric mountain materials.
sky = bpy.data.materials.new("First light")
sky.use_nodes = True
tree = sky.node_tree
coord = node(tree, "ShaderNodeTexCoord")
sep = node(tree, "ShaderNodeSeparateXYZ")
wire(tree, coord, "Generated", sep, "Vector")
ramp = node(tree, "ShaderNodeValToRGB")
for element, pos, col in zip(
    ramp.color_ramp.elements,
    [0.49, 0.62],
    [(1.22, 1.27, 1.34, 1), (0.34, 0.42, 0.55, 1)],
):
    element.position = pos
    element.color = col
wire(tree, sep, "Z", ramp, "Fac")
em = node(tree, "ShaderNodeEmission")
# Angular falloff of the low sun and its halo, in the camera sky only.
geo = node(tree, "ShaderNodeNewGeometry")
direction = node(tree, "ShaderNodeVectorMath")
direction.operation = "NORMALIZE"
wire(tree, geo, "Position", direction, 0)
dist = node(tree, "ShaderNodeVectorMath")
dist.operation = "DISTANCE"
dist.inputs[1].default_value = Vector((0.101, 1, 0.068)).normalized()
wire(tree, direction, 0, dist, 0)
halo = node(tree, "ShaderNodeValToRGB")
halo.color_ramp.elements[0].color = (9, 8.6, 8.2, 1)
halo.color_ramp.elements[1].position = 0.09
halo.color_ramp.elements[1].color = (0, 0, 0, 1)
for t, val in [(0.005, 8), (0.009, 1.3), (0.024, 0.44)]:
    stop = halo.color_ramp.elements.new(t)
    stop.color = (val, val * 0.94, val * 0.87, 1)
wire(tree, dist, "Value", halo, "Fac")
add = node(tree, "ShaderNodeMixRGB", Fac=1)
add.blend_type = "ADD"
wire(tree, halo, 0, add, 1)
wire(tree, ramp, 0, add, 2)
wire(tree, add, 0, em, "Color")
wire(tree, em, "Emission", tree.nodes.get("Material Output"), "Surface")
bpy.ops.mesh.primitive_uv_sphere_add(radius=440)
dome = bpy.context.object
dome.data.materials.append(sky)
dome.visible_diffuse = dome.visible_glossy = dome.visible_shadow = (
    dome.visible_transmission
) = False


def n(x, y, z):
    return noise.noise_vector((x, y, z))[0]


snow_scan = (
    np.asarray(Image.open(cache / "snow_field_aerial_height_2k.jpg").convert("L")) / 255
)


def sampled(x, y):
    h, w = snow_scan.shape
    return snow_scan[int(y * 80) % h, int(x * 80) % w]


for layer, (depth, tint) in enumerate(
    [(78, (0.30, 0.37, 0.45)), (122, (0.52, 0.59, 0.68)), (192, (0.79, 0.85, 0.92))]
):
    mat, bs = surface("Glacial range " + str(layer), (0.48, 0.53, 0.58), 0.9)
    tree = mat.node_tree
    mix = node(tree, "ShaderNodeMixShader", Fac=[0.44, 0.70, 0.88][layer])
    mist = node(tree, "ShaderNodeEmission", Color=(*tint, 1))
    # Exposed rock on the steep headwalls, a snow bed in the gullies.
    hit = node(tree, "ShaderNodeNewGeometry")
    slope = node(tree, "ShaderNodeSeparateXYZ")
    wire(tree, hit, "Normal", slope, "Vector")
    ledges = node(tree, "ShaderNodeValToRGB")
    ledges.color_ramp.elements[0].position = 0.65
    ledges.color_ramp.elements[0].color = (0.075, 0.081, 0.095, 1)
    ledges.color_ramp.elements[1].position = 0.93
    ledges.color_ramp.elements[1].color = (0.75, 0.8, 0.84, 1)
    wire(tree, slope, "Z", ledges, 0)
    wire(tree, ledges, 0, bs, "Base Color")
    wire(tree, bs, 0, mix, 1)
    wire(tree, mist, 0, mix, 2)
    wire(tree, mix, 0, tree.nodes.get("Material Output"), "Surface")

    def mountain(x, y):
        v = y - depth
        spine = 4 * n(x * 0.055, layer, 3) + 2 * math.sin(x * 0.16 + layer)
        envelope = math.exp(-(((v - spine) / 8) ** 2))
        peaks = (
            5
            + 5 * layer
            + 4 * math.sin(x * 0.09 + layer * 3)
            + 2 * n(x * 0.12, 0, layer)
        )
        ridge = noise.ridged_multi_fractal(
            (x * 0.11, y * 0.18, layer * 2.23), 1, 2, 5, 1, 2
        )
        return -0.8 + 0.56 * envelope * (peaks + ridge * 2.7) + 0.21 * n(x, y, layer)

    sheet(
        mat.name,
        np.linspace(-100, 100, 621),
        np.linspace(depth - 24, depth + 20, 135),
        mountain,
        mat,
    )

# Ground-hugging veils dissolve the shoreline. Each has a different vertical
# profile; the near lake and all glyphs remain in front of both.
for depth, height, opacity in [(38, 1.8, 0.47), (57, 3.8, 0.72)]:
    haze = bpy.data.materials.new("Ice mist")
    haze.use_nodes = True
    tree = haze.node_tree
    pos = node(tree, "ShaderNodeNewGeometry")
    sep = node(tree, "ShaderNodeSeparateXYZ")
    wire(tree, pos, "Position", sep, 0)
    turb = node(tree, "ShaderNodeTexNoise", Scale=0.16, Detail=3)
    wire(tree, pos, "Position", turb, 0)
    offset = node(tree, "ShaderNodeMath")
    offset.operation = "ADD"
    wire(tree, sep, "Z", offset, 0)
    wire(tree, turb, "Fac", offset, 1)
    fade = node(tree, "ShaderNodeMapRange")
    fade.interpolation_type = "SMOOTHERSTEP"
    fade.inputs["From Min"].default_value = 0.55
    fade.inputs["From Max"].default_value = height
    fade.inputs["To Min"].default_value = opacity
    fade.inputs["To Max"].default_value = 0
    wire(tree, offset, 0, fade, 0)
    mix = node(tree, "ShaderNodeMixShader")
    wire(tree, fade, 0, mix, 0)
    wire(tree, node(tree, "ShaderNodeBsdfTransparent"), 0, mix, 1)
    wire(tree, node(tree, "ShaderNodeEmission", Color=(0.61, 0.69, 0.79, 1)), 0, mix, 2)
    wire(tree, mix, 0, tree.nodes.get("Material Output"), 0)
    veil = geometry(
        "Shoreline drift",
        [
            (-90, depth, -1),
            (90, depth, -1),
            (90, depth, height + 1),
            (-90, depth, height + 1),
        ],
        [(0, 1, 2, 3)],
        haze,
    )
    veil.visible_shadow = False

lake, bs = surface(
    "Deep ice",
    (0.055, 0.081, 0.091),
    0.16,
    **{"Coat Weight": 0.68, "Coat Roughness": 0.14},
)
relief(lake, bs, 8, 0.009, 0.24)
sheet("Lake skin", [-170, 170], [-30, 220], lambda x, y: 0, lake)
snow, bs = surface("Windpack", (0.68, 0.73, 0.79), 0.77)
tree = snow.node_tree
coords = node(tree, "ShaderNodeTexCoord")
scale = node(tree, "ShaderNodeVectorMath")
scale.operation = "SCALE"
scale.inputs["Scale"].default_value = 0.55
wire(tree, coords, "Object", scale, 0)
for suffix, socket in [("col", "Base Color"), ("height", "Normal")]:
    tex = node(tree, "ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(cache / f"snow_field_aerial_{suffix}_2k.jpg"))
    wire(tree, scale, 0, tex, 0)
    if suffix == "height":
        tex.image.colorspace_settings.name = "Non-Color"
        bump = node(tree, "ShaderNodeBump", Strength=0.28, Distance=0.012)
        wire(tree, tex, 0, bump, "Height")
        wire(tree, bump, 0, bs, socket)
    else:
        # Keep windpack albedo high in the shade; the scan supplies fine relief.
        wash = node(tree, "ShaderNodeMixRGB", Fac=0.77)
        wash.inputs[2].default_value = (0.64, 0.67, 0.70, 1)
        wire(tree, tex, 0, wash, 1)
        wire(tree, wash, 0, bs, socket)


def drift(x, y):
    field = (
        n(x * 0.12 + y * 0.13, y * 0.62, 7)
        + 0.38 * n(x * 0.47, y * 1.2, 6)
        + 0.16 * n(x, y * 3, 4)
    )
    field += 0.13 * n(x * 1.9 + y, y * 6, 4) + 0.07 * n(x * 4, y * 12, 2)
    field += 0.18 * math.tanh((-y - 3) * 0.75) + 0.04
    return min(0.12, max(-0.07, 0.115 * field)) + 0.027 * (sampled(x, y) - 0.5)


sheet(
    "Scoured mantle", np.linspace(-19, 19, 590), np.linspace(-11, 30, 620), drift, snow
)

fracture, bs = surface("Air caught in shear planes", (0.56, 0.66, 0.69), 0.29)
verts, faces = [], []
for i in range(75):
    x, y = random.uniform(-17, 15), random.uniform(-10, 18)
    a = random.uniform(-2.9, 2.9)
    width = random.uniform(0.001, 0.012)
    for j in range(random.randint(5, 44)):
        length = random.uniform(0.06, 0.65)
        xx, yy = x + length * math.cos(a), y + length * math.sin(a)
        k = len(verts)
        verts.extend(
            [
                (x, y, 0.002),
                (xx, yy, 0.002),
                (xx + width, yy + width, 0.002),
                (x + width, y + width, 0.002),
            ]
        )
        faces.append(tuple(range(k, k + 4)))
        x, y = xx, yy
        a += random.uniform(-0.26, 0.26)
geometry("Frozen hairlines", verts, faces, fracture, False)

font = instantiateVariableFont(TTFont("src/fonts/TASAOrbiter-VF.woff2"), {"wght": 700})
font.flavor = None
fontpath = out.parent / "TASA-Bold.ttf"
font.save(fontpath)
bpy.ops.object.text_add(rotation=(math.pi / 2, 0, -0.035))
name = bpy.context.object
name.data.body = "Arav Jain"
name.data.align_x = "CENTER"
name.data.font = bpy.data.fonts.load(str(fontpath))
name.data.size = 2
name.data.extrude = 0.13
name.data.bevel_depth = 0.025
name.data.bevel_resolution = 4
name.data.resolution_u = 18
bpy.ops.object.convert(target="MESH")
name = bpy.context.object
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
name.data.remesh_voxel_size = 0.009
bpy.ops.object.voxel_remesh()
normals = [v.normal.copy() for v in name.data.vertices]
for v, normal in zip(name.data.vertices, normals):
    x, y, z = v.co
    v.co += normal * (
        0.006 * n(x * 9, y * 6, z * 8)
        + 0.003 * n(x * 75, y * 22, z * 60)
        + 0.010 * n(x * 2, y * 3, z * 3)
    )
name.data.update()
name.data.polygons.foreach_set(
    "use_smooth", np.ones(len(name.data.polygons), dtype=bool)
)
ice, bs = surface(
    "Lake ice IOR 1.31",
    (0.105, 0.16, 0.17),
    0.085,
    **{"IOR": 1.31, "Transmission Weight": 0.97},
)
relief(ice, bs, 24, 0.008, 0.36)
# Hoarfrost catches on upward-facing skin, broken up at crystal scale.
tree = ice.node_tree
normal = node(tree, "ShaderNodeSeparateXYZ")
wire(tree, node(tree, "ShaderNodeNewGeometry"), "Normal", normal, 0)
grain = node(tree, "ShaderNodeTexNoise", Scale=74, Detail=3)
wire(tree, node(tree, "ShaderNodeTexCoord"), "Object", grain, 0)
weight = node(tree, "ShaderNodeMath")
weight.operation = "MULTIPLY"
wire(tree, grain, 0, weight, 0)
wire(tree, normal, "Z", weight, 1)
frost = node(tree, "ShaderNodeMapRange")
frost.inputs["From Min"].default_value = 0.30
frost.inputs["From Max"].default_value = 0.60
wire(tree, weight, 0, frost, 0)
mix = node(tree, "ShaderNodeMixShader")
wire(tree, frost, 0, mix, 0)
wire(tree, bs, 0, mix, 1)
wire(tree, node(tree, "ShaderNodeBsdfDiffuse", Color=(0.73, 0.79, 0.81, 1)), 0, mix, 2)
wire(tree, mix, 0, tree.nodes.get("Material Output"), 0)
name.data.materials.clear()
name.data.materials.append(ice)
# Clip inclusions to the actual glyph volumes by testing every plate against both skins.
deps = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(name, deps)
verts, faces = [], []
for i in range(26000):
    x, z = random.uniform(-5, 5), random.uniform(0.01, 1.6)
    near = bvh.ray_cast((x, -1, z), (0, 1, 0))[0]
    far = bvh.ray_cast((x, 1, z), (0, -1, 0))[0]
    if near is None or far is None or far.y - near.y < 0.07:
        continue
    # Bubbles collect in tilted veils interrupted by clear expanses.
    vein = n(x * 3 + z * 1.1, z * 0.9, 1)
    if abs(vein) > 0.21:
        continue
    y = random.uniform(near.y + 0.025, far.y - 0.025)
    radius = random.uniform(0.001, 0.010)
    if i % 31 == 0:
        radius *= 4
    k = len(verts)
    for j in range(7):
        a = j * math.tau / 7
        verts.append(
            (
                x + radius * math.cos(a),
                y + radius * 0.8 * math.sin(a),
                z + radius * 0.54 * math.sin(a),
            )
        )
    faces.append(tuple(range(k, k + 7)))
geometry("Suspended bubble veils", verts, faces, fracture, False)
# Sparse larger internal cleavage lamellae bounded by the strokes.
verts, faces = [], []
for i in range(330):
    x, z = random.uniform(-4.3, 4.3), random.uniform(0.02, 1.45)
    angle = random.uniform(0.48, 1.18) * random.choice([-1, 1])
    y = random.uniform(-0.07, 0.07)
    for j in range(random.randrange(2, 36)):
        xx, zz = x + 0.011 * math.cos(angle), z + 0.011 * math.sin(angle)
        pts = [
            (x, y, z),
            (xx, y + 0.004, zz),
            (xx + 0.005, y + 0.038, zz + 0.008),
            (x + 0.005, y + 0.037, z + 0.008),
        ]
        if all(
            (hit := bvh.ray_cast((px, -1, pz), (0, 1, 0))[0]) and hit.y < py
            for px, py, pz in pts
        ):
            k = len(verts)
            verts.extend(pts)
            faces.append(tuple(range(k, k + 4)))
        x, z = xx, zz
        angle += random.uniform(-0.07, 0.07)
geometry("Cleavage ribbons", verts, faces, fracture, False)

bpy.ops.object.light_add(type="SUN", location=(7, 18, 3))
sun = bpy.context.object
sun.rotation_euler = Vector((-16, -12, -3.2)).to_track_quat("-Z", "Y").to_euler()
sun.data.energy = 3.8
sun.data.angle = 0.035
bpy.ops.object.camera_add(location=(1, -18.8, 2.05))
cam = bpy.context.object
cam.rotation_euler = (
    (Vector((0, 0, 0.68)) - cam.location).to_track_quat("-Z", "Y").to_euler()
)
cam.data.angle = math.radians(30)
cam.data.clip_end = 800
scene.camera = cam
# Write an ungraded material ID alongside the plate for local contrast sampling.
name.pass_index = 1
scene.view_layers[0].use_pass_object_index = True
scene.use_nodes = True
graph = scene.node_tree
mask = node(graph, "CompositorNodeIDMask")
mask.index = 1
wire(graph, graph.nodes.get("Render Layers"), "IndexOB", mask, 0)
maskfile = node(graph, "CompositorNodeOutputFile")
maskfile.base_path = str(out.parent)
maskfile.file_slots[0].path = out.stem + "-letters-"
maskfile.format.color_mode = "BW"
wire(graph, mask, 0, maskfile, 0)
bpy.ops.render.render(write_still=True)
