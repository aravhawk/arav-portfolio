"""Author the river's blue-hour sky in angular coordinates for the Cycles bake."""

import math
import random

import bpy
import numpy as np


def blue_hour(world, reach, horizon):
    # +Y is downriver. The same air column is seen from both cameras.
    wind = random.Random(reach or "ridge")
    width, height = 2048, 1024
    longitude = 2 * math.pi * (0.5 - (np.arange(width) + 0.5) / width)
    offset = wind.uniform(-0.12, 0.12) if reach else 0
    bearing = longitude - (math.pi / 2 + offset)
    altitude = math.pi * ((np.arange(height)[:, None] + 0.5) / height - 0.5)
    altitude = altitude - horizon
    phase = wind.uniform(0, 2 * math.pi)
    # Two banks of suspended ice scatter light from just below the horizon.
    # A wrapped angular distance keeps the panorama continuous at its seam.
    chord = 2 * np.sin(bearing / 2)
    drift = 0.012 * np.sin(8 * bearing + phase) + 0.006 * np.sin(19 * bearing - phase)
    broad = np.exp(-0.5 * (chord / 0.26) ** 2 - 0.5 * ((altitude + 0.024 - drift) / 0.055) ** 2)
    low = np.exp(-0.5 * ((chord - 0.07) / 0.16) ** 2 - 0.5 * ((altitude - drift) / 0.028) ** 2)
    veil = 0.5 + 0.5 * np.sin(41 * altitude + 6 * np.sin(bearing * 3 + phase) + phase)
    radiance = 0.35 * broad + low * (0.16 + 0.12 * veil)
    if not reach:
        # At the breach the eastern sky is seen through the missing slab.
        # Concentrate its scattering in that opening and retain the lit rim.
        gap = (altitude - 0.013 - 0.6 * drift) / 0.033
        radiance += 3.8 * np.exp(-0.5 * (chord / 0.090) ** 2 - 0.5 * gap**2)
    air = np.exp(-np.sqrt((altitude - 0.3 * drift) ** 2 + 0.02**2) / 0.25)
    pixels = np.ones((height, width, 4), dtype=np.float32)
    zenith_color = (0.024, 0.043, 0.078)
    shore_color = (0.061, 0.098, 0.15)
    scattered_color = (0.78, 0.85, 0.91)
    for i, (high, low, scattered) in enumerate(zip(zenith_color, shore_color, scattered_color)):
        pixels[:, :, i] = high + (low - high) * air + scattered * radiance

    image = bpy.data.images.new("Downriver twilight", width, height, float_buffer=True)
    image.colorspace_settings.name = "Linear Rec.709"
    image.pixels.foreach_set(pixels.ravel())
    tree = world.node_tree
    panorama = tree.nodes.new("ShaderNodeTexEnvironment")
    panorama.image = image
    sky = tree.nodes.new("ShaderNodeBackground")
    tree.links.new(panorama.outputs["Color"], sky.inputs["Color"])
    output = next(n for n in tree.nodes if n.type == "OUTPUT_WORLD" and n.is_active_output)
    previous = output.inputs["Surface"].links[0].from_socket
    # Keep the existing upper blue-hour sky and its fine stars.
    coordinates = tree.nodes.new("ShaderNodeTexCoord")
    axes = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(coordinates.outputs["Generated"], axes.inputs[0])
    lower_sky = tree.nodes.new("ShaderNodeMapRange")
    lower_sky.interpolation_type = "SMOOTHERSTEP"
    lower_sky.inputs["From Min"].default_value = math.sin(horizon + 0.055)
    lower_sky.inputs["From Max"].default_value = math.sin(horizon + 0.20)
    lower_sky.inputs["To Min"].default_value = 1
    lower_sky.inputs["To Max"].default_value = 0
    tree.links.new(axes.outputs["Z"], lower_sky.inputs["Value"])
    rays = tree.nodes.new("ShaderNodeLightPath")
    weight = tree.nodes.new("ShaderNodeMath")
    weight.operation = "MULTIPLY"
    tree.links.new(lower_sky.outputs[0], weight.inputs[0])
    tree.links.new(rays.outputs["Is Camera Ray"], weight.inputs[1])
    mix = tree.nodes.new("ShaderNodeMixShader")
    tree.links.new(weight.outputs[0], mix.inputs[0])
    tree.links.new(previous, mix.inputs[1])
    tree.links.new(sky.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], output.inputs["Surface"])
