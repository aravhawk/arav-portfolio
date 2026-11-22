# The central basin cuts into one DEM at its water table. Use its existing
# registered rock and snow maps along the whole bank, without a shore strip.
foreshore.hide_render=True
for c in crags:c.hide_render=True
near,lowfog,lowair,_=ranges[0]
near.location=(.0,80,-1.92)
near.rotation_euler.z=-.33
near.scale=(.99,1.12,.90)
# Deepen the natural inlet in the middle and bring the crag on the right
# farther into the lake. All exposed relief remains originally surveyed.
mesh=near.data
ar=np.empty((len(mesh.vertices),3),np.float32);mesh.vertices.foreach_get("co",ar.ravel())
xn,yn,zn=ar.T
zn-=2.80*np.exp(-((xn+4)/14)**2-((yn+6)/18)**2)
yn+=6.1*np.sin(xn*.074)+2.8*np.cos(xn*.163)
edge=np.maximum(0,(-20-yn)*.75)
zn-=edge
mesh.vertices.foreach_set("co",ar.ravel());mesh.update()
mt=near.data.materials[0].node_tree
db=mt.nodes.get('Principled BSDF')
terrainm=next(n for n in mt.nodes if n.type=="TEX_IMAGE")
topo=node(mt,"ShaderNodeValToRGB")
topo.color_ramp.elements[0].position=.024
topo.color_ramp.elements[0].color=(.025,.033,.041,1)
topo.color_ramp.elements[1].position=.51
topo.color_ramp.elements[1].color=(.42,.49,.51,1)
wire(mt,terrainm,0,topo,0)
normal=node(mt,"ShaderNodeSeparateXYZ")
wire(mt,node(mt,"ShaderNodeNewGeometry"),"True Normal",normal,0)
deposit=node(mt,"ShaderNodeMapRange")
deposit.inputs['From Min'].default_value=.67
deposit.inputs['From Max'].default_value=.96
deposit.inputs['To Min'].default_value=.0
deposit.inputs['To Max'].default_value=.65
wire(mt,normal,"Z",deposit,0)
snowvary=node(mt,"ShaderNodeMixRGB")
wire(mt,deposit,0,snowvary,0)
wire(mt,topo,0,snowvary,1)
snowvary.inputs[2].default_value=(.44,.50,.53,1)
wire(mt,snowvary,0,db,'Base Color')
wire(mt,snowvary,0,db,'Emission Color')
db.inputs['Emission Strength'].default_value=.118
lowfog.inputs['To Min'].default_value=.20
lowfog.inputs['To Max'].default_value=.035
lowair.inputs[0].default_value=(.11,.135,.15,1)
# A narrow apron of wind-borne frost persists only downwind, in front of the
# slabs. This is where the low sun can inscribe its long contact shadows.
bgf=gr.node_tree
gb.inputs["Specular IOR Level"].default_value=0
wind=node(bgf,"ShaderNodeMapRange")
wind.interpolation_type='SMOOTHERSTEP'
wind.inputs['From Min'].default_value=-1.45
wind.inputs['From Max'].default_value=-.27
wind.inputs['To Min'].default_value=.83
wind.inputs['To Max'].default_value=.018
wire(bgf,sxyz,"Y",wind,0)
windfac=node(bgf,"ShaderNodeMath");windfac.operation="MULTIPLY"
wire(bgf,wind,0,windfac,0);wire(bgf,fac,0,windfac,1);wire(bgf,windfac,0,gmix,0)
fadegr.inputs["To Min"].default_value=.19
# The two-dimensional exterior and the wall at depth read independently;
# its registered UVs give the fracture a porous rim and a clearer core.
fm=fractures.data
idx=np.empty(len(fm.loops),np.int32);fm.loops.foreach_get('vertex_index',idx)
co=np.empty((len(fm.vertices),3),np.float32);fm.vertices.foreach_get('co',co.ravel())
uu=co[:,0]*.68+co[:,1]*.46
vv=(np.arange(len(co))%3)*.34+co[:,0]*.063+co[:,1]*.025
uvlayer=fm.uv_layers.new(name="Fracture depth")
uvlayer.data.foreach_set("uv",np.stack([uu[idx],vv[idx]],axis=1).ravel().astype(np.float32))
ct=fract.node_tree
slip=node(ct,"ShaderNodeTexImage");slip.image=extract("Ice004","_Color.jpg")
wire(ct,node(ct,'ShaderNodeUVMap'),0,slip,0)
fleck=node(ct,"ShaderNodeValToRGB")
fleck.color_ramp.elements[0].position=.044
fleck.color_ramp.elements[0].color=(.040,.054,.061,1)
fleck.color_ramp.elements[1].position=.43
fleck.color_ramp.elements[1].color=(.87,.94,.94,1)
wire(ct,slip,0,fleck,0)
wire(ct,fleck,0,fractbs,'Base Color')
wire(ct,fleck,0,fractbs,'Emission Color')
wire(ct,slip,0,frosted,"Height")
frosted.inputs['Distance'].default_value=.0005
opacity=node(ct,"ShaderNodeMapRange")
opacity.inputs['From Min'].default_value=.013
opacity.inputs['From Max'].default_value=.49
opacity.inputs['To Min'].default_value=.08
opacity.inputs['To Max'].default_value=.92
wire(ct,slip,0,opacity,0)
hard=ct.nodes.get("Material Output").inputs[0].links[0].from_node
clear=node(ct,"ShaderNodeMixShader")
wire(ct,opacity,0,clear,0);wire(ct,node(ct,"ShaderNodeBsdfTransparent"),0,clear,1);wire(ct,hard,0,clear,2)
wire(ct,clear,0,ct.nodes.get("Material Output"),0)
fractures.scale.z=.77
# Lift the last light onto the plate edges, leaving the clouds photographed.
cam.location=(-.88,-17.0,1.20)
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat("-Z","Y").to_euler()
ranges[1][0].location.x=16
ranges[1][0].scale.z=.68
ranges[2][0].scale.z=.64
nextbank.rotation_euler.z=-.16
nextbank.location=(-.21,.25,0)
nextbank.scale.z=1.28
fade.inputs["To Min"].default_value=.012
front.data.energy=1090
rear.data.energy=885
for e in sun_ramp.color_ramp.elements:
    if e.position < .004: e.color=(6.2,6,5.85,1)
