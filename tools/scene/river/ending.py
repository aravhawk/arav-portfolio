import numpy as np


def shore(xs, y, axis, half):
    return 4.5 - y - .32 * xs + .36 * np.sin(xs * .58)


def horizon(grid, water):
    grid("Sea beyond the shelf", [[(-900, 55, 0), (900, 55, 0)],
                                  [(-900, 1100, 0), (900, 1100, 0)]], water)


def subject(sawn):
    cut = [(-.87,-.18),(.87,-.18),(.84,3.48),(.63,3.56),(-.85,3.49)]
    sawn("Last standing slab", cut, .69, (2,1,0), (0,-.04,.24), "near", 1201)
    sawn("Unraised slab", cut, .69, (4,-.8,.44), (1.54,0,-.72), "near", 1202)


def fade_sea(objects):
    # Sea, shelf and snow beneath them share the same extinction distance.
    # At the far edge the camera sees the actual sky through all three layers.
    materials = {}
    for name in ("Scalloped snow shelf", "Open lead", "Sea beyond the shelf", "Distant continuous snowpack"):
        obj = objects[name]
        source = obj.data.materials[0]
        if source not in materials:
            faded = source.copy()
            tree = faded.node_tree
            output = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output)
            surface = output.inputs["Surface"].links[0].from_socket
            position = tree.nodes.new("ShaderNodeNewGeometry")
            axes = tree.nodes.new("ShaderNodeSeparateXYZ")
            tree.links.new(position.outputs["Position"], axes.inputs[0])
            distance = tree.nodes.new("ShaderNodeMapRange")
            distance.interpolation_type = "SMOOTHERSTEP"
            distance.inputs["From Min"].default_value = 16
            distance.inputs["From Max"].default_value = 54
            tree.links.new(axes.outputs["Y"], distance.inputs["Value"])
            mix = tree.nodes.new("ShaderNodeMixShader")
            tree.links.new(distance.outputs[0], mix.inputs[0])
            tree.links.new(surface, mix.inputs[1])
            tree.links.new(tree.nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix.inputs[2])
            tree.links.new(mix.outputs[0], output.inputs["Surface"])
            materials[source] = faded
        obj.data.materials[0] = materials[source]
