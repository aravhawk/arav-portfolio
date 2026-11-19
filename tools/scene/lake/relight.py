# Recompose at a shorter focal length. The wider near field brings the contact 
# and the two sides of the lake into different planes.
cam.location=(.42,-12,1.12)
cam.data.angle=math.radians(47.4)
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat("-Z","Y").to_euler()
cam.data.clip_start=.05
# Break the broad east shoulder into two dark rock headlands, one at each side.
# The shadowed albedo responds to slope; drifted flats on top retain snow.
for j,(ridge,altfog,fogshade,albedo) in enumerate(ranges):
    mt=ridge.data.materials[0].node_tree
    diff=mt.nodes.get("Principled BSDF")
    nz=node(mt,"ShaderNodeSeparateXYZ")
    wire(mt,node(mt,"ShaderNodeNewGeometry"),"True Normal",nz,0)
    breeze=node(mt,"ShaderNodeTexNoise",Scale=1.7,Detail=5)
    wire(mt,node(mt,"ShaderNodeNewGeometry"),"Position",breeze,0)
    dep=node(mt,"ShaderNodeMath")
    dep.operation="MULTIPLY_ADD"
    wire(mt,breeze,"Fac",dep,0)
    dep.inputs[1].default_value=.23
    wire(mt,nz,"Z",dep,2)
    dep_map=node(mt,"ShaderNodeValToRGB")
    dep_map.color_ramp.interpolation="EASE"
    dep_map.color_ramp.elements[0].position=.87
    dep_map.color_ramp.elements[0].color=(.011,.015,.023,1)
    dep_map.color_ramp.elements[1].position=.99
    dep_map.color_ramp.elements[1].color=(.64,.70,.75,1)
    wire(mt,dep,0,dep_map,0)
    dep_color=node(mt,"ShaderNodeMixRGB",Fac=.65)
    dep_color.blend_type="MULTIPLY"
    wire(mt,albedo,0,dep_color,1)
    wire(mt,dep_map,0,dep_color,2)
    wire(mt,dep_color,0,diff,"Base Color")
    wire(mt,dep_color,0,diff,"Emission Color")
    for link in tuple(diff.inputs["Emission Strength"].links): mt.links.remove(link)
    diff.inputs["Emission Strength"].default_value=[.17,.26,.36][j]
    fogshade.inputs["Color"].default_value=[(.068,.080,.091,1),(.21,.245,.28,1),(.39,.43,.47,1)][j]
    altfog.inputs["From Min"].default_value=-.34
    altfog.inputs["From Max"].default_value=6
    altfog.inputs["To Min"].default_value=[.26,.59,.73][j]
    altfog.inputs["To Max"].default_value=[.03,.15,.40][j]
# Banked relief presents a complex shoreline. Move the convex shoulder of
# the first height scan to the right; a lower outcrop then crosses behind.
ranges[0][0].scale=(.89,.8,.85)
ranges[0][0].rotation_euler.z=-.82
ranges[0][0].location.x=33
ranges[1][0].rotation_euler.z=.66
ranges[1][0].location.x=-23
ranges[1][0].scale.z=.68
ranges[2][0].scale.z=.74
# Allow grazing airlight to build in the last 100m; do not paint a stripe
# where the channel meets the crags. Clouds and ice respond to the same sky.
falloff.inputs["From Min"].default_value=15
falloff.inputs["From Max"].default_value=110
falloff.inputs["To Max"].default_value=.69
haze_color.inputs[0].default_value=(.064,.080,.098,1)
fade.inputs["From Max"].default_value=2.6
fade.inputs["To Min"].default_value=.013
rocklamp.data.energy=3800
rocklamp.location=(24,55,13)
distance.inputs[1].default_value=Vector((.23,1,.075)).normalized()
sun.rotation_euler=Vector((-.23,-1,-.075)).to_track_quat("-Z","Y").to_euler()
# Broaden the two light/shade planes across higher sastrugi and expose
# more of the dark channel at the lower left.
mantle.location=(.85,-.95,0)
mantle.scale=(.86,.71,1)
mantle.rotation_euler.z=-.42
sm=mantle.data
xyz=np.empty(len(sm.vertices)*3,np.float32)
sm.vertices.foreach_get("co",xyz)
xyz=xyz.reshape(-1,3)
x,y,z=xyz.T
h=np.asarray(Image.open(cache/"snow_field_aerial_height_2k.jpg").convert("L"),dtype=np.float32)/255
scale=154
measured=map_coordinates(h,[(y*scale)%h.shape[0],(x*scale)%h.shape[1]],order=1,mode="wrap")
z+=.046*(measured-.5)*np.clip(z/.08,0,1)
z*=1.72
sm.vertices.foreach_set("co",xyz.ravel())
sm.update()
reflector.data.energy=38
bg.inputs["Strength"].default_value=.19
sun.data.energy=3.45
sun.data.angle=.014
front.data.energy=820
rear.data.energy=630
bs.inputs["Emission Strength"].default_value=.075
absorb.inputs["Density"].default_value=1.25
density_gain.inputs[1].default_value=4.4
# Vary the density of two ice layers independently. Slow variation in the
# cover preserves dark windows, in contrast to a uniformly busy lake scan.
watercolors.color_ramp.elements[1].color=(.11,.125,.14,1)
watercolors.color_ramp.elements[0].color=(.003,.007,.009,1)
bsbed.inputs["Emission Strength"].default_value=.33
polar.inputs[0].default_value=.954
quiet.inputs["To Min"].default_value=.81
quiet.inputs["To Max"].default_value=.02
network.scale.z=.50
