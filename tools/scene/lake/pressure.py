# Find the actual contact intervals at a few centimetres above water. Two legs
# of the A and two legs of n each load different parts of the ice sheet.
xs_contact=np.linspace(-4.1,4.1,941)
inside=[]
for x in xs_contact:
    start=R@Vector((x,-1,.042))
    hit=local_tree.ray_cast(start,(0,1,0))[0]
    inside.append(hit is not None)
split=np.flatnonzero(np.diff(np.r_[False,inside,False]))
feet=[(xs_contact[a],xs_contact[min(b,len(xs_contact)-1)]) for a,b in zip(split[::2],split[1::2]) if b-a>3]
# Short shell-like fractures under individual load points. Join shared
# strip edges so a single pressure fissure recedes smoothly into the ice.
r=random.Random(94771)
verts,faces=[],[]
for j,(left,right) in enumerate(feet):
    for k in range(2 if j%3 else 3):
        mid=(left+right)/2
        radius=(right-left)*.62+r.uniform(.017,.062)+k*.043
        frontY=-.164
        length=r.uniform(.13,.27)+.032*k
        count=64
        angle0=r.uniform(.04,.56);sweep=r.uniform(2.05,2.85)
        prev=len(verts)
        for a in range(count+1):
            t=a/count
            angle=angle0+sweep*t
            x=mid+radius*math.cos(angle)*(1+.08*math.sin(t*9+j))
            y=frontY-length*math.sin(angle)+.016*math.sin(t*17+j)
            depth=.020*math.sin(math.pi*t)**.72
            verts.extend([(x,y,-.0012),(x+.35*depth*math.cos(angle),y-.35*depth*math.sin(angle),-.0015-depth)])
            l=prev+2*a
            if a:faces.append((l-2,l,l+1,l-1))
icepressure,ips=surface("Refrozen pressure seal",(.28,.38,.40),.48)
ips.inputs["Transmission Weight"].default_value=.42
ips.inputs["IOR"].default_value=1.12
ips.inputs["Emission Color"].default_value=(.26,.33,.35,1)
ips.inputs["Emission Strength"].default_value=.10
shells=geometry("Buried contact arcs",verts,faces,icepressure,True)
suntarget.objects.link(shells)
# Patches of trapped air form veins where the slab freezes most slowly in
# its core. The lower middle absorbs more of its long transmitted path.
it=ice.node_tree
zmath=node(it,"ShaderNodeSeparateXYZ")
wire(it,node(it,"ShaderNodeTexCoord"),"Object",zmath,0)
grade=node(it,"ShaderNodeMapRange")
grade.interpolation_type="SMOOTHERSTEP"
grade.inputs["From Min"].default_value=.015
grade.inputs["From Max"].default_value=1.12
grade.inputs["To Min"].default_value=2.46
grade.inputs["To Max"].default_value=.72
wire(it,zmath,"Z",grade,0);wire(it,grade,0,absorb,"Density")
absorb.inputs["Color"].default_value=(.31,.68,.73,1)
front.location=(-2.4,-3.8,3.6)
front.data.energy=975
rear.data.energy=915
bs.inputs["Emission Strength"].default_value=.11
# Branched internal interfaces are sheets, clipped within the sawn faces.
# Their width is the width in the plane, never a cut into the outline.
V,F=[],[]
r=random.Random(2204)
def inner_fan(x,z,angle,L,y0,span):
    dx,dz=math.cos(angle),math.sin(angle)
    n=round(L/.008)
    for k in range(n):
        t=k/n
        width=span*(math.sin(t*math.pi)**.6)*(.8+.2*math.sin(k*.18))
        xa=x+t*L*dx+.011*math.sin(6*t);za=z+t*L*dz
        xb=x+(t+1/n)*L*dx+.011*math.sin(6*(t+1/n));zb=z+(t+1/n)*L*dz
        y=y0+.025*math.sin(t*3)
        quad=[(xa,y,za),(xb,y,zb),(xb-width*.39,y+width,zb+.46*width),(xa-width*.39,y+width,za+.46*width)]
        if all((hit:=local_tree.ray_cast((px,-1,pz),(0,1,0))[0]) is not None and hit.y<py-.025 for px,py,pz in quad):
            m=len(V) 
            V.extend(quad);F.append((m,m+1,m+2,m+3))
for a,b in feet:
    if b-a<.075:continue
    mid=(a+b)/2
    z=r.uniform(.05,.47);ang=r.uniform(.81,1.32)*r.choice([-1,1])
    inner_fan(mid,z,ang,r.uniform(.22,.6),r.uniform(-.13,-.065),r.uniform(.025,.07))
    inner_fan(mid,z,ang+r.uniform(.15,.34),r.uniform(.08,.28),-.10,r.uniform(.015,.036))
if F:
    icefan=geometry("Buried branching veils",V,F,fault,False)
    icefan.location.z=name.location.z
    receiver.objects.link(icefan);faults.append(icefan)
# A narrow lift of wind snow at the edge of the near bank softens its scale.
# Its density follows the corrugated windpack rather than a screen layer.
bpy.ops.mesh.primitive_cube_add(size=1,location=(.5,-8.35,.031))
plume=bpy.context.object
plume.name="Spindrift above the snow margin"
plume.dimensions=(13,3.2,.15)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
mistmat=bpy.data.materials.new("Wind-borne grains")
mistmat.use_nodes=True
tr=mistmat.node_tree;tr.nodes.remove(tr.nodes.get("Principled BSDF"))
ptex=node(tr,"ShaderNodeTexCoord")
stretched=node(tr,"ShaderNodeVectorMath");stretched.operation="MULTIPLY"
stretched.inputs[1].default_value=(2.4,9.4,2.6)
wire(tr,ptex,"Generated",stretched,0)
eddy=node(tr,"ShaderNodeTexNoise",Scale=1.4,Detail=4,Roughness=.61)
wire(tr,stretched,0,eddy,0)
band=node(tr,"ShaderNodeValToRGB")
band.color_ramp.elements[0].position=.53;band.color_ramp.elements[0].color=(0,0,0,1)
band.color_ramp.elements[1].position=.73;band.color_ramp.elements[1].color=(.036,.036,.036,1)
wire(tr,eddy,"Fac",band,0)
vol=node(tr,"ShaderNodeVolumeScatter",Color=(.73,.77,.81,1),Anisotropy=.28)
wire(tr,band,0,vol,"Density");wire(tr,vol,0,tr.nodes.get("Material Output"),"Volume")
plume.data.materials.append(mistmat)
suntarget.objects.link(plume)
