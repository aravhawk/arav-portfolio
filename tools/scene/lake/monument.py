"""The eastern saddle lights a low, diagonal view along the cut slabs."""

night = args.theme == "night"
cam.location = (-5.85, -10.32, 0.68)
cam.rotation_euler = (Vector((-0.37, 0, 0.59)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.rotation_euler.rotate_axis("Z", math.radians(-6))
cam.data.angle = math.radians(40)
for ridge, *_ in ranges:
    ridge.scale.z *= 0.78
    ridge.location.x += 0.40 * ridge.location.y
near.scale.z *= 0.96
fade.inputs["To Min"].default_value = 0.0043
for cliff in crags:
    cliff.scale.z *= 0.56
    cliff.location.z -= 0.45

# Distances below are chord lengths on the unit sky sphere. The same
# direction is used for the physical sun, the glitter and the fog glow.
east = Vector((0.80, 0.98, 0.077)).normalized()
sun.rotation_euler = (-east).to_track_quat("-Z", "Y").to_euler()
sun.data.angle = math.radians(1.7)
sun.data.energy = 0.56 if night else 6.3
sun.data.color = (0.45, 0.67, 1) if night else (1, 0.92, 0.78)
reflection.inputs[1].default_value = (-east.x, -east.y, east.z)
path.inputs["From Max"].default_value = 0.079
broken.inputs["From Min"].default_value = 0.095
broken.inputs["From Max"].default_value = 0.36
glitter.inputs["Strength"].default_value = 5
sky_tree = scene.world.node_tree
wire(sky_tree, skyvec, "Generated", distance, 0)
distance.inputs[1].default_value = east


def palette(tree, source, socket, stops):
    ramp = node(tree, "ShaderNodeValToRGB")
    colors = ramp.color_ramp
    colors.interpolation = "EASE"
    colors.elements.remove(colors.elements[1])
    for index, (position, rgb) in enumerate(stops):
        e = colors.elements.new(position) if index else colors.elements[0]
        e.position = position
        e.color = (*rgb, 1)
    wire(tree, source, socket, ramp, 0)
    return ramp


day_sky = [
    (0, (19, 15, 10)),
    (0.007, (16, 13, 9)),
    (0.013, (4.8, 4.1, 3.2)),
    (0.048, (2.9, 2.7, 2.4)),
    (0.15, (1.55, 1.58, 1.60)),
    (0.40, (0.46, 0.57, 0.70)),
    (0.78, (0.15, 0.23, 0.33)),
]
night_sky = [
    (0, (0.49, 0.48, 0.47)),
    (0.075, (0.31, 0.41, 0.51)),
    (0.21, (0.16, 0.25, 0.33)),
    (0.51, (0.052, 0.095, 0.18)),
    (0.82, (0.037, 0.067, 0.14)),
]
eastern = palette(sky_tree, distance, "Value", night_sky if night else day_sky)
if night:
    high = node(sky_tree, "ShaderNodeMapRange")
    high.inputs["From Min"].default_value = 0.085
    high.inputs["From Max"].default_value = 0.19
    wire(sky_tree, direction_z, "Z", high, 0)
    star_amount = node(sky_tree, "ShaderNodeMath")
    star_amount.operation = "MULTIPLY"
    wire(sky_tree, high, 0, star_amount, 0)
    wire(sky_tree, points, 0, star_amount, 1)
    wire(sky_tree, eastern, 0, sky, 1)
    wire(sky_tree, star_amount, 0, sky, 2)
    wire(sky_tree, sky, 0, skybg, "Color")
else:
    clouds = node(sky_tree, "ShaderNodeMixRGB", Fac=0.095)
    clouds.blend_type = "MULTIPLY"
    wire(sky_tree, eastern, 0, clouds, 1)
    wire(sky_tree, rolled, 0, clouds, 2)
    wire(sky_tree, clouds, 0, skybg, "Color")
skybg.inputs["Strength"].default_value = 0.60 if night else 1.0
wire(sky_tree, eastern, 0, bg, "Color")
bg.inputs["Strength"].default_value = 0.47 if night else 0.39
scene.view_settings.exposure = -0.45 if night else -0.14
rendergrade.inputs["Saturation"].default_value = 0.69 if night else 0.86

# Anisotropic scattering in the ground fog picks up the backlight.
mist.inputs["Anisotropy"].default_value = 0.64
mist.inputs["Color"].default_value = (0.41, 0.59, 0.81, 1) if night else (0.85, 0.87, 0.81, 1)
front.data.energy = 630 if night else 380
rear.data.energy = 1100 if night else 2400
rear.location = (4.7, 2.8, 1.25)
rear.rotation_euler = (Vector((0, 0, 0.45)) - rear.location).to_track_quat("-Z", "Y").to_euler()

# Pale air sheets at the thin rim catch more horizon light than the
# broad sawn faces. Retain the measured volume and fractures underneath.
t = ice.node_tree
facing = node(t, "ShaderNodeLayerWeight")
angle_response = palette(
    t, facing, "Facing", [(0, (0.08,) * 3), (0.52, (0.16,) * 3), (0.83, (0.62,) * 3), (1, (1,) * 3)]
)
scatter = node(t, "ShaderNodeMath")
scatter.operation = "MULTIPLY_ADD"
wire(t, angle_response, 0, scatter, 0)
scatter.inputs[1].default_value = 1.75 if night else 2.3
scatter.inputs[2].default_value = 0.60 if night else 0.11
through = node(
    t, "ShaderNodeEmission", Color=(0.44, 0.69, 0.94, 1) if night else (0.37, 0.82, 0.76, 1)
)
wire(t, scatter, 0, through, "Strength")
result = node(t, "ShaderNodeAddShader")
wire(t, edge_light, 0, result, 0)
wire(t, through, 0, result, 1)
wire(t, result, 0, iceout, "Surface")

# Vary the strength of the internal return with the scanned cloudy strata.
# The thin cuts transmit much more than the thick, cold central mass.
veils = node(t, "ShaderNodeMapRange")
veils.inputs["From Min"].default_value = 0.035
veils.inputs["From Max"].default_value = 0.38
veils.inputs["To Min"].default_value = 0.52 if night else 0.24
veils.inputs["To Max"].default_value = 1.42
wire(t, tex, "Color", veils, 0)
body_light = node(t, "ShaderNodeMath")
body_light.operation = "MULTIPLY"
wire(t, scatter, 0, body_light, 0)
wire(t, veils, 0, body_light, 1)
wire(t, body_light, 0, through, "Strength")
if night:
    # The exposed crowns catch the eastern sky above the dark terrain.
    altitude = node(t, "ShaderNodeSeparateXYZ")
    wire(t, node(t, "ShaderNodeNewGeometry"), "Position", altitude, 0)
    crown = node(t, "ShaderNodeMapRange")
    crown.inputs["From Min"].default_value = 0.30
    crown.inputs["From Max"].default_value = 1.02
    crown.inputs["To Min"].default_value = 1
    crown.inputs["To Max"].default_value = 2.35
    wire(t, altitude, "Z", crown, 0)
    horizon_light = node(t, "ShaderNodeMath")
    horizon_light.operation = "MULTIPLY"
    wire(t, crown, 0, horizon_light, 0)
    wire(t, body_light, 0, horizon_light, 1)
    wire(t, horizon_light, 0, through, "Strength")

# The wind leaves a tongue of measured snow under the words. Its edge
# runs obliquely across the lens, exposing the sunward side of the lead.
nextbank.hide_render = True
bx = np.linspace(-19, 10, 490)
by = np.linspace(-24, 3, 474)
xx, yy = np.meshgrid(bx, by)
lateral = 0.89 * (xx + 5.6) - 0.45 * (yy + 9.8)
forward = 0.45 * (xx + 5.6) + 0.89 * (yy + 9.8)
scour = measured_snow("Snow008A", xx * 0.16, yy * 0.45)
tongue = 3.9 - 0.85 * lateral + 0.41 * np.sin(xx * 1.16) + 0.63 * (scour - 0.5) - forward
# A windbank also follows the western side of the tracking camera.
# Its sunward edge stays open on the right, beside the reflected sun.
for travel in np.linspace(0, 1, 11):
    cx = -5.85 + 3.50 * travel
    cy = -10.32 + 6.97 * travel
    heading = math.radians(28 + 31 * travel)
    front_distance = np.sin(heading) * (xx - cx) + np.cos(heading) * (yy - cy)
    cross_distance = np.cos(heading) * (xx - cx) - np.sin(heading) * (yy - cy)
    leading = 3.65 + 0.45 * travel - 1.6 * cross_distance - front_distance
    patch = np.minimum(front_distance + 0.4, leading) + 0.16 * np.sin(1.8 * yy) + 0.32 * (scour - 0.5)
    tongue = np.maximum(tongue, patch)
# Pressure cracks and the wind scour the bank back from the slab collars.
# Keep an open lead to the east and a narrow apron around the load line.
ice_edge = 0.28 + 0.035 * forward - lateral + 0.16 * np.sin(yy * 1.43) + 0.39 * (scour - 0.5)
collars = (
    0.13 * xx
    - 1.45
    - yy
    - 1.3 * np.exp(-(((xx + 3.8) / 1.8) ** 2))
    + 0.38 * np.sin(xx * 2.1)
    + 0.28 * (scour - 0.5)
)
tongue = np.minimum(tongue, np.minimum(2.4 * ice_edge, 1.7 * collars))
# Survey the lee side of the lead from the moving camera. Wind deposits
# follow this corridor, leaving the eastern exposure and the collars bare.
rest_eye = cam.location.copy()
rest_rot = cam.rotation_euler.to_quaternion()
close_eye = Vector((-2.35, -3.35, 0.51))
close_rot = (Vector((1.5, 0.17, 0.12)) - close_eye).to_track_quat("-Z", "Y").to_euler()
close_rot.rotate_axis("Z", math.radians(-3))
for step in np.linspace(0, 1, 17):
    eye = rest_eye.lerp(close_eye, step)
    rot = rest_rot.slerp(close_rot.to_quaternion(), step)
    lens = (1 - step) * math.tan(math.radians(20)) + step * math.tan(math.radians(27.5))
    outline = []
    for u, v in [(-0.19, 0.74), (0.08, 0.74), (0.39, 0.76), (0.64, 0.76), (0.58, 1.8), (-0.19, 1.8)]:
        ray = rot @ Vector(((2 * u - 1) * lens, (1 - 2 * v) * lens * 5 / 8, -1))
        hit = eye - ray * (eye.z / ray.z)
        outline.append(np.asarray(hit)[:2])
    coords = np.array(outline)
    winding = np.sign(
        np.sum(coords[:, 0] * np.roll(coords[:, 1], -1) - coords[:, 1] * np.roll(coords[:, 0], -1))
    )
    inside = np.full(xx.shape, 100.0)
    for a, b in zip(coords, np.roll(coords, -1, axis=0)):
        e = b - a
        inside = np.minimum(
            inside, winding * (e[0] * (yy - a[1]) - e[1] * (xx - a[0])) / np.linalg.norm(e)
        )
    tongue = np.maximum(tongue, 3 * inside + 0.34 * (scour - 0.5) + 0.12 * np.sin(2.3 * xx + yy))
near_cuts = (
    0.13 * xx - 0.52 - yy - 2.35 * np.exp(-(((xx + 3.8) / 1.6) ** 2)) + 0.22 * np.sin(xx * 2.1)
)
tongue = np.minimum(tongue, 2.6 * near_cuts)
height = np.clip(tongue * 0.105, -0.22, 0.061) + 0.052 * (scour - 0.49)
windpack = snow.copy()
windpack.name = "Fine wind-deposited snow"
if not night:
    st = windpack.node_tree
    surface_out = st.nodes.get("Material Output")
    old_surface = surface_out.inputs["Surface"].links[0].from_socket
    bounce = node(st, "ShaderNodeEmission", Color=(0.65, 0.68, 0.70, 1), Strength=0.49)
    bright = node(st, "ShaderNodeAddShader")
    st.links.new(old_surface, bright.inputs[0])
    wire(st, bounce, 0, bright, 1)
    wire(st, bright, 0, surface_out, "Surface")
bank = field("Sastrugi", bx, by, height, windpack)
# Register the snow scan in metres so its tangent-space normal map
# follows the wind ridges continuously across the new surface.
mesh = bank.data
coords = np.empty((len(mesh.vertices), 3), np.float32)
mesh.vertices.foreach_get("co", coords.ravel())
corners = np.empty(len(mesh.loops), np.int32)
mesh.loops.foreach_get("vertex_index", corners)
uv = mesh.uv_layers.new(name="Crust")
uv.data.foreach_set("uv", np.ascontiguousarray(coords[corners, :2] * 0.67).ravel())
for nm in windpack.node_tree.nodes:
    if nm.type == "NORMAL_MAP":
        nm.inputs["Strength"].default_value = 0.38
suntarget.objects.link(bank)
onlysnow.objects.link(bank)
# Project the actual solid towards the ice along the solar ray. Two blurred
# footprints describe the penumbra and the displaced transmitted-light lobe.
if not night:
    from PIL import ImageDraw, ImageFilter

    extent = (-17, -16, 9, 6)
    resolution = (1248, 1056)
    projected = Image.new("L", resolution)
    draw = ImageDraw.Draw(projected)
    evaluated = name.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    vertices = np.empty((len(mesh.vertices), 3), np.float32)
    mesh.vertices.foreach_get("co", vertices.ravel())
    M = np.asarray(evaluated.matrix_world)
    vertices = vertices @ M[:3, :3].T + M[:3, 3]
    planar = vertices[:, :2] - vertices[:, 2:3] * np.asarray(east)[:2] / east.z
    xy = (planar - np.array(extent[:2])) * 48
    mesh.calc_loop_triangles()
    triangles = np.empty((len(mesh.loop_triangles), 3), np.int32)
    mesh.loop_triangles.foreach_get("vertices", triangles.ravel())
    for tri in np.rint(xy[triangles]).astype(int):
        draw.polygon(tuple(tri.ravel().tolist()), fill=255)
    evaluated.to_mesh_clear()
    footprint = np.asarray(projected.filter(ImageFilter.GaussianBlur(2.2)), np.float32) / 255
    diffuse = np.asarray(projected.filter(ImageFilter.GaussianBlur(7)), np.float32) / 255
    focus = np.maximum(np.roll(diffuse, (4, 8), axis=(0, 1)) - footprint, 0)
    rgba = np.ones((resolution[1], resolution[0], 4), np.float32)
    rgba[:, :, 0] = footprint
    rgba[:, :, 1] = focus
    rays = bpy.data.images.new("Solar footprint and refracted edges", *resolution, float_buffer=True)
    rays.pixels.foreach_set(rgba.ravel())
    rays.update()
    mat = bpy.data.materials.new("Shadows in the lake skin")
    mat.use_nodes = True
    tr = mat.node_tree
    coords = node(tr, "ShaderNodeVectorMath")
    coords.operation = "MULTIPLY_ADD"
    coords.inputs[1].default_value = (1 / 26, 1 / 22, 0)
    coords.inputs[2].default_value = (17 / 26, 16 / 22, 0)
    wire(tr, node(tr, "ShaderNodeNewGeometry"), "Position", coords, 0)
    image = node(tr, "ShaderNodeTexImage")
    image.image = rays
    image.extension = "CLIP"
    wire(tr, coords, 0, image, 0)
    channels = node(tr, "ShaderNodeSeparateColor")
    wire(tr, image, 0, channels, 0)
    tint = node(tr, "ShaderNodeMixRGB")
    tint.inputs[1].default_value = (1, 1, 1, 1)
    tint.inputs[2].default_value = (0.24, 0.33, 0.38, 1)
    wire(tr, channels, 0, tint, 0)
    transmit = node(tr, "ShaderNodeBsdfTransparent")
    wire(tr, tint, 0, transmit, 0)
    beam = node(tr, "ShaderNodeEmission", Color=(0.16, 0.35, 0.28, 1))
    wire(tr, channels, 1, beam, 1)
    combine_rays = node(tr, "ShaderNodeAddShader")
    wire(tr, transmit, 0, combine_rays, 0)
    wire(tr, beam, 0, combine_rays, 1)
    wire(tr, combine_rays, 0, tr.nodes.get("Material Output"), "Surface")
    shadows = sheet("Transmitted dawn on the lake", [-17, 9], [-16, 6], lambda x, y: 0.003, mat)
    shadows.visible_shadow = False

# The broad cut carries a cool satin skin. Keep the grazing sidewalls on
# their full transmission response, with the least frost on the lower cut.
surface_normal = node(t, "ShaderNodeSeparateXYZ")
wire(t, node(t, "ShaderNodeNewGeometry"), "True Normal", surface_normal, 0)
sawn = node(t, "ShaderNodeMapRange")
sawn.inputs["From Min"].default_value = -0.98
sawn.inputs["From Max"].default_value = -0.52
sawn.inputs["To Min"].default_value = 0.22 if night else 0.56
sawn.inputs["To Max"].default_value = 0
wire(t, surface_normal, "Y", sawn, 0)
satin = node(t, "ShaderNodeBsdfDiffuse", Color=(0.06, 0.14, 0.17, 1), Roughness=0.6)
surface_finish = node(t, "ShaderNodeMixShader")
wire(t, sawn, 0, surface_finish, 0)
wire(t, result, 0, surface_finish, 1)
wire(t, satin, 0, surface_finish, 2)
wire(t, surface_finish, 0, iceout, "Surface")

# Survey both viewing gates in the establishing camera's coordinate system.
# The supplemental bake has overscan so the turn can start before reaching it.
from mathutils import Matrix

bpy.context.view_layer.update()
camera_axes = cam.matrix_world.to_3x3() @ Matrix.Diagonal((1, 1, -1))
end_location = close_eye
end_rotation = close_rot
end_axes = end_rotation.to_matrix() @ Matrix.Diagonal((1, 1, -1))
end_q = (end_axes.transposed() @ camera_axes).to_quaternion()
end_eye = camera_axes.transposed() @ (end_location - cam.location)
end_half = math.tan(math.radians(55) / 2)
approach_meta = dict(
    eye=list(end_eye),
    rotation=[end_q.x, end_q.y, end_q.z, end_q.w],
    half=[end_half, end_half * 5 / 8],
)
if args.approach:
    cam.location = end_location
    cam.rotation_euler = end_rotation
    cam.data.angle = math.radians(55)
