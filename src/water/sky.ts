/**
 * The flight's light, hour by hour.
 *
 * Time passes along the flight, and each station has its own hour. The
 * world lies far south at midsummer and the flight heads for the pole.
 *
 * By day (the light theme) it is one day. The sun comes up ahead and to the
 * left, behind the name; it goes round to the left as it climbs (the
 * morning's stations are lit across, from the left), stands high behind the
 * eye at noon, comes down on the right through the afternoon (lit across
 * from the right, warming), and sets ahead and to the right over the sea.
 *
 * Before dawn (the dark theme) it is one night that ends at sunrise. Its one
 * key is the moon, low and cold: it climbs over the river, comes down the
 * valley's right side and sets on the ranges at the tarn. Then there is only
 * the sky: the first blue, the blue hour, a pale band, rose on the highest
 * peaks, and dawn over the delta. The aurora is seen twice: faint over the
 * lake, and in full over the rock pool.
 *
 * The hours are keys at the stations' own scroll positions, joined by a
 * curve that never overshoots and has no corner, so the light moves with
 * every pixel of scroll and never steps. The shading pass takes the result
 * as uniforms: nothing here is worked out per pixel.
 *
 * `dayAt` (camera.ts) is still the flight's own clock, 0..1, and the sound
 * still reads it: whoever knows only the clock (the sound) gets the hour
 * that clock stands for.
 */

import { END_AT, SECTIONS, SETTLE_AT, dayAt, stillStops } from './camera';
import { HERO_SUN } from './moments';
import { SUN } from './shaders/terrain';

type V3 = [number, number, number];

export interface SkyKeys {
  zen: V3;
  mid: V3;
  hor: V3;
  band: V3;
  /** toward the sun (it may be under the horizon) */
  sun: V3;
  /** the colour and strength of what lights the ground, and where from: the sun by day, the moon before dawn */
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
  /** the hour's air: mist lying low over the water, a veil of high cloud, how many of the stars are left, how strongly the aurora is drawn */
  air: [number, number, number, number];
  /** how much of the moon is in the sky, 0..1 (none by day, none once it has set) */
  moon: number;
  /** how the ranges are lit: by the side the morning finds, from overhead, by the side the evening finds; and 0..1 the first rose light on the highest peaks */
  range: [number, number, number, number];
  /** the water's own body at this hour: the colour of the light that goes down into it, how milky it is, how quickly it takes that light, how strongly its surface nets it */
  water: { tint: V3; milk: number; clear: number; caust: number };
  /** the hour's ground: how strongly a slope answers a low light (0: the morning's even snow), how much snow the wind lifts, and 0..1 the last light, when only what stands high still has the sun */
  ground: [number, number, number];
}

interface Key {
  zen: V3;
  mid: V3;
  hor: V3;
  band: V3;
  /** the sun's bearing (radians from +y toward +x; it keeps going round, so it is not wrapped) and height */
  az: number;
  el: number;
  key: V3;
  /** where the ground is lit from: the sun's own bearing unless said (before dawn, the moon's), and the height (by day a little under the sun's own where long shade is wanted) */
  keyAz?: number;
  keyEl: number;
  amb: V3;
  haze: number;
  aurora: number;
  dusk: number;
  under: number;
  mist?: number;
  veil?: number;
  stars?: number;
  /** how strongly the aurora is drawn where there is any */
  glow?: number;
  moon?: number;
  /** 0..1 the first rose light on the highest peaks */
  alpen?: number;
  tint?: V3;
  milk?: number;
  clear?: number;
  caust?: number;
  /** how strongly a slope answers the light, and how much snow the wind lifts */
  rake?: number;
  drift?: number;
  /** 0..1 the last light: only what stands high still has the sun */
  last?: number;
}

const mul = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A key as a row of numbers, every field said. */
const N = 41;
function row(k: Key): number[] {
  const t = k.tint ?? [1, 1, 1];
  return [
    ...k.zen,
    ...k.mid,
    ...k.hor,
    ...k.band,
    k.az,
    k.el,
    ...k.key,
    k.keyAz ?? k.az,
    k.keyEl,
    ...k.amb,
    k.haze,
    k.aurora,
    k.dusk,
    k.under,
    k.mist ?? 0,
    k.veil ?? 0,
    k.stars ?? 1,
    k.glow ?? 1,
    k.moon ?? 0,
    k.alpen ?? 0,
    ...t,
    k.milk ?? 1,
    k.clear ?? 1,
    k.caust ?? 1,
    k.rake ?? 0,
    k.drift ?? 0,
    k.last ?? 0,
  ];
}

