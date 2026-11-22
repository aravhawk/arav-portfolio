# Use low grazing ambient light in the open lead. Keep broken plates clustered
# off the stroke silhouettes; their pale edges should not obscure a foot.
for idx,obj in enumerate(chips):
    obj.location.y+=.24
    obj.location.x+=(-.13 if idx%2 else .09)
    obj.scale*=.74
# Crisp air fissures in the near window fall away progressively under the name.
ft=fract.node_tree
fs=ft.nodes.get("Principled BSDF")
zfade=ft.nodes.get("ShaderNodeMapRange".replace("ShaderNode",""))
ymap=node(ft,"ShaderNodeSeparateXYZ")
wire(ft,node(ft,"ShaderNodeNewGeometry"),"Position",ymap,0)
quiet=node(ft,"ShaderNodeMapRange")
quiet.interpolation_type="SMOOTHERSTEP"
quiet.inputs["From Min"].default_value=-3.7
quiet.inputs["From Max"].default_value=.5
quiet.inputs["To Min"].default_value=.91
quiet.inputs["To Max"].default_value=.22
wire(ft,ymap,"Y",quiet,0)
existing=ft.nodes.get("Material Output").inputs[0].links[0].from_node
strength=node(ft,"ShaderNodeMixShader")
wire(ft,quiet,0,strength,0)
wire(ft,node(ft,"ShaderNodeBsdfTransparent"),0,strength,1)
wire(ft,existing,0,strength,2)
wire(ft,strength,0,ft.nodes.get("Material Output"),0)
# Steeper crosswind for the foreground, with calmer banks at the two lower
# corners. Lower the long ridges so a few exposed crests retain the raking shadow.
mantle.rotation_euler.z=.43
mantle.scale=(1,1.45,.54)
mantle.location=(.87,-5.2,0)
# Raise the photographic horizon light just over a saddle rather than a peak.
distance.inputs[1].default_value=Vector((.092,1,.087)).normalized()
# Reconcile the two surfaces at their physical point of contact.
falloff.inputs["From Min"].default_value=11
falloff.inputs["From Max"].default_value=37
falloff.inputs["To Max"].default_value=1
haze_color.inputs["Color"].default_value=(.064,.081,.095,1)
ranges[0][1].inputs["From Min"].default_value=.40
ranges[0][1].inputs["To Min"].default_value=1
ranges[0][2].inputs["Color"].default_value=(.061,.078,.092,1)
ranges[0][0].scale.z=.48
# A broader region of backscatter makes the nearer snowfield a brighter plane.
reflector.location=(3,-12,4.2)
reflector.data.energy=3100
reflector.data.size=12
front.data.energy=1320
rear.data.energy=950
