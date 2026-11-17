/**
 * The flight's light, as a function of how far the day has come round.
 *
 * Time passes along the flight. In the light theme it begins as a cold
 * bright morning with the sun low on the left; at this latitude the sun does
 * not climb, it travels along the horizon, and by the sea it stands low on
 * the right in a rose and blue sky (the old ending's blue hour). In the dark
 * theme it begins in the polar night under the aurora and ends at the first
 * gold light, the aurora fading and the stars thinning.
 *
 * Every key is a smooth function of `day`, so no frame jumps. The shading
 * pass takes the result as uniforms: nothing here is worked out per pixel.
 */

import { SUN } from './shaders/terrain';

type V3 = [number, number, number];

export interface SkyKeys {
  zen: V3;
  mid: V3;
  hor: V3;
  band: V3;
  /** toward the sun (it may be under the horizon) */
  sun: V3;
  /** the colour and strength of what lights the ground, and where from */
  key: V3;
  keyDir: V3;
  amb: V3;
  haze: number;
  /** how much of the aurora is left, 0..1 */
  aurora: number;
  /** how far the sky has come to the ending's: its warmth, its sun's disc, its lit cloud, its ranges against the light */
  dusk: number;
  /** how much light the water's own body still has, against the morning's */
  under: number;
}

interface Key {
  zen: V3;
  mid: V3;
  hor: V3;
  band: V3;
  az: number;
  el: number;
  key: V3;
  /** the height the ground is lit from (before dawn it is not the sun's own) */
  keyEl: number;
  amb: V3;
  haze: number;
  aurora: number;
  dusk: number;
  under: number;
}

const mul = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mixKey = (a: Key, b: Key, t: number): Key => ({
  zen: mix3(a.zen, b.zen, t),
  mid: mix3(a.mid, b.mid, t),
  hor: mix3(a.hor, b.hor, t),
  band: mix3(a.band, b.band, t),
  az: lerp(a.az, b.az, t),
  el: lerp(a.el, b.el, t),
  key: mix3(a.key, b.key, t),
  keyEl: lerp(a.keyEl, b.keyEl, t),
  amb: mix3(a.amb, b.amb, t),
  haze: lerp(a.haze, b.haze, t),
  aurora: lerp(a.aurora, b.aurora, t),
  dusk: lerp(a.dusk, b.dusk, t),
  under: lerp(a.under, b.under, t),
});

/** Morning at a high latitude: cold clear daylight, a low sun off to the left, a pale sky that deepens overhead. */
const MORNING: Key = {
  zen: [0.06, 0.17, 0.48],
  mid: [0.19, 0.37, 0.7],
  hor: [0.5, 0.65, 0.84],
  band: [1.25, 1.02, 0.74],
  az: SUN.az,
  el: SUN.el,
  key: mul([1.0, 0.9, 0.74], 2.9),
  keyEl: SUN.el,
  amb: [0.27, 0.38, 0.56],
  haze: 1.0,
  aurora: 0,
  dusk: 0,
  under: 1,
};

/** The hour before dawn: a deep blue sky, first light low behind the ranges, the aurora overhead. */
const NIGHT: Key = {
  zen: [0.004, 0.011, 0.04],
  mid: [0.012, 0.032, 0.085],
  hor: [0.075, 0.07, 0.085],
  band: [0.5, 0.215, 0.068],
  az: 0.225,
  el: -0.03,
  key: mul([0.62, 0.44, 0.36], 0.15),
  keyEl: 0.12,
  amb: [0.022, 0.035, 0.066],
  haze: 1.15,
  aurora: 1,
  dusk: 0,
  under: 1,
};

/**
 * The same night further on, as the flight comes down the valley: the band of
 * first light at the horizon has widened and warmed, the snow takes more of
 * it on the faces turned its way, and the aurora has begun to thin. The night
 * turns toward this all the way from the lake to the canyon.
 */
