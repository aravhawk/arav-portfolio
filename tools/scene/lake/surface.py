# The lake scan anchors the reflection and the subsurface cracks in the
# same fine surface structure. Preserve only the luminance of the source.
def scan_color(tree,socket_owner,socket,src,scale,low,high):
    with zipfile.ZipFile(cache/(src+"_2K-JPG.zip")) as arc:
        file=next(f for f in arc.namelist() if f.endswith("_Color.jpg"))
        path=cache/file
        if not path.exists(): path.write_bytes(arc.read(file))
    tex=node(tree,"ShaderNodeTexImage")
    tex.image=bpy.data.images.load(str(path),check_existing=True)
    coords=node(tree,"ShaderNodeVectorMath")
    coords.operation="SCALE"
    coords.inputs["Scale"].default_value=scale
    wire(tree,node(tree,"ShaderNodeTexCoord"),"Object",coords,0)
    wire(tree,coords,0,tex,0)
    tones=node(tree,"ShaderNodeValToRGB")
    tones.color_ramp.elements[0].position=.018
    tones.color_ramp.elements[0].color=(*low,1)
    tones.color_ramp.elements[1].position=.55
    tones.color_ramp.elements[1].color=(*high,1)
    wire(tree,tex,0,tones,0)
    wire(tree,tones,0,socket_owner,socket)
    return tex,tones
bedtree=bed.node_tree
lake_scan,watercolors=scan_color(bedtree,bsbed,"Base Color","Ice003",.24,(.009,.014,.019),(.095,.11,.13))
# Add a small bounded sky return below the transparent ice. It's modulated by
# the scanned surface, rather than bright direct glints off an opaque plane.
wire(bedtree,watercolors,0,bsbed,"Emission Color")
bsbed.inputs["Emission Strength"].default_value=.32
suntarget=bpy.data.collections.new("Visible sunlit surfaces")
for obj in [name,*chips,*faults,mantle,*[t[0] for t in ranges]]:
    suntarget.objects.link(obj)
sun.light_linking.receiver_collection=suntarget
# Only the far water converges to the same air colour as the foot of the range.
lt=lid.node_tree
distance_along=node(lt,"ShaderNodeSeparateXYZ")
wire(lt,node(lt,"ShaderNodeNewGeometry"),"Position",distance_along,0)
falloff=node(lt,"ShaderNodeMapRange")
falloff.interpolation_type="SMOOTHERSTEP"
falloff.inputs["From Min"].default_value=7
falloff.inputs["From Max"].default_value=61
falloff.inputs["To Max"].default_value=.95
wire(lt,distance_along,"Y",falloff,0)
horizon=(.052,.069,.085,1)
haze_color=node(lt,"ShaderNodeEmission",Color=horizon)
near_mix=node(lt,"ShaderNodeMixShader")
wire(lt,falloff,0,near_mix,0)
wire(lt,coat,0,near_mix,1)
wire(lt,haze_color,0,near_mix,2)
wire(lt,near_mix,0,lt.nodes.get("Material Output"),0)
ranges[0][2].inputs["Color"].default_value=horizon
ranges[0][1].inputs["To Min"].default_value=.97
ranges[0][1].inputs["From Max"].default_value=3.4
# Light scattered on the exposed upper snowfields. Read the relief from
# the same registered colour map used on the physical slope.
mountain=ranges[0][0]
mt=mountain.data.materials[0].node_tree
hill=mt.nodes.get("Principled BSDF")
ridge_tint=ranges[0][3]
ridge_tint.color_ramp.elements[0].position=.085
ridge_tint.color_ramp.elements[1].position=.55
ridge_tint.color_ramp.elements[0].color=(.035,.044,.054,1)
ridge_tint.color_ramp.elements[1].color=(.81,.84,.86,1)
wire(mt,ridge_tint,0,hill,"Emission Color")
hpos=node(mt,"ShaderNodeSeparateXYZ")
wire(mt,node(mt,"ShaderNodeNewGeometry"),"Position",hpos,0)
heightlight=node(mt,"ShaderNodeMapRange")
heightlight.interpolation_type="SMOOTHERSTEP"
heightlight.inputs["From Min"].default_value=2.6
heightlight.inputs["From Max"].default_value=6.4
heightlight.inputs["To Min"].default_value=.012
heightlight.inputs["To Max"].default_value=.51
wire(mt,hpos,"Z",heightlight,0)
wire(mt,heightlight,0,hill,"Emission Strength")
# Locate the dark-bottom / bright-rim transition on each range differently.
ranges[0][0].scale.z=.53
ranges[1][0].scale.z=.69
ranges[2][0].scale.z=.62
ranges[1][0].location.x=2.5
# Cool upper sky above a pearl horizon. Keep the photographed cloud field
# and put the sun just clear of the rear ridge.
wt=scene.world.node_tree
el=node(wt,"ShaderNodeSeparateXYZ")
wire(wt,skyvec,"Generated",el,0)
gradient=node(wt,"ShaderNodeValToRGB")
gradient.color_ramp.elements[0].position=.01
gradient.color_ramp.elements[0].color=(.86,.90,.95,1)
gradient.color_ramp.elements[1].position=.135
gradient.color_ramp.elements[1].color=(.32,.52,.77,1)
wire(wt,el,"Z",gradient,0)
cool=node(wt,"ShaderNodeMixRGB",Fac=.78)
cool.blend_type="MULTIPLY"
wire(wt,above,0,cool,1)
wire(wt,gradient,0,cool,2)
wire(wt,cool,0,sunlit,1)
distance.inputs[1].default_value=Vector((.135,1,.056)).normalized()
# Keep side plates clear; high-albedo lamellae are sparse and contained.
front.data.energy=1900
rear.data.energy=1100
