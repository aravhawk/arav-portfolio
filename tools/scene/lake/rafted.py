# A single measured sun supplies the visible disc and the illumination.
# The response above the sky shoulder comes only from the captured HDR peak.
wt=scene.world.node_tree
solar=node(wt,"ShaderNodeVectorMath");solar.operation="SCALE";solar.inputs["Scale"].default_value=.072
wire(wt,washed,0,solar,0)
wire(wt,solar,0,sunlit,2)
sunlit.inputs[0].default_value=1
ray=Vector((.168,1,.084)).normalized()
sun.rotation_euler=(-ray).to_track_quat("-Z","Y").to_euler()
cam.location=(-.96,-17,1.63)
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat("-Z","Y").to_euler()
grazing.inputs["From Min"].default_value=15
grazing.inputs["From Max"].default_value=56
grazing.inputs["To Max"].default_value=.80
fade.inputs["To Min"].default_value=.0067
near.location.x=-6.1
near.location.z=-1.94
# Four sheared sheets are rafting in the exposed lead. A tilted sawn top
# terminates on a ragged side instead of continuing as an upright block.
# Each pair overlaps itself and leans into a real foot from a clear side.
r=random.Random(3368)
bigplates=[]
for j,(cx,cy,length,width,thick,tilt,angle) in enumerate([
    (-3.82,-.12,.52,.27,.16,.29,-.38),(-3.67,-.28,.41,.26,.08,-.19,.36),
    (-2.06,-.32,.26,.17,.09,.37,-.21),
    (.22,-.20,.37,.22,.105,-.32,.40),(.23,-.36,.26,.17,.065,.31,-.65),
    (3.74,-.14,.45,.23,.17,-.36,.37),(3.72,-.39,.32,.19,.072,.19,-.45)]):
    hull=[(-.52,-.29),(-.22,-.49),(.38,-.42),(.54,-.09),(.39,.37),(-.14,.52),(-.53,.22)]
    verts=[]
    for z,taper in [(0,1.0),(.65,.975),(1,.87)]:
        for xx,yy in hull:
            px=(xx+r.uniform(-.034,.034))*length*taper
            py=(yy+r.uniform(-.030,.030))*width*taper
            h=thick*(.57+xx*.37+yy*.30)+.005*r.uniform(-1,1)
            verts.append((px,py,z*h))
    ln=len(hull)
    faces=[tuple(reversed(range(ln))),tuple(range(2*ln,3*ln))]
    for k in range(2):
        for l in range(ln):faces.append((k*ln+l,k*ln+(l+1)%ln,(k+1)*ln+(l+1)%ln,(k+1)*ln+l))
    ob=geometry("Rafted ice slab",verts,faces,ice,False)
    ob.rotation_euler=(r.uniform(-.15,.18),tilt,angle)
    ob.location=(cx,cy,.016)
    bv=ob.modifiers.new("Fractured rim","BEVEL");bv.width=.004;bv.segments=2
    receiver.objects.link(ob);suntarget.objects.link(ob);bigplates.append(ob)
bpy.context.view_layer.update()
# Position to one side of a foot until the full sheet projects clear of the
# cut. A sloping tip can still touch the submerged sidewall below the baseline.
R=name.matrix_world.inverted(); eye=R@cam.location
for ob in bigplates:
    pts=np.array([tuple(ob.matrix_world@Vector(c)) for c in ob.bound_box])
    lo,hi=pts.min(axis=0),pts.max(axis=0)
    for k in range(96):
        off=((k+1)//2)*.014*(1 if k%2 else -1)
        if not blocked(off):ob.location.x+=off;break
# Make the lower third quieter by running two long, thinner fracture planes
# into the primary buried wall. Reserve the broadest visible plane for it.
quiet.inputs["To Min"].default_value=.96
fractbs.inputs["Emission Strength"].default_value=.29
rough_map.inputs["To Min"].default_value=.23
rough_map.inputs["To Max"].default_value=.39
bs.inputs["Emission Strength"].default_value=.13
rendergrade=neutral
rendergrade.inputs["Saturation"].default_value=.85
# Close-up ice still contains diaphanous veils in the middle of a stroke.
pigment.inputs[0].default_value=.71
vein_tint.color_ramp.elements[0].color=(.27,.58,.61,1)
scat.inputs["Color"].default_value=(.79,.93,.94,1)
front.data.energy=1060
rear.data.energy=750