/**
 * A curve through rows at scroll positions: each number goes through its
 * keys with no corner and never past them (the slope at a key is the mean
 * of the two sides that cannot overshoot, and zero where the number turns
 * back), so nothing ever steps and nothing ever swings past its hour.
 */
function through(at: number[], rows: number[][], s: number): number[] {
  const n = at.length;
  if (s <= at[0]) return rows[0];
  if (s >= at[n - 1]) return rows[n - 1];
  let i = 0;
  while (i < n - 2 && s > at[i + 1]) i++;
  const span = at[i + 1] - at[i];
  const t = (s - at[i]) / span;
  const t2 = t * t;
  const t3 = t2 * t;
  const out = new Array<number>(N);
  for (let c = 0; c < N; c++) {
    const slope = (k: number) => {
      if (k === 0 || k === n - 1) return 0;
      const d0 = (rows[k][c] - rows[k - 1][c]) / (at[k] - at[k - 1]);
      const d1 = (rows[k + 1][c] - rows[k][c]) / (at[k + 1] - at[k]);
      return d0 * d1 <= 0 ? 0 : (2 * d0 * d1) / (d0 + d1);
    };
    out[c] = (2 * t3 - 3 * t2 + 1) * rows[i][c] + (t3 - 2 * t2 + t) * span * slope(i) + (-2 * t3 + 3 * t2) * rows[i + 1][c] + (t3 - t2) * span * slope(i + 1);
  }
  return out;
}

const TAU = Math.PI * 2;

/** Morning at a high latitude: cold clear daylight, a low sun, a pale sky that deepens overhead. The first screen's light (its sun is the first screen's own: see moments.ts). */
const MORNING: Key = {
  zen: [0.06, 0.17, 0.48],
  mid: [0.19, 0.37, 0.7],
  hor: [0.5, 0.65, 0.84],
  band: [1.25, 1.02, 0.74],
  az: HERO_SUN.az,
  el: HERO_SUN.el,
  key: mul([1.0, 0.9, 0.74], 2.9),
  keyEl: SUN.el,
  amb: [0.27, 0.38, 0.56],
  haze: 1.0,
  aurora: 0,
  dusk: 0,
  under: 1,
};

/**
 * The day, stop by stop (the light theme). The sun's bearing runs on round
 * from the first screen's: left of ahead at first light, abeam on the left
 * by mid-morning, behind the eye at noon, abeam on the right in the
 * afternoon and ahead on the right at sunset.
 * @param sunAz where the sun stands at the end, radians from +y toward +x
 * @param ridge how high the ranges stand there, radians
 * @param elEnd how high the sun stands at the ending
 */
