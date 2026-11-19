# Light reflected from ice and snow around the name. Keep the virtual bounce
# cards from introducing studio-light rectangles into the mirror surface.
receiver=bpy.data.collections.new("Pressure ridge receivers")
for obj in [name,*chips,*faults]:
    receiver.objects.link(obj)
for source in (rear,front):
    source.light_linking.receiver_collection=receiver
    source.data.specular_factor=.15
sun.data.specular_factor=.08
sun.data.energy=2.6
sun.data.angle=.045
skybg.inputs["Strength"].default_value=1.15
bg.inputs["Strength"].default_value=.23
# Expose the shaded side of the nearest ridge, with lighter ranges behind it.
for j,(m,mi,fo,rock) in enumerate(ranges):
    if j==0:
        fo.inputs["Color"].default_value=(.075,.092,.11,1)
        mi.inputs["To Max"].default_value=.22
        mi.inputs["To Min"].default_value=.42
        rock.color_ramp.elements[1].color=(.36,.42,.47,1)
        m.scale.z=.67
    else:
        mi.inputs["To Max"].default_value=[0,.31,.61][j]
# Cutoff lies behind the camera, even on the low near ray.
mantle.scale.y=1.35
mantle.location.y=-4.2
cam.location.z=1.16
cam.rotation_euler=(Vector((0,0,.62))-cam.location).to_track_quat("-Z","Y").to_euler()
polar.inputs[0].default_value=.88
bsbed.inputs["Specular IOR Level"].default_value=.04
bsbed.inputs["Roughness"].default_value=.95
fade.inputs["To Min"].default_value=.0032
mist.inputs["Anisotropy"].default_value=.10
# Taper walls at both ends, and feather the tip at depth.
network.data.materials[0].node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value=.045
