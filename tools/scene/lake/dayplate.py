# Keep a milky centre with a transparent shoulder. Half the minimum density:
# the broad slab can then reveal its own cleavage before it relays the shore.
density_gain.inputs[1].default_value=6.2
density_gain.inputs[2].default_value=1.95
front.data.energy=1340
rear.data.energy=960
bs.inputs["Emission Strength"].default_value=.064
scat.inputs["Color"].default_value=(.85,.955,.955,1)
rough_map.inputs["To Min"].default_value=.17
rough_map.inputs["To Max"].default_value=.30
# Air appears across only a fraction of a fracture face. Let the ice bed
# show through the optically polished sections of this buried shear.
for material,albedo,limit in [(cleft,.18,.48),(edgeice,.20,.65)]:
    mt=material.node_tree
    output=mt.nodes.get("Material Output")
    original=output.inputs[0].links[0].from_node
    part=node(mt,"ShaderNodeTexImage");part.image=extract("Ice004","_Color.jpg")
    wire(mt,node(mt,"ShaderNodeUVMap"),0,part,0)
    fmix=node(mt,"ShaderNodeMapRange")
    fmix.inputs["From Min"].default_value=.028
    fmix.inputs["From Max"].default_value=.46
    fmix.inputs["To Min"].default_value=albedo
    fmix.inputs["To Max"].default_value=limit
    wire(mt,part,0,fmix,0)
    s=node(mt,"ShaderNodeMixShader")
    wire(mt,fmix,0,s,0);wire(mt,node(mt,"ShaderNodeBsdfTransparent"),0,s,1);wire(mt,original,0,s,2)
    wire(mt,s,0,output,0)
cb.inputs["IOR"].default_value=1.105
cb.inputs["Roughness"].default_value=.21
eb.inputs["Emission Strength"].default_value=.145
bpy.data.objects['Shallow splay'].scale.z=.58
# Deepen the dark reflected shore behind the tops of A and i without
# dimming the daylight coming from the upper part of the photographed sky.
far_ref.inputs["Color"].default_value=(.64,.69,.72,1)
grazing.inputs["From Min"].default_value=17
grazing.inputs["From Max"].default_value=59
lowfog.inputs["To Min"].default_value=.10
bounds_light=area("Snow sky incident on high cut faces",(-2.3,-.8,3.8),480,5.8,(.91,.97,1))
bounds_light.light_linking.receiver_collection=receiver
bounds_light.data.specular_factor=.08
# Keep the mirrored open water where the page's words will sit quiet.
frosted.inputs["Distance"].default_value=.0006