function dayKeys(sunAz: number, ridge: number, elEnd: number): [number, Key][] {
  const [, say, view, up, bench, bridge, models, fork, lattice, canyon, delta] = stillStops();
  const end = sunAz - TAU;
  return [
    [0, MORNING],
    // (The first screen's own sun is let go between 1.3 and 1.95 screens: the day begins there, from that very sun.)
    [1.3, MORNING],
    // Early morning: the sun a hand higher and well round to the left, so its light rakes across the bank's wind
    // ridges and every one of them throws a long blue shade; a low mist lies in the river's reach ahead.
    [
      say,
      {
        zen: [0.075, 0.19, 0.48],
        mid: [0.27, 0.41, 0.69],
        hor: [0.74, 0.7, 0.74],
        band: [1.5, 1.0, 0.64],
        az: -1.07,
        el: 0.21,
        key: mul([1.0, 0.81, 0.56], 3.1),
        keyEl: 0.11,
        amb: [0.23, 0.34, 0.6],
        haze: 0.95,
        aurora: 0,
        dusk: 0,
        under: 1,
        mist: 1,
        tint: [1.0, 1.02, 1.0],
        milk: 1.3,
        clear: 0.92,
        rake: 0.35,
      },
    ],
    // Morning: the clearest, coldest air of the day. The light has lost its gold; snow is blue-white and the sky deep and clean.
    [
      view,
      {
        zen: [0.03, 0.115, 0.44],
        mid: [0.115, 0.3, 0.7],
        hor: [0.4, 0.6, 0.88],
        band: [0.85, 0.82, 0.74],
        az: -1.42,
        el: 0.38,
        key: mul([0.88, 0.95, 1.0], 2.9),
        keyEl: 0.2,
        amb: [0.2, 0.37, 0.72],
        haze: 0.5,
        aurora: 0,
        dusk: 0,
        under: 1,
        tint: [0.86, 0.98, 1.08],
        milk: 0.85,
      },
    ],
    // Late morning: a high white sun from behind the left shoulder; the falls' mist stands in it.
    [
      up,
      {
        zen: [0.045, 0.15, 0.5],
        mid: [0.16, 0.35, 0.72],
        hor: [0.5, 0.66, 0.86],
        band: [1.0, 0.94, 0.8],
        az: -1.88,
        el: 0.61,
        key: mul([1.0, 0.97, 0.9], 3.1),
        keyEl: 0.36,
        amb: [0.26, 0.38, 0.58],
        haze: 0.8,
        aurora: 0,
        dusk: 0,
        under: 1,
        mist: 0.3,
        milk: 1.12,
      },
    ],
    // Noon: the sun as high as it gets, behind the eye. The hardest, whitest light and the shortest shade; no glare
    // lies on the water, so the pool is at its deepest and clearest and the light plays on its bed.
    [
      bench,
      {
        zen: [0.035, 0.125, 0.5],
        mid: [0.11, 0.29, 0.71],
        hor: [0.45, 0.63, 0.88],
        band: [0.9, 0.9, 0.86],
        az: -Math.PI,
        el: 0.88,
        key: mul([1.0, 1.0, 0.97], 3.15),
        keyEl: 0.72,
        amb: [0.21, 0.31, 0.52],
        haze: 0.7,
        aurora: 0,
        dusk: 0,
        under: 1.05,
        tint: [0.8, 1.0, 1.04],
        milk: 0.55,
        clear: 1.3,
        caust: 1.5,
      },
    ],
    // Early afternoon: a high thin veil of cloud. Soft silver light with almost no shade in it; a pale sky, and the
    // tarn a mirror under it. The one overcast frame.
    [
      bridge,
      {
        zen: [0.4, 0.45, 0.54],
        mid: [0.52, 0.57, 0.65],
        hor: [0.66, 0.7, 0.76],
        band: [0.62, 0.62, 0.62],
        az: -3.75,
        el: 0.76,
        key: mul([1.0, 0.98, 0.95], 0.8),
        keyEl: 0.6,
        amb: [0.75, 0.8, 0.87],
        haze: 1.25,
        aurora: 0,
        dusk: 0,
        under: 0.8,
        veil: 1,
        tint: [0.8, 0.86, 0.9],
        milk: 0.7,
      },
    ],
    // Afternoon: the veil has gone and the first warmth has come. Cream on the sunlit snow, blue-violet in the shade,
    // and the light from the right, so the seracs throw long shadows across the frame.
    [
      models,
      {
        zen: [0.05, 0.135, 0.44],
        mid: [0.2, 0.32, 0.62],
        hor: [0.68, 0.64, 0.68],
        band: [1.6, 1.02, 0.62],
        az: -4.3,
        el: 0.49,
        key: mul([1.0, 0.84, 0.6], 3.05),
        keyEl: 0.2,
        amb: [0.27, 0.31, 0.6],
        haze: 1.0,
        aurora: 0,
        dusk: 0,
        under: 0.95,
        tint: [1.02, 0.98, 0.94],
        milk: 0.9,
        rake: 0.45,
      },
    ],
    // Late afternoon: gold along every crest and long blue shade in the channels.
    [
      fork,
      {
        zen: [0.04, 0.105, 0.37],
        mid: [0.2, 0.27, 0.5],
        hor: [0.8, 0.62, 0.48],
        band: [2.0, 1.08, 0.5],
        az: -4.5,
        el: 0.3,
        key: mul([1.0, 0.72, 0.36], 3.2),
        keyEl: 0.1,
        amb: [0.18, 0.26, 0.5],
        haze: 1.1,
        aurora: 0,
        dusk: 0,
        under: 0.9,
        tint: [1.0, 0.95, 0.9],
        milk: 0.85,
        rake: 0.8,
        drift: 0.35,
      },
    ],
    // The golden hour: the sun low ahead on the right. Amber on the faces turned to it, cold blue on the others, and
    // the snow the wind lifts is lit gold.
    [
      lattice,
      {
        zen: [0.03, 0.085, 0.31],
        mid: [0.17, 0.23, 0.44],
        hor: [0.88, 0.6, 0.36],
        band: [2.3, 1.12, 0.42],
        az: -5.0,
        el: 0.16,
        key: mul([1.0, 0.58, 0.17], 3.4),
        keyEl: 0.07,
        amb: [0.14, 0.2, 0.4],
        haze: 1.2,
        aurora: 0,
        dusk: 0,
        under: 0.82,
        tint: [0.96, 0.93, 0.9],
        rake: 1,
        drift: 1,
      },
    ],
    // Last light: the sun is nearly down. Only what stands high still has it (the canyon's rim, the top of its far
    // wall); everything lower is in blue shade under a warm strip of sky.
    [
      canyon,
      {
        zen: [0.1, 0.13, 0.31],
        mid: [0.5, 0.36, 0.36],
        hor: [0.95, 0.62, 0.4],
        band: [2.3, 1.1, 0.44],
        az: -5.4,
        el: Math.max(0.07, ridge + 0.035),
        key: mul([1.0, 0.54, 0.18], 3.2),
        keyEl: 0.07,
        amb: [0.13, 0.19, 0.4],
        haze: 0.6,
        aurora: 0,
        dusk: 0,
        under: 0.75,
        tint: [0.8, 0.86, 1.0],
        rake: 0.8,
        drift: 0.3,
        last: 1,
      },
    ],
    // Sunset, over the delta: rose and peach low in the sky, a deep blue above; the light on the floes' rims is
    // pink, and the water is the sky's mirror.
    [
      delta,
      {
        zen: [0.018, 0.068, 0.27],
        mid: [0.1, 0.17, 0.39],
        hor: [0.95, 0.58, 0.44],
        band: [2.3, 1.0, 0.52],
        az: end + 0.07,
        el: Math.max(0.042, ridge + 0.014),
        key: mul([1.0, 0.56, 0.36], 2.6),
        keyEl: 0.058,
        amb: [0.15, 0.2, 0.4],
        haze: 1.0,
        aurora: 0,
        dusk: 0.3,
        under: 0.8,
        tint: [1.0, 0.9, 0.86],
        rake: 0.5,
      },
    ],
    // The sun going down, on the run to sea: it stands just over the ranges, the gold has deepened and the blue
    // overhead with it. (The snow is still light enough for the delta's dark words, which stand until here.)
    [
      delta + 0.95,
      {
        zen: [0.012, 0.05, 0.2],
        mid: [0.045, 0.135, 0.32],
        hor: [0.9, 0.56, 0.26],
        band: [2.2, 1.15, 0.4],
        az: end + 0.03,
        el: Math.max(0.03, ridge + 0.006),
        key: mul([1.0, 0.62, 0.3], 1.7),
        keyEl: 0.052,
        amb: [0.12, 0.18, 0.34],
        haze: 0.9,
        aurora: 0,
        dusk: 0.6,
        under: 0.5,
      },
    ],
    // The light ending: the last gold of the day going to blue. The sun stands on the ranges; the sky is a deep
    // blue that comes down, through a clear pale band, to amber at the horizon.
    [
      SETTLE_AT - 0.25,
      {
        zen: [0.0045, 0.03, 0.118],
        mid: [0.016, 0.098, 0.235],
        hor: [0.52, 0.3, 0.1],
        band: [1.8, 0.88, 0.24],
        az: end,
        el: elEnd,
        key: mul([1.0, 0.66, 0.36], 0.9),
        keyEl: 0.05,
        amb: [0.07, 0.12, 0.28],
        haze: 0.85,
        aurora: 0,
        dusk: 1,
        under: 0.22,
      },
    ],
  ];
}

