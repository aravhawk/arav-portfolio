# Two freezing fronts alternate snow-ice with clearer blue congelation ice.
# The interface varies slowly in all three dimensions. Its contribution
# accumulates along the transmitted light path inside each whole glyph.
it=ice.node_tree
world=node(it,"ShaderNodeNewGeometry")
zz=node(it,"ShaderNodeSeparateXYZ");wire(it,world,"Position",zz,0)
skew=node(it,"ShaderNodeVectorMath");skew.operation="MULTIPLY"
skew.inputs[1].default_value=(1.0,1.75,.79)
wire(it,world,"Position",skew,0)
cloud=node(it,"ShaderNodeTexNoise",Scale=2.8,Detail=3.0,Roughness=.55,Distortion=.18)
wire(it,skew,0,cloud,0)
frontline=node(it,"ShaderNodeMath");frontline.operation="MULTIPLY_ADD"
wire(it,cloud,0,frontline,0);frontline.inputs[1].default_value=.72;wire(it,zz,"Z",frontline,2)
cap=node(it,"ShaderNodeMapRange");cap.interpolation_type="SMOOTHERSTEP"
cap.inputs["From Min"].default_value=.59;cap.inputs["From Max"].default_value=1.14
cap.inputs["To Min"].default_value=.48;cap.inputs["To Max"].default_value=1.57
wire(it,frontline,0,cap,0)
local_density=node(it,"ShaderNodeMath");local_density.operation="MULTIPLY"
wire(it,cap,0,local_density,0);wire(it,density_gain,0,local_density,1)
wire(it,local_density,0,scat,"Density")
grade.inputs["To Min"].default_value=3.7
grade.inputs["To Max"].default_value=.49
absorb.inputs["Color"].default_value=(.25,.69,.77,1)
density_gain.inputs[2].default_value=2.4
scat.inputs["Color"].default_value=(.71,.91,.95,1)
# The top remains satin. Low winter light passes through the lower
# congelation ice, revealing a cool grey-blue band just above the feet.
bs.inputs["Emission Strength"].default_value=.049
bounds_light.data.energy=690
front.data.energy=1140
rear.data.energy=1360
rough_map.inputs["To Min"].default_value=.15
rough_map.inputs["To Max"].default_value=.29
# Pressure shells should be visible off the foot and optically quiet
# directly under it. A fractured calcite-bright plinth reads incorrectly.
for pocket in pockets:
    pocket.location.z-=.008
    pocket.location.y-=.075
ips.inputs["Transmission Weight"].default_value=.81
ips.inputs["Emission Strength"].default_value=.018
ips.inputs["Base Color"].default_value=(.09,.19,.21,1)
# Modulate density separately from height. Narrow pools follow the inlet;
# a broad range of clear patches allows scattered light on the near spurs.
tt=air.node_tree
islands=node(tt,"ShaderNodeVectorMath");islands.operation="MULTIPLY"
islands.inputs[1].default_value=(.074,.091,.18);wire(tt,p,"Position",islands,0)
patches=node(tt,"ShaderNodeTexNoise",Scale=1.1,Detail=2.4,Roughness=.55)
wire(tt,islands,0,patches,0)
smooth=node(tt,"ShaderNodeMapRange");smooth.interpolation_type="SMOOTHERSTEP"
smooth.inputs["From Min"].default_value=.32;smooth.inputs["From Max"].default_value=.68
smooth.inputs["To Min"].default_value=.12;smooth.inputs["To Max"].default_value=1.23
wire(tt,patches,0,smooth,0)
torn=node(tt,"ShaderNodeMath");torn.operation="MULTIPLY"
wire(tt,dm,0,torn,0);wire(tt,smooth,0,torn,1);wire(tt,torn,0,mist,"Density")
fade.inputs["To Min"].default_value=.022
# Preserve complex subsurface clefts, with air only on segments of each
# cleavage. This attenuates the graphic hairlines crossing the primary lead.
opacity.inputs["To Min"].default_value=.025
opacity.inputs["To Max"].default_value=.71
eb.inputs["Emission Strength"].default_value=.094
