# Replace the lookdev headland stand-ins with the real photogrammetric face.
for ob in list(scene.objects):
    if ob.name.startswith("Watershed") and ob.name.rsplit(".",1)[-1].isdigit(): ob.hide_render=True
def bring(n):
    bpy.ops.import_scene.gltf(filepath=str(cache/n/(n+".gltf")))
    return next(o for o in bpy.context.selected_objects if o.type=="MESH")
cliff=bring("mountainside")
cm=cliff.data.materials[0]
mt=cm.node_tree
cliffbs=next(n for n in mt.nodes if n.type=="BSDF_PRINCIPLED")
scantex=cliffbs.inputs["Base Color"].links[0].from_node
terrainColor=node(mt,"ShaderNodeValToRGB")
terrainColor.color_ramp.elements[0].position=.019
terrainColor.color_ramp.elements[0].color=(.025,.030,.036,1)
terrainColor.color_ramp.elements[1].position=.48
terrainColor.color_ramp.elements[1].color=(.32,.36,.38,1)
wire(mt,scantex,0,terrainColor,0)
# The photogrammetry normal map captures real rock fractures; snow adheres
# to upward planes in small quantities below the main snow line.
geo=node(mt,"ShaderNodeNewGeometry")
zaxis=node(mt,"ShaderNodeSeparateXYZ")
wire(mt,geo,"Normal",zaxis,0)
cap=node(mt,"ShaderNodeMapRange")
cap.inputs["From Min"].default_value=.33
cap.inputs["From Max"].default_value=.91
cap.inputs["To Max"].default_value=.71
wire(mt,zaxis,"Z",cap,0)
powder=node(mt,"ShaderNodeMixRGB")
wire(mt,cap,0,powder,0)
wire(mt,terrainColor,0,powder,1)
powder.inputs[2].default_value=(.41,.48,.52,1)
wire(mt,powder,0,cliffbs,"Base Color")
wire(mt,powder,0,cliffbs,"Emission Color")
cliffbs.inputs["Emission Strength"].default_value=.075
# Skin each visible headland over a measured shoreline. Lower both cropped
# ends under the surface and interrupt its apparent height along strike.
arr=np.empty((len(cliff.data.vertices),3),np.float32)
cliff.data.vertices.foreach_get('co',arr.ravel())
x,y,z=arr.T
f=np.clip(1-(abs(x)/5.1)**4,0,1)
z[:]=(z+.8)*f-.8
cliff.data.vertices.foreach_set('co',arr.ravel())
cliff.data.update()
crags=[]
for j,(px,py,yaw,sx,sz) in enumerate([(-22,55,.26,2,.39),(-10,59,-.46,1.72,.57),(3,53,.55,1.79,.31),(17,57,-.35,1.84,.52),(30,61,.37,1.9,.32)]):
    c=cliff if j==0 else cliff.copy()
    if j: scene.collection.objects.link(c)
    c.location=(px,py,-.78)
    c.scale=(sx,1+.18*j,sz)
    c.rotation_euler.z=yaw
    suntarget.objects.link(c)
    crags.append(c)
# Replace the shape of the fragments with a real angular stone scan,
# flattened as sheared ice and re-materialled as translucent ice.
rock=bring("rock_09")
rock.hide_render=True
rock.data.materials.clear()
rock.data.materials.append(ice)
r=random.Random(7363)
for j,ob in enumerate(chips):
    dims=tuple(ob.dimensions)
    ob.data=rock.data
    ob.modifiers.clear()
    ob.scale=(dims[0]/.074,dims[1]/.145,dims[2]/.033)
    ob.rotation_euler.z+=r.uniform(-1.1,1.1)
    ob.location.z=.003
    if j%7==2:
        ob.scale.z*=1.65
        ob.rotation_euler.y-=.4
# The water absorbs the sides of the block. A shallow cut into the surface
# makes the glass rim meet the lake, and reveals the cloudy wake in the lee.
for j,base in enumerate([(-3.82,-.17),(-2.16,-.35),(.27,-.10),(3.78,-.14)]):
    cx,cy=base
    for k in range([12,14,8,18][j]):
        src=rock.copy()
        scene.collection.objects.link(src)
        src.hide_render=False
        src.scale=(r.uniform(.42,1.1),r.uniform(.25,.76),r.uniform(.42,1.2))
        src.location=(cx+r.gauss(0,.17),cy+r.gauss(-.10,.08),.0008)
        src.rotation_euler=(r.uniform(-.25,.31),r.uniform(-.57,.43),r.uniform(-3,3))
        receiver.objects.link(src)
        suntarget.objects.link(src)
# Deepen the pale blue material only in long paths through the thick ice.
# A higher, broader bounce lets the actual right edge catch the lighter sky.
absorb.inputs["Color"].default_value=(.36,.74,.763,1)
absorb.inputs["Density"].default_value=1.42
scat.inputs["Color"].default_value=(.78,.94,.955,1)
front.data.energy=900
rear.data.energy=860
cam.location=(.43,-17,1.40)
cam.rotation_euler=(Vector((0,0,.61))-cam.location).to_track_quat("-Z","Y").to_euler()
combine.inputs[0].default_value=.035
ray=Vector((.171,1,.088)).normalized()
distance.inputs[1].default_value=ray
sun.rotation_euler=(-ray).to_track_quat("-Z","Y").to_euler()
suntarget.objects.link(fogbox)
fade.inputs["To Min"].default_value=.0055
mist.inputs["Anisotropy"].default_value=.16
skybg.inputs["Strength"].default_value=.54
nextbank.rotation_euler.z=-.12
nextbank.location=(.23,.42,0)
reflector.data.energy=900
