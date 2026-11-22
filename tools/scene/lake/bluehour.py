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

# Light the eastern sky from below. The angular profile spreads across the
# horizon after the small direct source has set; only the clear upper air
# shows stars. Bake both into the world before integrating the ice.
direction_z=node(lt,"ShaderNodeSeparateXYZ")
wire(lt,skyvec,"Generated",direction_z,0)
twilight=node(lt,"ShaderNodeValToRGB")
twilight.color_ramp.elements[0].color=(.58,.67,.90,1)
twilight.color_ramp.elements[1].position=.37
twilight.color_ramp.elements[1].color=(.032,.063,.14,1)
wire(lt,direction_z,"Z",twilight,0)
stars=node(lt,"ShaderNodeTexVoronoi",Scale=143)
wire(lt,skyvec,"Generated",stars,0)
points=node(lt,"ShaderNodeMapRange")
points.inputs["From Max"].default_value=.065
points.inputs["To Min"].default_value=2.8
points.inputs["To Max"].default_value=0
wire(lt,stars,"Distance",points,0)
sky=node(lt,"ShaderNodeMixRGB",Fac=1)
sky.blend_type="ADD"
wire(lt,twilight,0,sky,1)
wire(lt,points,0,sky,2)
wire(lt,sky,0,skybg,"Color")
skybg.inputs["Strength"].default_value=.88
glaze.inputs[0].default_value=.045

# The dawn glow covers only the eastern basin and also reaches the slabs
# through the world illumination. Keep the opposite sky and zenith cooler.
arc=node(lt,"ShaderNodeMapRange")
arc.interpolation_type="SMOOTHERSTEP"
arc.inputs["From Max"].default_value=.55
arc.inputs["To Min"].default_value=.65
arc.inputs["To Max"].default_value=0
wire(lt,distance,"Value",arc,0)
horizon=node(lt,"ShaderNodeMixRGB")
horizon.blend_type="ADD"
wire(lt,arc,0,horizon,0)
wire(lt,twilight,0,horizon,1)
horizon.inputs[2].default_value=(.44,.37,.34,1)
wire(lt,horizon,0,sky,1)
wire(lt,horizon,0,bg,"Color")
bg.inputs["Strength"].default_value=.22
# Under scotopic illumination the cool sky reads mostly as value.
rendergrade.inputs["Saturation"].default_value=.52
