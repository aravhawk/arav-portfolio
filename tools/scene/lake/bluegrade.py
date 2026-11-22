"""Finish the real blue-hour bake with a cool toe and restrained chroma."""

import numpy as np
from PIL import Image


def grade_plate(path):
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255
    luminance = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    saturation = 1 - rgb.min(axis=2) / np.maximum(0.001, rgb.max(axis=2))
    gain = 1.24 - 0.26 * np.minimum(1, saturation / 0.40) ** 2
    shadows = np.maximum(0, 1 - luminance / 0.5) ** 2
    rgb = luminance[:, :, None] + (rgb - luminance[:, :, None]) * gain[:, :, None]
    rgb += shadows[:, :, None] * np.array([0.004, 0.015, 0.042], np.float32)
    # Ease the most saturated shadows into the same cold palette on the tall gate.
    high = np.maximum(0.001, rgb.max(axis=2))
    chroma = 1 - rgb.min(axis=2) / high
    limit = 0.34 + 0.05 * np.tanh(np.maximum(0, chroma - 0.34) / 0.05)
    attenuation = np.minimum(1, limit / np.maximum(0.001, chroma))
    rgb = high[:, :, None] - (high[:, :, None] - rgb) * attenuation[:, :, None]
    Image.fromarray(np.uint8(np.rint(255 * rgb.clip(0, 1)))).save(path)
