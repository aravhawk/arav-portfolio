# Resolve the edge of each primary pressure crack in section. A single
# tapering face runs down into the dark ice. Bulbs along that face interrupt
# the transmitted view at depth while leaving the upper opening very thin.
for label,phase in [('Main shear and keel',.0),('Shallow splay',2.37)]:
    mesh=bpy.data.objects[label].data
    vv=np.empty((len(mesh.vertices),3),np.float32)
    mesh.vertices.foreach_get("co",vv.ravel())
    row=vv.reshape(-1,6,3)
    top=row[:,:2,:].mean(axis=1)
    q=np.linspace(0,1,len(row))
    dist=np.maximum(0,(top[:,None,2]-row[:,:,2]))
    side=np.sin(q*math.pi*9+phase)+.37*np.sin(q*math.pi*21)
    # The underlying joint dips and reverses direction in successive runs.
    row[:,:,0]=top[:,None,0]+(row[:,:,0]-top[:,None,0])*(.56+.17*side[:,None])+dist*(.64*side[:,None])
    row[:,:,2]=top[:,None,2]-dist*(.85+.48*side[:,None])
    mesh.vertices.foreach_set("co",row.ravel());mesh.update()
# The lake surface returns more of the nearby sky and the slabs after the
# contact region. Reduce diffuse return from the bed to preserve black panes.
refzone.inputs["To Min"].default_value=.109
roughzone.inputs["To Min"].default_value=.14
bsbed.inputs["Emission Strength"].default_value=.15
watercolors.color_ramp.elements[1].color=(.047,.065,.078,1)
opacity.inputs["To Max"].default_value=.62
# The uppermost corners are distinct from one another in the reflected
# light. A broad light from snow just outside camera thickens the lower
# shadows very slightly, retaining the blue of the lower congelation layer.
bounds_light.data.energy=720
front.data.energy=1210
# Darken the glancing reflected foot just below the surface with a realistic
# clear open lead beyond it. A smaller, embedded shard catches the sunlight.
for k,ob in enumerate(bigplates):
    if k in (0,2,4,6):
        ob.scale.x*=.79
        ob.rotation_euler.x+=.14
        ob.location.z-=.014
calm=scene.world.node_tree
solar.inputs["Scale"].default_value=.083