/** The moon's own light on snow: silver, a little blue. */
const MOONLIGHT: V3 = [0.118, 0.152, 0.215];

/**
 * The night, stop by stop (the dark theme). `az` and `el` are the sun's,
 * under the horizon where it will rise: nothing of it is seen until the
 * last third of the flight. `keyAz` and `keyEl` are the moon's while it is
 * up, and the dawn's own low bearing once it is the dawn that lights the
 * ground.
 */
function nightKeys(sunAz: number, elEnd: number): [number, Key][] {
  const [, say, view, up, bench, bridge, models, fork, lattice, canyon, delta] = stillStops();
  // Deep night over the lake: a low moon behind the name (the first screen's own), a broad faint aurora, every star.
  const lake: Key = {
    zen: [0.004, 0.011, 0.04],
    mid: [0.011, 0.03, 0.084],
    hor: [0.04, 0.06, 0.105],
    band: [0.05, 0.075, 0.13],
    az: 0.225,
    el: -0.2,
    key: HERO_SUN.moon as unknown as V3,
    keyAz: HERO_SUN.moonAz,
    keyEl: HERO_SUN.moonEl,
    amb: [0.022, 0.035, 0.066],
    haze: 1.1,
    aurora: 1,
    dusk: 0,
    under: 1,
    glow: 0.42,
    moon: 1,
  };
  return [
    [0, lake],
    [1.3, lake],
    // (The sound reads the hour from the flight's clock, which stands still until here: the aurora is the lake's until here.)
    [SECTIONS.hero, { ...lake, keyAz: 0.42, keyEl: 0.27, key: mul(MOONLIGHT, 1.0), mist: 0.2 }],
    // Night on the river: the moon has climbed and stands over the reach ahead. Silver-blue light rakes the wind
    // ridges, its path lies on the dark water, and the sky is full of stars.
    [
      say,
      {
        ...lake,
        zen: [0.003, 0.009, 0.036],
        mid: [0.009, 0.025, 0.076],
        hor: [0.034, 0.052, 0.098],
        key: mul(MOONLIGHT, 1.08),
        keyAz: 0.8,
        keyEl: 0.33,
        amb: [0.022, 0.034, 0.066],
        haze: 0.9,
        aurora: 0,
        mist: 0.4,
      },
    ],
    // The basin: the moon a little dimmer through thin air, so the block's own screen is the brightest thing there.
    [view, { ...lake, zen: [0.003, 0.009, 0.036], mid: [0.009, 0.025, 0.076], hor: [0.032, 0.05, 0.096], key: mul(MOONLIGHT, 0.82), keyAz: 0.97, keyEl: 0.36, haze: 0.7, aurora: 0 }],
    // The confluence: the moon beyond the cliff and to the right. The cliff's face is black; the falls and their mist take the light.
    [up, { ...lake, zen: [0.003, 0.009, 0.036], mid: [0.009, 0.025, 0.076], hor: [0.032, 0.05, 0.096], key: mul(MOONLIGHT, 1.1), keyAz: 1.08, keyEl: 0.29, haze: 0.85, aurora: 0, mist: 0.3 }],
    // The rock pool: the moon is low and going, and the aurora has come: the frame's only colour.
    [bench, { ...lake, zen: [0.003, 0.01, 0.034], mid: [0.008, 0.024, 0.07], hor: [0.028, 0.046, 0.088], key: mul(MOONLIGHT, 0.5), keyAz: 1.14, keyEl: 0.15, amb: [0.02, 0.033, 0.06], haze: 0.8, glow: 1 }],
    // Moonset at the tarn: the last of the moon on the ranges. The darkest, stillest frame; the water holds the stars.
    [bridge, { ...lake, zen: [0.0028, 0.008, 0.032], mid: [0.007, 0.02, 0.064], hor: [0.024, 0.04, 0.08], band: [0.04, 0.06, 0.11], key: mul(MOONLIGHT, 0.1), keyAz: 1.17, keyEl: 0.026, amb: [0.017, 0.027, 0.054], haze: 0.8, aurora: 0 }],
    // The first blue: the moon has gone. The sky ahead deepens to cobalt at the horizon and the stars begin to thin.
    [
      models,
      {
        zen: [0.0035, 0.011, 0.046],
        mid: [0.012, 0.037, 0.112],
        hor: [0.03, 0.07, 0.185],
        band: [0.06, 0.13, 0.32],
        az: 0.4,
        el: -0.16,
        key: [0, 0, 0],
        keyAz: 1.19,
        keyEl: 0.02,
        amb: [0.018, 0.034, 0.08],
        haze: 0.9,
        aurora: 0,
        dusk: 0,
        under: 1,
        stars: 0.62,
        moon: 0,
      },
    ],
    // The blue hour: an even cobalt light from the whole sky and no shadow anywhere. Snow is blue, water steel.
    [
      fork,
      {
        zen: [0.01, 0.03, 0.105],
        mid: [0.03, 0.078, 0.21],
        hor: [0.07, 0.145, 0.33],
        band: [0.1, 0.19, 0.38],
        az: 0.5,
        el: -0.12,
        key: [0, 0, 0],
        keyAz: sunAz,
        keyEl: 0.05,
        amb: [0.04, 0.076, 0.17],
        haze: 1.0,
        aurora: 0,
        dusk: 0,
        under: 1,
        stars: 0.28,
        moon: 0,
      },
    ],
    // Before sunrise: a pale band lies along the horizon, and the highest far peaks take the first rose light.
    [
      lattice,
      {
        zen: [0.016, 0.046, 0.15],
        mid: [0.052, 0.105, 0.26],
        hor: [0.24, 0.25, 0.36],
        band: [0.5, 0.4, 0.42],
        az: sunAz - 0.06,
        el: -0.08,
        key: mul([1.0, 0.62, 0.62], 0.07),
        keyAz: sunAz,
        keyEl: 0.05,
        amb: [0.105, 0.118, 0.19],
        haze: 1.05,
        aurora: 0,
        dusk: 0.06,
        under: 1,
        stars: 0.1,
        moon: 0,
        alpen: 1,
      },
    ],
    // Dawn coming: the canyon is deep blue, the strip of sky over it rose, and the top of its wall is touched pink.
    [
      canyon,
      {
        zen: [0.02, 0.05, 0.165],
        mid: [0.1, 0.11, 0.25],
        hor: [0.44, 0.25, 0.29],
        band: [1.0, 0.52, 0.44],
        az: sunAz - 0.03,
        el: -0.05,
        key: mul([1.0, 0.56, 0.54], 0.2),
        keyAz: sunAz,
        keyEl: 0.05,
        amb: [0.058, 0.09, 0.2],
        haze: 1.0,
        aurora: 0,
        dusk: 0.2,
        under: 1,
        stars: 0.03,
        moon: 0,
        alpen: 0.8,
      },
    ],
    // Dawn over the delta: rose and gold low in the sky, the stars gone.
    [
      delta,
      {
        zen: [0.012, 0.035, 0.125],
        mid: [0.06, 0.08, 0.2],
        hor: [0.5, 0.25, 0.2],
        band: [1.35, 0.72, 0.42],
        az: sunAz,
        el: -0.03,
        key: mul([1.0, 0.66, 0.5], 0.36),
        keyAz: sunAz,
        keyEl: 0.05,
        amb: [0.046, 0.066, 0.14],
        haze: 1.0,
        aurora: 0,
        dusk: 0.5,
        under: 1,
        stars: 0,
        moon: 0,
        alpen: 0.4,
      },
    ],
    // The dark ending is the first light of morning: a deep blue sky with the last stars in it, rose along the
    // horizon, and pale gold only where the sun is coming up.
    [
      SETTLE_AT - 0.25,
      {
        zen: [0.003, 0.01, 0.05],
        mid: [0.011, 0.028, 0.108],
        hor: [0.2, 0.085, 0.11],
        band: [1.25, 0.82, 0.5],
        az: sunAz,
        el: elEnd,
        key: mul([1.0, 0.74, 0.56], 0.45),
        keyAz: sunAz,
        keyEl: 0.05,
        amb: [0.028, 0.04, 0.075],
        haze: 0.95,
        // (By first light the aurora has gone.)
        aurora: 0,
        dusk: 1,
        under: 1,
        stars: 1,
        moon: 0,
      },
    ],
  ];
}

