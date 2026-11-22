# Aerial perspective in clear air. The near fracture field sees almost no
# veil, while the distant peak picks up the silver light of the eastern sky.
for k,(ridge,altfog,fogshade,rock) in enumerate(ranges):
    mt=ridge.data.materials[0].node_tree
    output=mt.nodes.get("Material Output")
    src=output.inputs[0].links[0].from_node
    pos=node(mt,"ShaderNodeNewGeometry")
    dist=node(mt,"ShaderNodeVectorMath")
    dist.operation="DISTANCE"
    wire(mt,pos,"Position",dist,0)
    dist.inputs[1].default_value=cam.location
    ext=node(mt,"ShaderNodeMapRange")
    ext.inputs["From Min"].default_value=60
    ext.inputs["From Max"].default_value=260
    ext.inputs["To Min"].default_value=.075
    ext.inputs["To Max"].default_value=.82
    ext.interpolation_type="SMOOTHERSTEP"
    wire(mt,dist,"Value",ext,0)
    inscatter=node(mt,"ShaderNodeEmission",Color=(.48,.55,.60,1))
    val=node(mt,"ShaderNodeMixShader")
    wire(mt,ext,0,val,0)
    wire(mt,src,0,val,1)
    wire(mt,inscatter,0,val,2)
    wire(mt,val,0,output,0)
# A foreshore inclines gently into the basin rather than rising abruptly.
foreshore.scale.z=.31
foreshore.location.z=-.13
foreshore.location.y=7
screeBs.inputs['Emission Strength'].default_value=.055
for n in ct.nodes:
    if n.type=="BUMP":
        n.inputs["Distance"].default_value=.025
        n.inputs["Strength"].default_value=.32
for k,c in enumerate(crags):
    c.location.y+=7+2*math.cos(k*2)
    c.location.z-=.75
    c.scale.z*=.72
    if k in (2,4):c.hide_render=True
# Let small bands of mist follow the lower gullies instead of fading every
# point at the exact same height. Their turbulence is in world coordinates.
tr=air.node_tree
drift.inputs["Scale"].default_value=.155
windshape=node(tr,"ShaderNodeVectorMath")
windshape.operation="MULTIPLY"
windshape.inputs[1].default_value=(.57,.35,1.8)
wire(tr,pos if pos.id_data==tr else tr.nodes.get('Geometry'),"Position",windshape,0)
wire(tr,windshape,0,drift,0)
wav=node(tr,"ShaderNodeMath")
wav.operation="MULTIPLY_ADD"
wire(tr,drift,0,wav,0)
wav.inputs[1].default_value=-3.4
wire(tr,alt,"Z",wav,2)
wire(tr,wav,0,fade,0)
fade.inputs["From Min"].default_value=-.53
fade.inputs["From Max"].default_value=1.3
fade.inputs["To Min"].default_value=.010
# Dress the broad faces with a second freezing front beneath the satin skin.
# Crack sheets are pale from trapped air, with a softer specular lobe.
fb.inputs["Roughness"].default_value=.31
fb.inputs["Base Color"].default_value=(.88,.95,.95,1)
fb.inputs["Transmission Weight"].default_value=.35
fb.inputs["Emission Color"].default_value=(.68,.83,.85,1)
fb.inputs["Emission Strength"].default_value=.13
rough_map.inputs["To Min"].default_value=.19
rough_map.inputs["To Max"].default_value=.42
scat.inputs["Anisotropy"].default_value=.32
absorb.inputs["Density"].default_value=1.64
front.location=(-2.8,-3.7,3.2)
front.data.energy=655
front.data.size=7.3
rear.location=(3.65,3.8,1.75)
rear.data.energy=1070
rear.data.size=6.4
bs.inputs["Emission Strength"].default_value=.097
# Bury the very lowest edge below the black ice. A translucent apron of
# minor seal fractures beds the stones; the clear channels take the light.
for obj in [name,*faults]:obj.location.z-=.013
# Keep the held-up contact chips in small lee-side clusters around the base.
for j,chip in enumerate(chips):
    chip.location.z-=.015
    if j%6!=2:chip.scale*=.82
# Keep the sky's chromatic shoulder as a broad glow and resolve the disc
# within it. Compress the measured HDR radiance before adding that source.
wt=scene.world.node_tree
ceiling=node(wt,"ShaderNodeVectorMath")
ceiling.operation="MINIMUM"
ceiling.inputs[1].default_value=(1.08,1.13,1.19)
wire(wt,cool,0,ceiling,0)
wire(wt,ceiling,0,sunlit,1)
skybg.inputs["Strength"].default_value=.93
sunlit.inputs[0].default_value=.91
ray=Vector((.151,1,.080)).normalized()
distance.inputs[1].default_value=ray
sun.rotation_euler=(-ray).to_track_quat("-Z","Y").to_euler()
# Slight aerial desaturation while preserving the pale aquamarine slab.
scene.view_settings.look="AgX - Medium Low Contrast"
