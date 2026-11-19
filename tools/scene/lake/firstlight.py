"""Light the tilted cut faces separately from the deep congelation layer."""

front.data.energy = 545
rear.data.energy = 1840
rear.location = (5.7, 2.1, 1.8)
rear.rotation_euler = (
    (Vector((0, 0, 0.58)) - rear.location).to_track_quat("-Z", "Y").to_euler()
)
cap.inputs["To Min"].default_value = 0.23
cap.inputs["To Max"].default_value = 2.15
grade.inputs["To Min"].default_value = 5.4
bs.inputs["Emission Strength"].default_value = 0.012
# The old closed main shear caught the sky like a lens. Retain the separate
# fracture field under the lake, including its depth and interrupted edges.
for label in ("Main shear and keel", "Shallow splay"):
    bpy.data.objects[label].hide_render = True

# Set small overlapping lenses of rafted ice at the load points. Each
# cluster shares a fracture direction but the slabs split at uneven widths.
rng = random.Random(77153)
for j, (left, right) in enumerate(feet):
    centre = 0.5 * (left + right)
    for k in range(rng.randint(3, 7)):
        angle = rng.uniform(-math.pi, 0.25)
        radius = rng.uniform(0.55, 1.05)
        ob = bigplates[(j + k) % len(bigplates)].copy()
        scene.collection.objects.link(ob)
        ob.location = (
            centre + radius * (0.13 + 0.55 * (right - left)) * math.cos(angle),
            0.13 * centre - 0.19 + 0.20 * math.sin(angle),
            rng.uniform(-0.025, 0.012),
        )
        ob.scale = (
            rng.uniform(0.42, 0.86),
            rng.uniform(0.5, 1),
            rng.uniform(0.4, 0.85),
        )
        ob.rotation_euler = (
            rng.uniform(-0.37, 0.43),
            rng.uniform(-0.54, 0.57),
            angle + 0.48,
        )
        suntarget.objects.link(ob)
        receiver.objects.link(ob)

# Snow tongues swept out onto the lake. Remove the submerged polygons so
# clear areas continue to show the dark bed through the ice.
sx = np.linspace(-65, 65, 601)
sy = np.linspace(-14, 67, 387)
xx, yy = np.meshgrid(sx, sy)
scour = measured_snow("Snow009A", xx * 0.052, yy * 0.083)
lip = measured_snow("Snow008A", xx * 0.11, yy * 0.34)
boundary = (
    5.7 + 2.7 * np.sin(xx * 0.53) + 2.2 * np.sin(xx * 0.21 + 0.8) + 4 * (scour - 0.5)
)
edge = np.maximum(yy - boundary, np.abs(xx + 0.22 * yy) - 8.6 + 1.3 * np.sin(yy * 0.7))
depth = np.clip(edge * 0.048, -0.19, 0.095) + 0.10 * (lip - 0.5) + 0.055 * (scour - 0.5)
far_bank = field("Sastrugi", sx, sy, depth, snow)
onlysnow.objects.link(far_bank)
suntarget.objects.link(far_bank)
falloff.inputs["From Min"].default_value = 6
falloff.inputs["From Max"].default_value = 74
grazing.inputs["From Min"].default_value = 4.5
grazing.inputs["From Max"].default_value = 42

# Let the measured solar peak and its broken reflection share a direction.
# A narrow glossy lobe receives sunlight through the measured ice relief.
solar.inputs["Scale"].default_value = 0.20
sun.data.specular_factor = 0.94
sun.data.angle = math.radians(1.25)
gloss = node(lt, "ShaderNodeBsdfGlossy", Color=(0.74, 0.80, 0.81, 1), Roughness=0.085)
wire(lt, orig, "Normal", gloss, "Normal")
glaze = node(lt, "ShaderNodeMixShader", Fac=0.037)
output = lt.nodes.get("Material Output")
previous = output.inputs["Surface"].links[0].from_node
wire(lt, previous, 0, glaze, 1)
wire(lt, gloss, 0, glaze, 2)
wire(lt, glaze, 0, output, "Surface")