/**
 * How much of the aurora the night has at a scroll position. It is seen
 * twice: over the lake, and over the rock pool, where it comes up as the
 * eye arrives and has gone before the tarn.
 */
function auroraAt(s: number): number {
  const bench = stillStops()[4];
  return Math.max(1 - smooth(SECTIONS.hero, SECTIONS.hero + 0.6, s), smooth(bench - 1.6, bench - 0.5, s) * (1 - smooth(bench + 0.75, bench + 1.6, s)));
}

/** The scroll position the flight's clock stands for (the clock stands still over the lake: there it is the lake's own hour). */
function scrollOf(day: number): number {
  if (day <= 0) return 0;
  if (day >= 1) return END_AT;
  let a = SECTIONS.hero;
  let b = END_AT;
  for (let i = 0; i < 44; i++) {
    const m = (a + b) / 2;
    if (dayAt(m) < day) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

const dir = (az: number, el: number): V3 => [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];

/** The hour's keys as the shading pass takes them. */
function keysOf(r: number[], night: number): SkyKeys {
  const az = r[12];
  const el = r[13];
  const keyAz = r[17];
  // How the ranges are lit. Their own light was baked for a low morning sun on the left: a light from near that
  // bearing finds the faces it found; one from the other side finds the faces turned from it; a high one finds
  // whatever lies open to the sky.
  const off = Math.max(0, Math.abs(Math.atan2(Math.sin(keyAz - SUN.az), Math.cos(keyAz - SUN.az))) - 0.35);
  const side = Math.cos(Math.min(Math.PI, off * (Math.PI / (Math.PI - 0.35))));
  const high = smooth(0.15, 0.85, el) * (1 - night);
  return {
    zen: [r[0], r[1], r[2]],
    mid: [r[3], r[4], r[5]],
    hor: [r[6], r[7], r[8]],
    band: [r[9], r[10], r[11]],
    sun: dir(az, el),
    key: [r[14], r[15], r[16]],
    keyDir: dir(keyAz, r[18]),
    amb: [r[19], r[20], r[21]],
    haze: r[22],
    aurora: r[23],
    dusk: r[24],
    under: r[25],
    air: [r[26], r[27], r[28], r[29]],
    moon: r[30],
    range: [Math.pow(0.5 + 0.5 * side, 1.5) * (1 - 0.75 * high), 0.9 * high, Math.pow(0.5 - 0.5 * side, 1.5) * (1 - 0.75 * high), r[31]],
    water: { tint: [r[32], r[33], r[34]], milk: r[35], clear: r[36], caust: r[37] },
    ground: [r[38], r[39], r[40]],
  };
}

/** A theme's keys laid out as rows, kept for the few sets of measures they are asked with (the picture's, the sound's). */
interface Table {
  theme: number;
  sunAz: number;
  ridge: number;
  elEnd: number;
  at: number[];
  rows: number[][];
}
const tables: Table[] = [];
let tableNext = 0;
function table(theme: number, sunAz: number, ridge: number, elEnd: number): Table {
  for (const t of tables) if (t.theme === theme && t.sunAz === sunAz && t.ridge === ridge && t.elEnd === elEnd) return t;
  const k = theme ? nightKeys(sunAz, elEnd) : dayKeys(sunAz, ridge, elEnd);
  const t: Table = { theme, sunAz, ridge, elEnd, at: k.map((x) => x[0]), rows: k.map((x) => row(x[1])) };
  tables[tableNext] = t;
  tableNext = (tableNext + 1) % 6;
  return t;
}

/**
 * The keys for a theme (0 light, 1 dark; fractions while the theme changes),
 * a time of day (0..1) and the last lift of the sun (0..1: the light event
 * at the ending).
 * @param sunAz where the sun stands at the end, radians from +y toward +x
 * @param ridge how high the ranges stand there, radians
 * @param at the scroll position, in screens, where it is known (the picture knows it; the sound knows only the clock)
 */
export function skyAt(theme: number, day: number, lift: number, sunAz: number, ridge: number, at?: number): SkyKeys {
  // The sun waits behind the ranges, its upper edge just under the crest, and clears it when the camera settles:
  // it comes to rest with its middle a little above the crest, a clean limb standing on the ranges.
  const elEnd = ridge - 0.018 + 0.023 * lift;
  const s = at ?? scrollOf(day);
  const light = () => {
    const k = table(0, sunAz, ridge, elEnd);
    return through(k.at, k.rows, s);
  };
  const dark = () => {
    const k = table(1, sunAz, ridge, elEnd);
    const r = through(k.at, k.rows, s).slice();
    r[23] = auroraAt(s);
    return r;
  };
  if (theme <= 0) return keysOf(light(), 0);
  if (theme >= 1) return keysOf(dark(), 1);
  const a = light();
  const b = dark();
  return keysOf(
    a.map((v, i) => lerp(v, b[i], theme)),
    theme,
  );
}

/** The two scripts as they are built, for whoever writes them down: each stop's scroll position and its keys in both themes. */
export function hoursTable(sunAz: number, ridge: number): { s: number; light: SkyKeys; dark: SkyKeys }[] {
  return stillStops().map((s) => ({ s, light: skyAt(0, dayAt(s), 1, sunAz, ridge, s), dark: skyAt(1, dayAt(s), 1, sunAz, ridge, s) }));
}
