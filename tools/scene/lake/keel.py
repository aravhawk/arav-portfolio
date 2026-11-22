# A narrow hollow pressure crack bends up the open lead. Its two sides
# refract different parts of the lake, and only discontinuous strips on the
# deeper face contain white air. Each boundary is shared between sections.
cleft,cb=surface("Clear shoulder of the open seam",(.68,.85,.86),.13,**{"IOR":1.31,"Transmission Weight":.94})
wc=cleft.node_tree
sliver=node(wc,"ShaderNodeVolumeAbsorption",Color=(.30,.72,.76,1),Density=1.4)
wire(wc,sliver,0,wc.nodes.get("Material Output"),"Volume")
edgeice,eb=surface("Trapped air in shear ice",(.72,.84,.86),.28,**{"Transmission Weight":.26,"IOR":1.17})
et=edgeice.node_tree
cold=node(et,"ShaderNodeTexImage");cold.image=extract("Ice004","_Color.jpg")
uv=node(et,"ShaderNodeUVMap");wire(et,uv,0,cold,0)
grain=node(et,"ShaderNodeValToRGB")
grain.color_ramp.elements[0].position=.028;grain.color_ramp.elements[0].color=(.05,.095,.11,1)
grain.color_ramp.elements[1].position=.44;grain.color_ramp.elements[1].color=(.89,.95,.94,1)
wire(et,cold,0,grain,0);wire(et,grain,0,eb,"Base Color");wire(et,grain,0,eb,"Emission Color")
eb.inputs["Emission Strength"].default_value=.23
bump=node(et,"ShaderNodeBump",Distance=.0012,Strength=.39)
wire(et,cold,0,bump,"Height");wire(et,bump,0,eb,"Normal")
def breakwall(label,x0,y0,dx,dy,width,split):
    verts=[];faces=[];fmaterial=[];uvs=[]
    count=650
    for j in range(count+1):
        t=j/count
        along=math.sqrt(dx*dx+dy*dy)*t
        jog=.048*math.sin(3.6*along)+.036*math.sin(1.2*along)
        x=x0+dx*t+.78*math.sin(t*math.pi*1.5)+jog
        # Brittle ice propagates in planar runs with short offsets at
        # inclusions. A regular sinusoid would look like a rolled ribbon.
        x=x0+dx*t+np.interp(t,[0,.14,.23,.38,.51,.68,.73,.91,1],[0,.035,-.031,.108,.049,.141,.13,.16,.14])+.004*math.sin(along*13.4)

        y=y0+dy*t+.022*math.sin(t*12)
        # The wide face departs steeply from the skin; the opposite face
        # folds back more shallowly. They meet under the lake surface.
        depth=width*math.sin(math.pi*t)**.57*(.78+.15*math.sin(t*14)+.05*math.sin(t*49))
        angle=.25+.19*math.sin(t*11+split)
        s=np.array([dy,-dx])/math.sqrt(dx*dx+dy*dy)
        cross=[(-.014*depth,-.002),(.068*depth,-.004),(.35*depth,-.005-depth*.36),(angle*depth,-.003-depth),(-.26*depth,-.004-depth*.75),(-.52*depth,-.003-depth*.31)]
        for k,(w,z) in enumerate(cross):
            w+=.017*depth*math.sin(t*80+1.6*k)
            verts.append((x+s[0]*w,y+s[1]*w,z-.022));uvs.append((along*.60+split,k*.19+.046*math.sin(t*34)))
        if j:
            for k in range(6):
                a=(j-1)*6+k;b=(j-1)*6+(k+1)%6
                faces.append((a,b,b+6,a+6))
                fmaterial.append(int((k in (1,4) and math.sin(t*19+k)+math.sin(t*47)*.53>-.4) or (k==0 and t<.61)))
    seam=geometry(label,verts,faces,cleft,False)
    seam.data.materials.append(edgeice)
    seam.data.polygons.foreach_set("material_index",np.array(fmaterial,np.int32))
    ids=np.empty(len(seam.data.loops),np.int32);seam.data.loops.foreach_get('vertex_index',ids)
    lay=seam.data.uv_layers.new(name="Fracture face");lay.data.foreach_set('uv',np.asarray(uvs,np.float32)[ids].ravel())
    suntarget.objects.link(seam)
breakwall("Main shear and keel",-3.63,-12.6,3.77,11.6,.215,0)
breakwall("Shallow splay",-2.75,-8.2,4.49,7.2,.11,1)
# Intermittent sun is still transmitted through an optically dense slab.
# The broad side retains a soft sky fill, and the hairline on the sawn face
# comes from the measured environment rather than a white surface coating.
front.data.energy=755
rear.data.energy=990
bs.inputs["Emission Strength"].default_value=.035
bs.inputs["Transmission Weight"].default_value=.9
grade.inputs["To Min"].default_value=2.32
scat.inputs["Color"].default_value=(.78,.93,.94,1)
# Rake the pressure seam across the left inlet, keeping drifts under the
# line of the page's text on the right.
nextbank.rotation_euler.z=-.13
nextbank.location=(.24,-.13,0)
