"""Second lighting bake on the frozen meshes, with the sun below the ridge."""
lt=scene.world.node_tree
for light,c in [(skybg,(.46,.59,.86,1)),(bg,(.42,.55,.85,1))]:
    previous=light.inputs['Color'].links[0].from_node
    tint=node(lt,"ShaderNodeMixRGB",Fac=1)
    tint.blend_type="MULTIPLY";tint.inputs[2].default_value=c
    wire(lt,previous,0,tint,1);wire(lt,tint,0,light,"Color")
skybg.inputs['Strength'].default_value*=.92
solar.inputs["Scale"].default_value=.001
sun.data.energy=.22
sun.data.color=(.53,.68,1.0)
for light,intensity,c in [(front,.31,(.62,.73,1.0)),(rear,.69,(.55,.74,1.0)),
                          (bounds_light,.38,(.66,.77,1.0)),(reflector,.28,(.57,.67,1.0))]:
    light.data.energy*=intensity
    light.data.color=c
scene.view_settings.exposure=-1.28
scene.view_settings.look="AgX - Medium Low Contrast"
