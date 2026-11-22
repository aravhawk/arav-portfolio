from bpy_extras.object_utils import world_to_camera_view
# Place each small plate alongside an actual foot. Both rendered cameras and
# the counter shapes can see daylight through the resulting gaps.
bpy.context.view_layer.update()
tree=BVHTree.FromObject(name,bpy.context.evaluated_depsgraph_get())
def hits_letters(x,y,z):
    v=Vector((x,y,z))
    return tree.ray_cast(cam.location,(v-cam.location).normalized())[0] is not None
for j,obj in enumerate(chips):
    # Light contact with the side of the letter rather than a pile behind it.
    obj.location.y=-.06+(j%4)*.055
    original=obj.location.x
    radius=max(obj.dimensions.x,obj.dimensions.y)*.60
    for off in range(85):
        shift=(off+1)//2*(1 if off%2 else -1)*.016
        x=original+shift
        if not any(hits_letters(x+dx,obj.location.y,z) for dx in [-radius,0,radius] for z in [.01,.035,.072]):
            obj.location.x=x
            break
# Hone the visible faces and retain the mixed optical depths of an actual
# sawn slab. The dark blue veins of the CC0 ice measurement become *density*.
it=ice.node_tree
def extract(src,ending):
    with zipfile.ZipFile(cache/(src+"_2K-JPG.zip")) as archive:
        member=next(f for f in archive.namelist() if f.endswith(ending))
        path=cache/member
        if not path.exists(): path.write_bytes(archive.read(member))
    return bpy.data.images.load(str(path),check_existing=True)
tex=node(it,"ShaderNodeTexImage")
tex.image=extract("Ice004","_Color.jpg")
mapping=node(it,"ShaderNodeMapping")
mapping.inputs["Rotation"].default_value=(math.pi*.5,.44,.43)
mapping.inputs["Scale"].default_value=(.89,.65,.85)
wire(it,node(it,"ShaderNodeTexCoord"),"Object",mapping,0)
wire(it,mapping,0,tex,0)
scatter_map=node(it,"ShaderNodeValToRGB")
scatter_map.color_ramp.elements[0].position=.048
scatter_map.color_ramp.elements[0].color=(.012,.012,.012,1)
scatter_map.color_ramp.elements[1].position=.68
scatter_map.color_ramp.elements[1].color=(.96,.96,.96,1)
wire(it,tex,0,scatter_map,0)
wire(it,scatter_map,0,density_gain,0)
density_gain.inputs[1].default_value=5.4
pigment=node(it,"ShaderNodeMixRGB",Fac=.60)
wire(it,bands,0,pigment,1)
vein_tint=node(it,"ShaderNodeValToRGB")
vein_tint.color_ramp.elements[0].position=.025
vein_tint.color_ramp.elements[0].color=(.34,.66,.69,1)
vein_tint.color_ramp.elements[1].position=.68
vein_tint.color_ramp.elements[1].color=(.93,.985,.95,1)
wire(it,tex,0,vein_tint,0)
wire(it,vein_tint,0,pigment,2)
wire(it,pigment,0,bs,"Base Color")
bs.inputs["Emission Strength"].default_value=.035
bs.inputs["Transmission Weight"].default_value=.83
# Long irregular ribbon pairs buried inside each glyph. Sample every ribbon
# at both depths and retain cells only where all four corners are enclosed.
rng=random.Random(3922)
verts,faces=[],[]
for j in range(39):
    x=rng.uniform(-3.5,3.5)
    z=rng.uniform(.04,1.26)
    angle=rng.uniform(.48,1.14)*rng.choice([-1,1])
    dz=.010*math.sin(angle)
    dx=.010*math.cos(angle)
    length=rng.randrange(23,92)
    tilt=rng.uniform(-.65,.65)
    for k in range(length):
        t=k/length
        depth=.018+.062*math.sin(math.pi*t)**.5
        p=[(x,-.10,z),(x+dx,-.10,z+dz),(x+dx+depth*tilt,-.10+depth,z+dz+.32*depth),(x+depth*tilt,-.10+depth,z+.32*depth)]
        if all((hit:=tree.ray_cast((px,-1,pz),(0,1,0))[0]) is not None and hit.y<py-.01 for px,py,pz in p):
            k0=len(verts);verts+=p;faces.append(tuple(range(k0,k0+4)))
        x+=dx+rng.uniform(-.0008,.0008)
        z+=dz+rng.uniform(-.001,.001)
if faces:
    sheets=geometry("Embedded cleavage",verts,faces,fault,False)
    receiver.objects.link(sheets)
    faults.append(sheets)
