"""Two physical arrangements in the 390 by 844 camera gate."""

cam.data.sensor_fit = "HORIZONTAL"
scene.render.resolution_y = round(args.width * 844 / 390)
cam.location = (-6.35, -8.35, 0.85)
target = Vector((-0.63, -0.1, 0.55))
angle = 43
roll = -1.0
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.rotation_euler.rotate_axis("Z", math.radians(roll))
cam.data.angle = math.radians(angle)
cam.data.shift_y = -0.15