# The ice film breaks the reflected disc into elongated microfacets.
graintex = node(lt, "ShaderNodeTexImage")
graintex.image = extract("Ice003", "_Color.jpg")
stretch = node(lt, "ShaderNodeVectorMath")
stretch.operation = "MULTIPLY"
stretch.inputs[1].default_value = (1.35, 4.7, 1)
wire(lt, node(lt, "ShaderNodeNewGeometry"), "Position", stretch, 0)
wire(lt, stretch, 0, graintex, "Vector")
ripples = node(lt, "ShaderNodeBump", Distance=0.006, Strength=0.48)
wire(lt, graintex, "Color", ripples, "Height")
wire(lt, ripples, "Normal", gloss, "Normal")


# Thin, wind-scoured snow with exposed ice between the streamers.
powder = snow.copy()
far_bank.data.materials[0] = powder
st = powder.node_tree
streak = node(st, "ShaderNodeVectorMath")
streak.operation = "MULTIPLY"
streak.inputs[1].default_value = (0.38, 1.16, 0.5)
wire(st, node(st, "ShaderNodeNewGeometry"), "Position", streak, 0)
erosion = node(st, "ShaderNodeTexNoise", Scale=1.2, Detail=4)
wire(st, streak, 0, erosion, 0)
coverage = node(st, "ShaderNodeMapRange")
coverage.inputs["From Min"].default_value = 0.27
coverage.inputs["From Max"].default_value = 0.81
coverage.inputs["To Min"].default_value = 0.08
coverage.inputs["To Max"].default_value = 0.71
wire(st, erosion, "Fac", coverage, 0)
output = st.nodes.get("Material Output")
retained = output.inputs["Surface"].links[0].from_node
dust = node(st, "ShaderNodeMixShader")
wire(st, coverage, 0, dust, 0)
wire(st, node(st, "ShaderNodeBsdfTransparent"), 0, dust, 1)
wire(st, retained, 0, dust, 2)
wire(st, dust, 0, output, "Surface")

# A flat, polished surface mirrors the full solar disc. Replace that
# narrow lobe with sunlit islands on the measured, scoured ice skin.

film = bpy.data.materials.new("Sunward patches on wind-polished ice")
film.use_nodes = True
ft = film.node_tree
position = node(ft, "ShaderNodeNewGeometry")
coord = node(ft, "ShaderNodeVectorMath")
coord.operation = "MULTIPLY"
coord.inputs[1].default_value = (0.73, 2.43, 1)
wire(ft, position, "Position", coord, 0)
scan = node(ft, "ShaderNodeTexImage")
scan.image = extract("Ice003", "_Color.jpg")
wire(ft, coord, 0, scan, 0)
broken = node(ft, "ShaderNodeMapRange")
broken.inputs["From Min"].default_value = 0.16
broken.inputs["From Max"].default_value = 0.48
wire(ft, scan, 0, broken, 0)
# For each surface location compute angular separation from the reflected
# solar ray. A broad shoulder lights the smallest facets nearer the lens.
reflection = node(ft, "ShaderNodeVectorMath")
reflection.operation = "SUBTRACT"
reflection.inputs[1].default_value = Vector((-0.168, -1, 0.084)).normalized()
wire(ft, position, "Incoming", reflection, 0)
cone = node(ft, "ShaderNodeVectorMath")
cone.operation = "MULTIPLY"
cone.inputs[1].default_value = (1, 0.5, 0.25)
wire(ft, reflection, 0, cone, 0)
separation = node(ft, "ShaderNodeVectorMath")
separation.operation = "LENGTH"
wire(ft, cone, 0, separation, 0)
path = node(ft, "ShaderNodeMapRange")
path.interpolation_type = "SMOOTHERSTEP"
path.inputs["From Min"].default_value = 0
path.inputs["From Max"].default_value = 0.055
path.inputs["To Min"].default_value = 1
path.inputs["To Max"].default_value = 0
wire(ft, separation, "Value", path, 0)
weight = node(ft, "ShaderNodeMath")
weight.operation = "MULTIPLY"
wire(ft, path, 0, weight, 0)
wire(ft, broken, 0, weight, 1)
glitter = node(ft, "ShaderNodeEmission", Color=(1, 0.965, 0.91, 1), Strength=1.65)
glints = node(ft, "ShaderNodeMixShader")
wire(ft, weight, 0, glints, 0)
wire(ft, node(ft, "ShaderNodeBsdfTransparent"), 0, glints, 1)
wire(ft, glitter, 0, glints, 2)
wire(ft, glints, 0, ft.nodes.get("Material Output"), "Surface")
suntrack = sheet(
    "Sun glitter in the open lead", [-23, 23], [-15, 52], lambda x, y: 0.0016, film
)
suntrack.visible_shadow = False
suntrack.visible_diffuse = False
suntrack.visible_glossy = False
suntrack.visible_transmission = False
suntrack.hide_render = args.theme == "night"

