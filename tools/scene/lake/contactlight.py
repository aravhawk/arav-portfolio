# A submerged DEM must actually descend below the opaque water. Its cropped
# edge previously showed through the clear upper surface in a straight line.
mesh=foreshore.data
xyz=np.empty((len(mesh.vertices),3),np.float32)
mesh.vertices.foreach_get('co',xyz.ravel())
gx,gy,gz=xyz.T
shore_y=33.5+2.3*np.sin(gx*.24)+1.4*np.cos(gx*.57)+.75*np.sin(gx*.79)
under=np.maximum(shore_y-gy,0)
gz-=under*.82
mesh.vertices.foreach_set('co',xyz.ravel());mesh.update()
# Lower fog follows and partly obscures the actual land/water intersection;
# the color of the lower rock is still defined by its surface, in broken shade.
for j,(ridge,airmix,shade,_) in enumerate(ranges):
    if j==0:
        airmix.inputs["To Min"].default_value=.17
        shade.inputs[0].default_value=(.079,.096,.109,1)
foreshore.scale.z=.55
foreshore.location.z=-.28
# Use the sky photograph's dynamic range to carry shape past the disc.
# Per-channel clipping made the whole sky flat. Reinhard radiance retains
# cloud contrast over the bright horizon before the simulated disc is added.
wt=scene.world.node_tree
oneplus=node(wt,"ShaderNodeVectorMath")
oneplus.operation="ADD"
wire(wt,cool,0,oneplus,0)
oneplus.inputs[1].default_value=(.59,.59,.59)
rolled=node(wt,"ShaderNodeVectorMath")
rolled.operation="DIVIDE"
wire(wt,cool,0,rolled,0)
wire(wt,oneplus,0,rolled,1)
gain=node(wt,"ShaderNodeVectorMath")
gain.operation="SCALE";gain.inputs["Scale"].default_value=1.78
wire(wt,rolled,0,gain,0)
wire(wt,gain,0,sunlit,1)
sun_ramp.color_ramp.elements[0].color=(5.3,5.13,4.83,1)
sunlit.inputs[0].default_value=.90
skybg.inputs["Strength"].default_value=.96
# Broad ice faces show a little side depth and sit lower into the frozen skin.
cam.location=(-1.82,-16.92,1.48)
cam.rotation_euler=(Vector((.015,0,.61))-cam.location).to_track_quat("-Z","Y").to_euler()
cam.data.angle=math.radians(34.2)
# On fine deposits of snow, even a clear slab throws a visible long shadow.
# The frost thins into the black mirror, with open windows between its grains.
gr,gb=surface("Surface frost",(.18,.21,.22),.84)
gt=gr.node_tree
worldpos=node(gt,"ShaderNodeNewGeometry")
sxyz=node(gt,"ShaderNodeSeparateXYZ")
wire(gt,worldpos,"Position",sxyz,0)
grains=node(gt,"ShaderNodeTexNoise",Scale=18,Detail=3)
wire(gt,worldpos,"Position",grains,0)
rect=node(gt,"ShaderNodeVectorMath")
rect.operation="MULTIPLY"
wire(gt,worldpos,"Position",rect,0)
rect.inputs[1].default_value=(.13,.10,0)
rad=node(gt,"ShaderNodeVectorMath")
rad.operation="LENGTH";wire(gt,rect,0,rad,0)
fadegr=node(gt,"ShaderNodeMapRange")
fadegr.interpolation_type="SMOOTHERSTEP"
fadegr.inputs["From Min"].default_value=.2
fadegr.inputs["From Max"].default_value=.95
fadegr.inputs["To Min"].default_value=.29
fadegr.inputs["To Max"].default_value=0
wire(gt,rad,"Value",fadegr,0)
fac=node(gt,"ShaderNodeMath");fac.operation="MULTIPLY"
wire(gt,fadegr,0,fac,0);wire(gt,grains,0,fac,1)
gmix=node(gt,"ShaderNodeMixShader")
wire(gt,fac,0,gmix,0);wire(gt,node(gt,"ShaderNodeBsdfTransparent"),0,gmix,1)
wire(gt,gb,0,gmix,2);wire(gt,gmix,0,gt.nodes.get("Material Output"),0)
frostfilm=sheet("Refrozen surface frost",[-8,8],[-11,11],lambda x,y:.0013,gr)
suntarget.objects.link(frostfilm)
sun.data.energy=5.6
# Small, discontinuous snow pockets deposit in the lee of the grounded shards.
r=random.Random(88651)
pockets=[]
for kk,(cx,cy,length,width) in enumerate([(-3.58,-.47,.50,.115),(-2,-.47,.37,.078),(-.07,-.52,.22,.07),(.57,-.62,.28,.087),(3.73,-.52,.66,.135)]):
    Xs=np.linspace(cx-length,cx+length,72);Ys=np.linspace(cy-width*1.5,cy+width*1.5,29)
    xp,yp=np.meshgrid(Xs,Ys)
    flake=measured_snow("snow_02_disp_2k.jpg",xp*2.2,yp*2.2)
    streak=1-((xp-cx)/length)**2-((yp-cy+.045*np.sin((xp-cx)*7))/width)**2
    zp=.012*streak+.021*(flake-.50)
    po=field("Foot drift",Xs,Ys,zp,snow)
    suntarget.objects.link(po);onlysnow.objects.link(po);pockets.append(po)
# Position the rendered shape, including the small fragments from the scan,
# against the final camera. Add a two-centimetre guard for the soft rim.
bpy.context.view_layer.update()
R=name.matrix_world.inverted()
eye=R@cam.location
local_tree=BVHTree.FromObject(name,bpy.context.evaluated_depsgraph_get())
fragment_mesh=bpy.data.objects["rock_09_LOD0"].data
for ob in [o for o in scene.objects if o.type=="MESH" and o.data==fragment_mesh and not o.hide_render]:
    M=ob.matrix_world.copy()
    vv=[M@Vector(c) for c in ob.bound_box]
    lo=np.min(np.array(vv),axis=0)-.018
    hi=np.max(np.array(vv),axis=0)+.018
    def blocked(d):
        for x in np.linspace(lo[0],hi[0],5):
            for y in [lo[1],hi[1]]:
                for z in np.linspace(lo[2],hi[2],4):
                    pos=R@Vector((x+d,y,z))
                    if local_tree.ray_cast(eye,(pos-eye).normalized())[0] is not None:return True
        return False
    for k in range(121):
        off=(-1 if k%2 else 1)*((k+1)//2)*.019
        if not blocked(off):
            ob.location.x+=off;break
# Keep a simple pressure-zone reflection and the shadow attached to the whole word.
fade.inputs["To Min"].default_value=.009
refzone.inputs["To Min"].default_value=.037
refzone.inputs["To Max"].default_value=.0001
front.location=(-3,-4,2.8)
front.data.energy=1040
rear.data.energy=760