const LATE_NIGHT: Key = {
  ...NIGHT,
  hor: [0.098, 0.082, 0.088],
  band: [0.95, 0.41, 0.125],
  el: -0.022,
  key: mul([0.7, 0.46, 0.34], 0.3),
  keyEl: 0.1,
  amb: [0.024, 0.036, 0.064],
  aurora: 0.8,
};

/**
 * The keys for a theme (0 light, 1 dark; fractions while the theme changes),
 * a time of day (0..1) and the last lift of the sun (0..1: the light event
 * at the ending).
 * @param sunAz where the sun stands at the end, radians from +y toward +x
 * @param ridge how high the ranges stand there, radians
 */
export function skyAt(theme: number, day: number, lift: number, sunAz: number, ridge: number): SkyKeys {
  // The sun waits behind the ranges, its upper edge just under the crest, and clears it when the camera settles:
  // it comes to rest with its middle a little above the crest, a clean limb standing on the ranges.
  const elEnd = ridge - 0.018 + 0.023 * lift;
  // Late in the light theme's day: the sun has come round to the right, still clear of the ranges, and the light is gold.
  const late: Key = {
    zen: [0.045, 0.13, 0.42],
    mid: [0.16, 0.29, 0.6],
    hor: [0.66, 0.6, 0.68],
    band: [1.75, 1.0, 0.56],
    az: sunAz - 0.07,
    el: Math.max(0.065, ridge + 0.03),
    key: mul([1.0, 0.8, 0.58], 2.85),
    keyEl: 0.075,
    amb: [0.25, 0.35, 0.56],
    haze: 1.0,
    aurora: 0,
    // (Not yet the ending's sky: its extra terms cost nothing until the camera is out over the sea.)
    dusk: 0,
    under: 0.9,
  };
  // The light ending: a low sun on the ranges under a deep blue sky that comes down to warm gold at the horizon
  // (the old ending's blue and gold: rich, with nothing of rose or lavender in it).
  const blue: Key = {
    zen: [0.005, 0.034, 0.125],
    mid: [0.018, 0.105, 0.25],
    hor: [0.78, 0.58, 0.25],
    band: [1.85, 1.2, 0.46],
    az: sunAz,
    el: elEnd,
    key: mul([1.0, 0.68, 0.4], 0.9),
    keyEl: 0.05,
    amb: [0.07, 0.12, 0.28],
    haze: 0.85,
    aurora: 0,
    dusk: 1,
    under: 0.22,
  };
  // The old dark ending: first light.
  const first: Key = {
    zen: [0.007, 0.027, 0.085],
    mid: [0.036, 0.08, 0.14],
    hor: [0.4, 0.2, 0.075],
    band: [2.6, 1.12, 0.24],
    az: sunAz,
    el: elEnd,
    key: mul([1.0, 0.62, 0.3], 0.5),
    keyEl: 0.05,
    amb: [0.03, 0.04, 0.06],
    haze: 1.0,
    // (By first light the aurora has gone.)
    aurora: 0,
    dusk: 1,
    under: 1,
  };
  const d = Math.min(1, Math.max(0, day));
  const light = d < 0.55 ? mixKey(MORNING, late, d / 0.55) : mixKey(late, blue, smooth(0.55, 1, d));
  // (The night holds until the delta; the first light comes over the sea.)
  // (And before that the first light grows a little with every station.)
  const dark = mixKey(mixKey(NIGHT, LATE_NIGHT, smooth(0, 0.1, d)), first, smooth(0.3, 1, d) * smooth(0.3, 1, d) * 0.35 + smooth(0.6, 1, d) * 0.65);
  const k = theme <= 0 ? light : theme >= 1 ? dark : mixKey(light, dark, theme);
  const dir = (az: number, el: number): V3 => [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
  return {
    zen: k.zen,
    mid: k.mid,
    hor: k.hor,
    band: k.band,
    sun: dir(k.az, k.el),
    key: k.key,
    keyDir: dir(k.az, k.keyEl),
    amb: k.amb,
    haze: k.haze,
    aurora: k.aurora,
    dusk: k.dusk,
    under: k.under,
  };
}
