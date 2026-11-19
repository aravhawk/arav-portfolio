# Pull two headlands out of the same mountain range. Limit light to snow
# above the ice scour line; let the exposed base be slate rock.
for j,(ridge,airmix,fogshade,rock) in enumerate(ranges):
    mt=ridge.data.materials[0].node_tree
    diff=mt.nodes.get("Principled BSDF")
    albedo=diff.inputs["Base Color"].links[0].from_node
    geo=node(mt,"ShaderNodeNewGeometry")
    spl=node(mt,"ShaderNodeSeparateXYZ")
    wire(mt,geo,"Position",spl,0)
    rag=node(mt,"ShaderNodeTexNoise",Scale=.57,Detail=4.0)
    wire(mt,geo,"Position",rag,0)
    heightvar=node(mt,"ShaderNodeMath")
    heightvar.operation="MULTIPLY_ADD"
    wire(mt,rag,0,heightvar,0)
    heightvar.inputs[1].default_value=1.9
    wire(mt,spl,"Z",heightvar,2)
    boundary=node(mt,"ShaderNodeMapRange")
    boundary.interpolation_type="SMOOTHERSTEP"
    boundary.inputs["From Min"].default_value=1.65
    boundary.inputs["From Max"].default_value=4.8
    wire(mt,heightvar,0,boundary,0)
    mixing=node(mt,"ShaderNodeMixRGB")
    wire(mt,boundary,0,mixing,0)
    mixing.inputs[1].default_value=(.021,.029,.038,1)
    wire(mt,albedo,0,mixing,2)
    wire(mt,mixing,0,diff,"Base Color")
    wire(mt,mixing,0,diff,"Emission Color")
    if j==0: 
        airmix.inputs["To Min"].default_value=.40
        fogshade.inputs[0].default_value=(.035,.044,.053,1)
ranges[0][0].rotation_euler.z=-.39
ranges[0][0].location.x=-25
ranges[1][0].location.x=23
# Suppress only the direct glare of the disc on the open lead. A submerged
# matte bed keeps directional diffuse shadows from the slabs.
suntarget.objects.unlink(cover)
sun.data.specular_factor=0
sun.data.transmission_factor=0
bsbed.inputs["Specular IOR Level"].default_value=0
skin.inputs["Roughness"].default_value=.29
falloff.inputs["From Min"].default_value=30
falloff.inputs["From Max"].default_value=145
falloff.inputs["To Max"].default_value=.42
haze_color.inputs[0].default_value=(.048,.057,.066,1)
skin.inputs["IOR"].default_value=1.21
polar.inputs[0].default_value=.985
# The bed sits 40 cm below the lake top. Scattering ice transmits a small
# ambient flux into the dark water directly under the subject.
watercolors.color_ramp.elements[0].color=(.004,.006,.008,1)
watercolors.color_ramp.elements[1].color=(.10,.13,.15,1)
bsbed.inputs["Emission Strength"].default_value=.23
# The wind aligns the fine ridges and stoss slopes, leaving larger draped
# snowfields between sets of ripples, broken where their margins meet ice.
bank.hide_render=True
du=measured_snow("Snow008A",u*.065,v*.33+.064*np.sin(u*.66))
grain=measured_snow("snow_02_disp_2k.jpg",X*.8,Y*.83)
lee=measured_snow("Snow009A",u*.09,v*.34)
depth=np.clip((-9.25-Y+.74*X+1.08*np.sin(X*.5)+.9*(lee-.5))*.085,-.18,.08)
relief_snow=.18*(du-.50)+.026*(grain-.53)+.04*(lee-.52)
nextbank=field("Sastrugi",xs,ys,depth+relief_snow,snow)
onlysnow.objects.link(nextbank)
suntarget.objects.link(nextbank)
reflector.data.energy=1610
# Restore frost variation and contrast in the right-hand letters.
bs.inputs["Emission Color"].default_value=(.58,.83,.82,1)
bs.inputs["Emission Strength"].default_value=.122
bs.inputs["Subsurface Weight"].default_value=.11
density_gain.inputs[1].default_value=4.1
front.location=(-.4,-3.9,2.9)
rear.location=(3.7,3.8,1.6)
front.data.energy=1030
rear.data.energy=745
# Real pressure fragments. Reposition each piece in front of the baseline,
# where its upper face settles below the foot and can cast a small shadow.
r=random.Random(80191)
for j,ob in enumerate(chips):
    ob.scale*=r.uniform(1,2.4)
    ob.rotation_euler.y+=r.uniform(-.35,.23)
    ob.location.y=r.uniform(-.85,-.24)
    ob.location.z+=.012
    if j%4==0:
        ob.scale.x*=1.5
    if j%6==0:
        ob.location.x+=r.uniform(-.19,.19)
# Avoid any chip touching a stroke silhouette, including through a counter.
# Test from the actual final camera, with the chip's local transformed bounds.
bpy.context.view_layer.update()
for ob in chips:
    M=ob.matrix_world.copy()
    localbounds=[M@Vector(c) for c in ob.bound_box]
    X0=min(p.x for p in localbounds);X1=max(p.x for p in localbounds)
    Y0=min(p.y for p in localbounds);Y1=max(p.y for p in localbounds)
    Z0=min(p.z for p in localbounds);Z1=max(p.z for p in localbounds)
    stride=.022
    moved=False
    for k in range(147):
        shift=((k+1)//2)*stride*(-1 if k%2 else 1)
        if all(not hits_letters(x+shift,y,z) for x in np.linspace(X0-.035,X1+.035,5) for y in [Y0,Y1] for z in np.linspace(Z0-.03,Z1+.03,5)):
            ob.location.x+=shift
            moved=True;break
    if not moved: ob.location.y-=1.5
