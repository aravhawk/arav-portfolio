# Compare one photographic environment and a physical backlight against
# the flatter bounce-card study. The name receives no painted emission.
wt=scene.world.node_tree
softsky=node(wt,"ShaderNodeMixRGB",Fac=.25)
wire(wt,washed,0,softsky,1);wire(wt,rolled,0,softsky,2)
wire(wt,softsky,0,bg,0)
bg.inputs["Strength"].default_value=.18
# Single glancing sun, receiving the same angular radiance as the camera sky.
sun.data.transmission_factor=1
sun.data.specular_factor=.41
sun.data.energy=3.15
sun.data.angle=.025
front.location=(-1.5,-3.5,3.0)
front.rotation_euler=(Vector((0,0,.52))-front.location).to_track_quat("-Z","Y").to_euler()
front.data.size=6.0
front.data.size_y=4.6
front.data.energy=345
rear.location=(3.0,3.9,1.85)
rear.rotation_euler=(Vector((0,0,.50))-rear.location).to_track_quat("-Z","Y").to_euler()
rear.data.size=3.4
rear.data.size_y=2.8
rear.data.energy=1240
bs.inputs["Emission Strength"].default_value=0
bs.inputs["Transmission Weight"].default_value=.94
bs.inputs["Subsurface Weight"].default_value=.072
scat.inputs["Anisotropy"].default_value=.26
scat.inputs["Color"].default_value=(.72,.92,.94,1)
rough_map.inputs["To Min"].default_value=.10
rough_map.inputs["To Max"].default_value=.27
grade.inputs["To Min"].default_value=2.85
grade.inputs["To Max"].default_value=.68
density_gain.inputs[1].default_value=3.45
fb.inputs["Emission Strength"].default_value=.025
fb.inputs["Transmission Weight"].default_value=.51
fb.inputs["Roughness"].default_value=.23
# The long sunlit half of each sastrugi brings light in from the same side.
reflector.data.energy=730
fade.inputs["To Min"].default_value=.008