# As drifts taper at the window's edge, dark glass starts showing through
# before the relief drops below the waterline.
snow_height = node(st, "ShaderNodeSeparateXYZ")
wire(st, node(st, "ShaderNodeNewGeometry"), "Position", snow_height, 0)
thinning = node(st, "ShaderNodeMapRange")
thinning.interpolation_type = "SMOOTHERSTEP"
thinning.inputs["From Min"].default_value = 0.001
thinning.inputs["From Max"].default_value = 0.080
wire(st, snow_height, "Z", thinning, 0)
deposit = node(st, "ShaderNodeMath")
deposit.operation = "MULTIPLY"
wire(st, thinning, 0, deposit, 0)
wire(st, coverage, 0, deposit, 1)
wire(st, deposit, 0, dust, 0)

# Air-rich ice near the crown backscatters incident sky. Tint the skin by
# the same irregular freeze front as the volume, leaving the lower face
# clearer. The sawn sunward walls transmit an extra broad, green-blue lobe.
it = ice.node_tree
layer = node(it, "ShaderNodeValToRGB")
layer.color_ramp.elements[0].position = 0.36
layer.color_ramp.elements[0].color = (0.20, 0.42, 0.46, 1)
layer.color_ramp.elements[1].position = 0.95
layer.color_ramp.elements[1].color = (0.91, 0.98, 1, 1)
wire(it, frontline, 0, layer, 0)
face_color = bs.inputs["Base Color"].links[0].from_node
skin_color = node(it, "ShaderNodeMixRGB", Fac=0.73)
skin_color.blend_type = "MULTIPLY"
wire(it, face_color, 0, skin_color, 1)
wire(it, layer, 0, skin_color, 2)
wire(it, skin_color, 0, bs, "Base Color")
sunward = node(it, "ShaderNodeSeparateXYZ")
wire(it, node(it, "ShaderNodeNewGeometry"), "True Normal", sunward, 0)
rimweight = node(it, "ShaderNodeMapRange")
rimweight.inputs["From Min"].default_value = 0.36
rimweight.inputs["From Max"].default_value = 0.88
rimweight.inputs["To Max"].default_value = 0.44
wire(it, sunward, "X", rimweight, 0)
translucent = node(it, "ShaderNodeBsdfTranslucent", Color=(0.37, 0.80, 0.82, 1))
edge_light = node(it, "ShaderNodeMixShader")
iceout = it.nodes.get("Material Output")
wire(it, iceout.inputs["Surface"].links[0].from_node, 0, edge_light, 1)
wire(it, rimweight, 0, edge_light, 0)
wire(it, translucent, 0, edge_light, 2)
wire(it, edge_light, 0, iceout, "Surface")

# A wind tongue reaches out from the near left bank, placing the day copy
# on light, continuous snow. Apply the displacement in world coordinates
# so the right half of the open lead and its solar path stay exposed.
bank_mesh = nextbank.data
bank_positions = np.empty((len(bank_mesh.vertices), 3), np.float32)
bank_mesh.vertices.foreach_get("co", bank_positions.ravel())
bank_matrix = np.asarray(nextbank.matrix_world)
world_x = bank_positions @ bank_matrix[0, :3] + bank_matrix[0, 3]
lee = np.clip((1.4 - world_x) / 4.0, 0, 1)
advance = 4.3 * lee * lee * (3 - 2 * lee)
bank_positions += advance[:, None] * np.linalg.inv(bank_matrix[:3, :3])[:, 1]
bank_mesh.vertices.foreach_set("co", bank_positions.ravel())
bank_mesh.update()
