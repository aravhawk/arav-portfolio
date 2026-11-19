# At grazing incidence the distant frozen lake approaches a mirror. Use the
# actual shaded range as its reflection, with the same air between it and
# the lens. The lake keeps a clear dark window around the cut slabs.
lt=lid.node_tree
grazing=node(lt,"ShaderNodeMapRange")
grazing.interpolation_type="SMOOTHERSTEP"
grazing.inputs["From Min"].default_value=4.1
grazing.inputs["From Max"].default_value=38.0
grazing.inputs["To Min"].default_value=0
grazing.inputs["To Max"].default_value=.94
wire(lt,distance_along,"Y",grazing,0)
far_ref=node(lt,"ShaderNodeBsdfGlossy",Color=(.9,.93,.95,1),Roughness=.088)
ridge_ref=node(lt,"ShaderNodeMixShader")
wire(lt,grazing,0,ridge_ref,0);wire(lt,combine,0,ridge_ref,1);wire(lt,far_ref,0,ridge_ref,2)
wire(lt,ridge_ref,0,near_mix,1)
falloff.inputs["To Max"].default_value=.23
falloff.inputs["From Min"].default_value=26
falloff.inputs["From Max"].default_value=130
haze_color.inputs[0].default_value=(.10,.125,.139,1)
# Streaks of exposed basal rock interrupt windward snow. The cut line
# follows height and local drainage, so a distant snow gully reaches far
# down the face while a buttress beside it stays dark.
mt=near.data.materials[0].node_tree
geo=node(mt,"ShaderNodeNewGeometry")
nalt=node(mt,"ShaderNodeSeparateXYZ")
wire(mt,geo,"Position",nalt,0)
wear=node(mt,"ShaderNodeTexNoise",Scale=.32,Detail=4,Roughness=.65)
wire(mt,geo,"Position",wear,0)
offset=node(mt,"ShaderNodeMath");offset.operation="MULTIPLY_ADD"
wire(mt,wear,"Fac",offset,0);offset.inputs[1].default_value=2.65;wire(mt,nalt,"Z",offset,2)
sline=node(mt,"ShaderNodeMapRange")
sline.interpolation_type="SMOOTHERSTEP"
sline.inputs["From Min"].default_value=1.65
sline.inputs["From Max"].default_value=4.6
wire(mt,offset,0,sline,0)
strata=node(mt,"ShaderNodeValToRGB")
strata.color_ramp.elements[0].position=.025
strata.color_ramp.elements[0].color=(.011,.016,.022,1)
strata.color_ramp.elements[1].position=.47
strata.color_ramp.elements[1].color=(.064,.078,.087,1)
wire(mt,terrainm,0,strata,0)
base=node(mt,"ShaderNodeMixRGB")
wire(mt,sline,0,base,0);wire(mt,strata,0,base,1);wire(mt,snowvary,0,base,2)
wire(mt,base,0,db,"Base Color");wire(mt,base,0,db,"Emission Color")
# Foreground snow uses the real 2m scan for optical scale. The wind lip
# is displaced, while the compacted grains perturb only its local normal.
nmesh=nextbank.data
verts=np.empty((len(nmesh.vertices),3),np.float32);nmesh.vertices.foreach_get("co",verts.ravel())
ids=np.empty(len(nmesh.loops),np.int32);nmesh.loops.foreach_get('vertex_index',ids)
nuv=nmesh.uv_layers.new(name="Crust")
nuv.data.foreach_set("uv",((verts[ids,:2]*.67).astype(np.float32)).ravel())
st=snow.node_tree
nmap=node(st,"ShaderNodeTexImage")
nmap.image=bpy.data.images.load(str(cache/"snow_02_nor_gl_2k.jpg"),check_existing=True)
nmap.image.colorspace_settings.name="Non-Color"
wire(st,node(st,"ShaderNodeUVMap"),0,nmap,0)
normalmap=node(st,"ShaderNodeNormalMap",Strength=.93)
wire(st,nmap,0,normalmap,"Color")
wire(st,normalmap,"Normal",micro,"Normal")
snowbs.inputs['Subsurface Weight'].default_value=.055
snowbs.inputs['Subsurface Scale'].default_value=.01
reflector.data.energy=820
# Preserve the structure in the photographic sky while rolling the high end.
sky=scene.world.node_tree
gamma=node(sky,"ShaderNodeGamma",Gamma=.50)
wire(sky,cool,0,gamma,0)
joint=node(sky,"ShaderNodeMixRGB",Fac=.38)
wire(sky,gain,0,joint,1);wire(sky,gamma,0,joint,2)
wire(sky,joint,0,sunlit,1)
skybg.inputs["Strength"].default_value=.75
# Neutralise the cool capture while retaining the edge transmission of ice.
comp=scene.node_tree
neutral=node(comp,"CompositorNodeHueSat",Saturation=.81)
wire(comp,comp.nodes.get("Render Layers"),"Image",neutral,"Image")
wire(comp,neutral,0,comp.nodes.get("Composite"),0)
cam.location=(-.96,-17,1.44)
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat("-Z","Y").to_euler()
front.data.energy=1130
bs.inputs["Emission Strength"].default_value=.12
near.location.z=-2.42
near.location.x=4
fade.inputs["To Min"].default_value=.006
gb.inputs['Base Color'].default_value=(.106,.124,.132,1)
