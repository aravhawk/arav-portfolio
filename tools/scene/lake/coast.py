# All three DEMs fall below the water table at their four edges. Their
# measured watersheds form real peninsulas, including their reflection.
for j,(ridge,altfog,fogshade,albedo) in enumerate(ranges):
    mesh=ridge.data
    arr=np.empty((len(mesh.vertices),3),np.float32)
    mesh.vertices.foreach_get("co",arr.ravel())
    x,y,z=arr.T
    x0,x1=x.min(),x.max();y0,y1=y.min(),y.max()
    nearest=np.minimum.reduce([(x-x0)/(x1-x0),(x1-x)/(x1-x0),(y-y0)/(y1-y0),(y1-y)/(y1-y0)])
    term=np.clip(nearest/.19,0,1)
    edge=term**2*(3-2*term)
    z[:]=(z+.64)*edge-.64
    # Translate the origin of the rotation to the centre of the array.
    yc=(y0+y1)*.5
    y-=yc
    ridge.location.y=yc+[2,10,5][j]
    mesh.vertices.foreach_set('co',arr.ravel())
    mesh.update()
ranges[0][0].location.x=-32
ranges[0][0].rotation_euler.z=-.53
ranges[0][0].scale=(1.17,.92,.61)
ranges[1][0].location.x=30
ranges[1][0].rotation_euler.z=-.63
ranges[1][0].scale=(1.25,1,.81)
ranges[2][0].location.x=-12
ranges[2][0].rotation_euler.z=.3
ranges[2][0].scale.z=.76
cam.location=(.32,-17,1.32)
cam.data.angle=math.radians(34.25)
cam.rotation_euler=(Vector((0,0,.61))-cam.location).to_track_quat("-Z","Y").to_euler()
for j,(_,_,fogshade,_) in enumerate(ranges):
    if j==0: fogshade.inputs[0].default_value=(.026,.034,.043,1)
fade.inputs["To Min"].default_value=.016
falloff.inputs["From Max"].default_value=97
sun.data.energy=4.8
sun.data.angle=.015
ray=Vector((.145,1,.095)).normalized()
distance.inputs[1].default_value=ray
sun.rotation_euler=(-ray).to_track_quat("-Z","Y").to_euler()
for obj in [cover,bpy.data.objects["Water below"],network]:
    if obj.name not in suntarget.objects: suntarget.objects.link(obj)
# Scoured bank. Sediment depth clips the two measured length scales at the
# ice surface; the uncovered channels and their scallops use the same relief.
mantle.hide_render=True
xs=np.linspace(-11,11,780)
ys=np.linspace(-21,-1,740)
X,Y=np.meshgrid(xs,ys)
def measured_snow(asset,px,py):
    if asset.startswith("Snow"):
        idx=asset+"_2K-JPG_Displacement.jpg"
        with zipfile.ZipFile(cache/(asset+"_2K-JPG.zip")) as arc:
            import io
            img=Image.open(io.BytesIO(arc.read(idx))).convert("L")
    else: img=Image.open(cache/asset).convert("L")
    tex=np.asarray(img,dtype=np.float32)/255
    return map_coordinates(tex,[np.mod(py,1)*2047,np.mod(px,1)*2047],order=1,mode="wrap")
u=X*.75+Y*.66
v=Y*.75-X*.66
dune=measured_snow("Snow008A",u*.13,v*.24+.045*np.sin(u*.8))
fluff=measured_snow("snow_02_disp_2k.jpg",X*.71,Y*.68)
dent=measured_snow("Snow009A",u*.22,v*.36)
edge=-7.8-Y+.51*X+.87*np.sin(.71*X)+.38*np.sin(1.5*X+.7*Y)+2.5*(dent-.50)
surface_z=np.clip(edge*.038,-.16,.056)+.23*(dune-.47)+.04*(fluff-.52)+.05*(dent-.52)
bank=field("Sastrugi",xs,ys,surface_z,snow)
onlysnow.objects.link(bank)
suntarget.objects.link(bank)
reflector.location=(9,-8,3)
reflector.rotation_euler=(Vector((0,-9,0))-reflector.location).to_track_quat("-Z","Y").to_euler()
reflector.data.energy=2000
reflector.data.size=8
reflector.data.size_y=3.8
# Colour and bump correspond to measured fine snow; erosion provides macro relief.
nt=snow.node_tree
for n in nt.nodes:
    if n.type=="TEX_IMAGE":
        typ=n.image.name
        if "height" in typ: n.image=bpy.data.images.load(str(cache/"snow_02_disp_2k.jpg"),check_existing=True)
        elif "col" in typ: n.image=bpy.data.images.load(str(cache/"snow_02_diff_2k.jpg"),check_existing=True)
micro.inputs["Distance"].default_value=.012
micro.inputs["Strength"].default_value=.42
# Snow lit face normal varies at metre scale, over powder grains.
# Calm lake: retain the camera reflection on shallow ice. The sun shines on the
# nearly black water now, so the slabs throw long measurable shadows onto it.
bedtree=bed.node_tree
watercolors.color_ramp.elements[0].color=(.002,.004,.005,1)
watercolors.color_ramp.elements[1].color=(.034,.046,.055,1)
bsbed.inputs["Emission Strength"].default_value=.14
polar.inputs[0].default_value=.976
network.scale.z=.65
quiet.inputs["To Min"].default_value=.86
fractbs.inputs["Emission Strength"].default_value=.54
# Keep the buried face narrow in plan; opening its depth alone preserves the
# delicate bead of light near the surface while the side recedes into the ice.
front.data.energy=1070
rear.data.energy=720
