# Choose the real cloud panorama first, then align the physical source and
# the solar halo in the same coordinate system. Keep amber around the disc.
wt=scene.world.node_tree
above.image=bpy.data.images.load(str(cache/"wasteland_clouds_puresky_2k.hdr"),check_existing=True)
ray=Vector((.168,1,.084)).normalized()
sun.rotation_euler=(-ray).to_track_quat("-Z","Y").to_euler()
distance.inputs[1].default_value=ray
lon=(.5-1228/2048)*math.tau
lat=(.5-468/1024)*math.pi
source=Vector((math.cos(lon)*math.cos(lat),math.sin(lon)*math.cos(lat),math.sin(lat)))
direction.inputs["Rotation"].default_value=ray.rotation_difference(source).to_euler()
washed=node(wt,"ShaderNodeHueSaturation")
washed.inputs["Saturation"].default_value=.28
wire(wt,above,0,washed,"Color")
wire(wt,washed,0,cool,1)
skybg.inputs["Strength"].default_value=.82
sunlit.inputs[0].default_value=.53
sun_ramp.color_ramp.elements[0].color=(3.4,3.05,2.71,1)
# Put back a real image of the name and the shore in the ice. The film
# transmits the black lead as well as returning this soft grazing reflection.
lt=lid.node_tree
mirror=node(lt,"ShaderNodeBsdfGlossy",Color=(.55,.60,.62,1),Roughness=.15)
orig=skin.inputs["Normal"].links[0].from_node
wire(lt,orig,"Normal",mirror,"Normal")
combine=node(lt,"ShaderNodeMixShader",Fac=.16)
wire(lt,coat,0,combine,1)
wire(lt,mirror,0,combine,2)
wire(lt,combine,0,near_mix,1)
# Reduce the environment energy in this shallow lobe, so a slab still has
# a reflection through its grounded contact shadow.
bg.inputs["Strength"].default_value=.19
cam.location=(.32,-17,1.35)
cam.rotation_euler=(Vector((0,0,.61))-cam.location).to_track_quat("-Z","Y").to_euler()
ranges[0][0].scale.z=.62
ranges[0][0].location.x=-25
ranges[1][0].scale.z=.69
ranges[1][0].location.x=24
ranges[2][0].scale.z=.61
nextbank.rotation_euler.z=-.08
nextbank.location=(.5,-.33,0)
nextbank.scale.z=.92
# Fold the edges of the shore into broad spurs projecting into the water,
# using smaller instances of an eroded heightfield. Footlines occur at
# different depths. This also interrupts the straight distant reflection.
for j,(px,py,sc,yaw) in enumerate([(-25,44,.54,-.48),(28,51,.69,1.08),(-7,68,.44,-.21)]):
    obj=ranges[(j+1)%3][0].copy()
    scene.collection.objects.link(obj)
    obj.location=(px,py,-.56)
    obj.scale=(sc,sc*.51,.25 if j==1 else .17)
    obj.rotation_euler.z=yaw
    suntarget.objects.link(obj)
# Genuine low-lying white mist in several ribbons follows the far coast.
# Their independent surface heights keep the lake edge from being uniform.
fade.inputs["To Min"].default_value=.031
fade.inputs["From Max"].default_value=2.8
mist.inputs["Anisotropy"].default_value=.24
# Submerged fracture surfaces are now continuous tri-ribbons with stable
# shared corners, curved lower lips and dislocations at secondary branches.
network.hide_render=True
ft=fract.node_tree
fractbs.inputs["Emission Strength"].default_value=.14
fracnoise=node(ft,"ShaderNodeTexNoise",Scale=32,Detail=4.5,Roughness=.69)
orientation=node(ft,"ShaderNodeMapping")
orientation.inputs["Scale"].default_value=(2.35,1.30,5.1)
wire(ft,node(ft,"ShaderNodeTexCoord"),"Object",orientation,0)
wire(ft,orientation,0,fracnoise,0)
weather=node(ft,"ShaderNodeValToRGB")
weather.color_ramp.elements[0].position=.32
weather.color_ramp.elements[0].color=(.035,.074,.087,1)
weather.color_ramp.elements[1].position=.72
weather.color_ramp.elements[1].color=(.86,.94,.95,1)
wire(ft,fracnoise,0,weather,0)
wire(ft,weather,0,fractbs,"Base Color")
wire(ft,weather,0,fractbs,"Emission Color")
frosted=node(ft,"ShaderNodeBump",Distance=.0011,Strength=.31)
wire(ft,fracnoise,0,frosted,"Height")
wire(ft,frosted,"Normal",fractbs,"Normal")
verts,faces=[],[]
rng=random.Random(7196)
def fissure(x,y,theta,length,deep,spawn):
    n=max(5,round(length/.032))
    initial=theta
    freq=rng.uniform(.2,.56)
    dip=rng.uniform(-.9,.9)
    phase=rng.uniform(-2.2,2.2)
    offset=len(verts)
    deferred=[]
    for k in range(n+1):
        t=k/n
        theta=initial+.16*math.sin(k*.032*freq+phase)+.05*math.sin(k*.032*1.26+phase)
        dx,dy=math.cos(theta),math.sin(theta)
        thickness=deep*(math.sin(math.pi*t)**.52)*(.78+.21*math.sin(k*.019+phase))
        sy,sx=dx,-dy
        offset_mid=dip*thickness*.50+.002*math.sin(k*.19)
        offset_base=dip*thickness+.002*math.sin(k*.12)
        verts.extend([(x,y,-.0045),(x+sx*offset_mid,y+sy*offset_mid,-.005-thickness*.52),(x+sx*offset_base,y+sy*offset_base,-.006-thickness)])
        idx=offset+k*3
        if k:
            faces.extend([(idx-3,idx,idx+1,idx-2),(idx-2,idx+1,idx+2,idx-1)])
        if spawn and rng.random()<.0048:
            deferred.append((x,y,theta+rng.choice([-1,1])*rng.uniform(.22,.87),rng.uniform(.6,3.7),deep*rng.uniform(.10,.40),False))
        x+=dx*.032; y+=dy*.032
    for p in deferred: fissure(*p)
for p in [(-5.9,-12,.96,16,.123,True),(4.2,-14,1.86,15,.085,True),(-9,-7,.34,17,.079,True),(-7,1,-.42,15,.045,True)]:
    fissure(*p)
for j in range(104):
    fissure(rng.uniform(-12,11),rng.uniform(-15,6),rng.uniform(-3.14,3.14),rng.uniform(1.4,12),rng.uniform(.005,.030),True)
fractures=geometry("Submerged fracture fronts",verts,faces,fract,True)
suntarget.objects.link(fractures)
quiet.inputs["To Min"].default_value=.93
quiet.inputs["To Max"].default_value=.028
# Match the ice in the broken plates to the more crystalline cores of a
# pressure ridge. Larger groups lean against each other with a shared foot.
for j,chip in enumerate(chips):
    chip.location.z-=.012
    if j%8 not in [1,3]: chip.scale*=.65
    elif j%8==3: chip.rotation_euler.y-=.38
    chip.location.y+=.20
rear.data.energy=720
front.data.energy=980
