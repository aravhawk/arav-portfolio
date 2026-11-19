# A natural slab has entrained air throughout its thickness. Previously the
# lowest-density parts were perfectly clear and relayed the skyline across
# every face. A positive scattering coefficient gives a thick centre a
# finite optical path, while a thin outer edge remains transmissive.
density_gain.operation="MULTIPLY_ADD"
density_gain.inputs[1].default_value=5.4
density_gain.inputs[2].default_value=4.1
scat.inputs["Color"].default_value=(.87,.96,.955,1)
scat.inputs["Anisotropy"].default_value=.25
scene.cycles.volume_bounces=7
bs.inputs["Transmission Weight"].default_value=.88
bs.inputs["Subsurface Weight"].default_value=.12
bs.inputs["Emission Strength"].default_value=.04
rough_map.inputs["To Min"].default_value=.16
rough_map.inputs["To Max"].default_value=.34
front.data.energy=1050
front.data.size=6.8
rear.data.energy=1080
rear.data.size=5.4
# Retain the angular contribution of white snow reflected from the near
# shore, separate from the actual source in the photographed sky.
frozen=scene.world.node_tree
both=node(frozen,"ShaderNodeMixRGB",Fac=.49)
wire(frozen,softsky,0,both,1)
wire(frozen,env,0,both,2)
wire(frozen,both,0,bg,0)
bg.inputs["Strength"].default_value=.255
# Quieter glints on the sharp edge preserve the contour.
sun.data.specular_factor=.18
sun.data.transmission_factor=.82
grade.inputs["To Min"].default_value=2.09
grade.inputs["To Max"].default_value=.64
