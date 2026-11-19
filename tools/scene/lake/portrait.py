"""Survey the two rows from a higher camera, keeping each group on the lake."""

import json
from mathutils import Matrix

base_axes = cam.matrix_world.to_3x3() @ Matrix.Diagonal((1, 1, -1))
original_eye = np.array(cam.location)
cam.location = (-3.0, -7.5, 3.65)
heading = math.radians(24)
forward = np.array([math.sin(heading), math.cos(heading), 0.0])
aim_point = cam.location + Vector(8 * forward)
aim_point.z = 0.4
cam.rotation_euler = (aim_point - cam.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.view_layer.update()
axes = np.array(cam.matrix_world.to_3x3() @ Matrix.Diagonal((1, 1, -1)))
eye = np.array(cam.location)
offsets = []
split_x = 0.5 * (
    pos[np.isin(components, glyphs[3][2]), 0].max()
    + pos[np.isin(components, glyphs[4][2]), 0].min()
)
first_word = pos[:, 0] < split_x
far_scale = 1.34
# Shorter tracking suits the nearer, more frontal reading of the second word.
bounds = [pos[np.isin(components, group[2]), 0] for group in glyphs[4:]]
cuts = np.array(
    [0.5 * (left.max() + right.min()) for left, right in zip(bounds, bounds[1:])]
)
centers_x = np.array([0.5 * (a.min() + a.max()) for a in bounds])
spacing = -0.15 * (centers_x - centers_x.mean())
pos[~first_word, 0] += spacing[np.searchsorted(cuts, pos[~first_word, 0])]
bank.location += Vector((2.15, -1.1, 0))
for idx, (depth, fraction) in enumerate(((11.05, -0.022), (5.65, 0.014))):
    selected = first_word if idx == 0 else ~first_word
    if idx == 0:
        pos[selected] *= far_scale
    offset = eye + forward * depth - pos[selected].mean(axis=0)
    offset[2] = 0
    for _ in range(3):
        view = (pos[selected] + offset - eye) @ axes
        u = view[:, 0] / view[:, 2]
        offset += axes[:, 0] * (
            (fraction - 0.5 * (u.max() + u.min())) * np.mean(view[:, 2])
        )
    pos[selected] += offset
    offsets.append(offset)
name.data.vertices.foreach_set("co", pos.ravel())
name.data.update()
# Move local ice inclusions, heave plates and their snow pockets together.
for ob in faults + [shells] + pockets:
    mesh = ob.data
    loc = np.empty((len(mesh.vertices), 3), np.float32)
    mesh.vertices.foreach_get("co", loc.ravel())
    m = np.array(ob.matrix_world)
    world = loc @ m[:3, :3].T + m[:3, 3]
    delta = world * (far_scale - 1) + offsets[0]
    near_delta = np.broadcast_to(offsets[1], world.shape).copy()
    near_delta[:, 0] += spacing[np.searchsorted(cuts, world[:, 0])]
    local_delta = (
        np.where((world[:, 0] < split_x)[:, None], delta, near_delta)
        @ np.linalg.inv(m[:3, :3]).T
    )
    mesh.vertices.foreach_set(
        "co", np.ascontiguousarray(loc + local_delta, np.float32).ravel()
    )
    mesh.update()
plate_meshes = {ob.data for ob in bigplates} | {ob.data for ob in chips}
for ob in scene.objects:
    if ob.type == "MESH" and ob.data in plate_meshes and abs(ob.location.y) < 2:
        word = int(ob.location.x >= split_x)
        if word == 0:
            ob.location *= far_scale
            ob.scale *= far_scale
        else:
            ob.location.x += spacing[np.searchsorted(cuts, ob.location.x)]
        ob.location += Vector(offsets[word])
coords = (pos - eye) @ axes
# A 25 percent guard surrounds the opening and the small track between rows.
half = np.max(np.abs(coords[:, 0] / coords[:, 2])) / 0.86
ratio = 390 / 844
centre_y = 0.5 * (
    np.max(coords[:, 1] / coords[:, 2]) + np.min(coords[:, 1] / coords[:, 2])
)
shift = centre_y - 0.085 * half / ratio
guard = 1.26
cam.data.sensor_fit = "HORIZONTAL"
cam.data.angle = 2 * math.atan(half * guard)
cam.data.shift_y = shift / (2 * half * guard)
scene.render.resolution_y = round(args.width / ratio)
phone_meta = dict(
    eye=eye.tolist(),
    axes=axes.T.flatten().tolist(),
    baseAxes=np.array(base_axes).T.flatten().tolist(),
    baseEye=original_eye.tolist(),
    offsets=[o.tolist() for o in offsets],
    split=float(split_x),
    farScale=far_scale,
    cuts=cuts.tolist(),
    spacing=spacing.tolist(),
    half=float(half),
    shift=float(shift),
    guard=guard,
)
(out.parent / "portrait.json").write_text(json.dumps(phone_meta))
