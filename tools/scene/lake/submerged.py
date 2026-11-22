# Water extinction on the submerged part of the surveyed basin. Rays looking
# through the clear ice previously saw the dry rock shader to the lake bed.
mt=near.data.materials[0].node_tree
output=mt.nodes.get("Material Output")
dry=output.inputs["Surface"].links[0].from_node
depth=node(mt,"ShaderNodeMapRange")
depth.interpolation_type="SMOOTHERSTEP"
depth.inputs["From Min"].default_value=-.38
depth.inputs["From Max"].default_value=.09
wire(mt,nalt,"Z",depth,0)
drowned=node(mt,"ShaderNodeBsdfDiffuse",Color=(.006,.011,.015,1),Roughness=.86)
wet=node(mt,"ShaderNodeMixShader")
wire(mt,depth,0,wet,0);wire(mt,drowned,0,wet,1);wire(mt,dry,0,wet,2)
wire(mt,wet,0,output,"Surface")
# Small, eroded deltas interrupt the level waterline. Work in world units
# and taper the displacement along both sides of the bank's water table.
bpy.context.view_layer.update()
mesh=near.data
coords=np.empty((len(mesh.vertices),3),np.float32)
mesh.vertices.foreach_get("co",coords.ravel())
m=np.asarray(near.matrix_world)
wp=coords@m[:3,:3].T+m[:3,3]
px,py,pz=wp.T
shoreweight=np.exp(-((pz-.10)/1.3)**2)*np.clip((85-py)/18,0,1)
lobes=np.cos(px*.23+.48*np.sin(py*.43))+.36*np.cos(px*.71)
coords[:,2]+=shoreweight*(.95*lobes+.34*lobes**2-.31)/near.scale.z
mesh.vertices.foreach_set("co",coords.ravel());mesh.update()
# Locally thicker mist in the shore gullies, thinning smoothly towards
# the open water. The dark window immediately behind the type stays clear.
tt=air.node_tree
p=node(tt,"ShaderNodeNewGeometry");coords3=node(tt,"ShaderNodeSeparateXYZ")
wire(tt,p,"Position",coords3,0)
inlet=node(tt,"ShaderNodeMapRange")
inlet.interpolation_type="SMOOTHERSTEP"
inlet.inputs["From Min"].default_value=27
inlet.inputs["From Max"].default_value=47
inlet.inputs["To Min"].default_value=.15
inlet.inputs["To Max"].default_value=5.9
wire(tt,coords3,"Y",inlet,0)
dm=node(tt,"ShaderNodeMath");dm.operation="MULTIPLY"
wire(tt,density,0,dm,0);wire(tt,inlet,0,dm,1);wire(tt,dm,0,mist,"Density")
fade.inputs["To Min"].default_value=.026
# Break up the uninterrupted contour on the rear ridge. Preserve the
# terrain albedo there and reduce the amount of synthetic aerial light.
for ridge,_,_,_ in ranges[1:]:
    tree=ridge.data.materials[0].node_tree
    for nd in tree.nodes:
        if nd.type=="MAP_RANGE" and abs(nd.inputs['From Max'].default_value-260)<.01:
            nd.inputs['To Max'].default_value=.38
# A close asymmetric raking source makes one compacted lip catch light and
# leaves the following trough in blue skylight.
reflector.location=(9,-7.4,1.4)
reflector.rotation_euler=(Vector((0,-8,0))-reflector.location).to_track_quat("-Z","Y").to_euler()
reflector.data.size=3.9
reflector.data.size_y=1.6
reflector.data.energy=1440
