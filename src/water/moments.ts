/**
 * The picture's clockwork: the things in the flight that run by its own
 * clock and not by scroll. Pure functions and plain numbers, so whoever
 * follows the picture (the sound, the checks' offline renders) runs the
 * very same rules instead of a copy of them.
 */

import { proximity } from './registry';
import { COLS } from './world';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The tarn's pulse: one round of call and answer, in seconds. A pulse leaves a shard every half round. */
export const PULSE = 7;
/** The lattice's travelling light: one lap, in seconds. */
export const LAP = 9;

/** The sluices: seconds for a gate to lift, to drop, and for the surge to run its channel; the surge's head throws this many rings on the way. */
export const GATE = { up: 0.45, down: 0.6, surge: 1.15, rings: 6 };

/** One step of the sluices: the open gate lifts, the others drop, and a surge runs down the opened channel. Changes `gate` and `surge` in place. */
export function stepGates(gate: { [i: number]: number }, surge: { [i: number]: number }, open: number, dt: number, still: boolean) {
  for (let i = 0; i < 3; i++) {
    const on = i === open;
    gate[i] = still ? (on ? 1 : 0) : Math.min(1, Math.max(0, gate[i] + (on ? dt / GATE.up : -dt / GATE.down)));
    if (!on) surge[i] = 0;
    else if (still) surge[i] = 1;
    else if (surge[i] < 1) surge[i] = Math.min(1, surge[i] + dt / GATE.surge);
  }
}

/**
 * The first screen's entrance, in seconds from the moment the live picture stands over its still: the eye
 * settles forward from a little back and high (`eye`), the light arrives (`light`), then the first line and
 * its sentence set (`words`). After `over` the first screen is at rest and only breathes.
 */
export const ENTER = { eye: [0, 2.4], light: [0.25, 2.0], words: 1.45, over: 2.4, back: 0.04, high: 1.1 } as const;
/** How far the entrance has come at `t` seconds: the eye's settle and the light's arrival, 0..1 each. */
export const enterAt = (t: number) => {
  const e = Math.min(1, Math.max(0, (t - ENTER.eye[0]) / (ENTER.eye[1] - ENTER.eye[0])));
  // (The eye comes to rest as a thing with weight does: fast at first, then long in settling.)
  return { eye: 1 - (1 - e) ** 3, light: smooth(ENTER.light[0], ENTER.light[1], t) };
};
/**
 * The first screen at rest breathes: the eye sways a little about the name, and the light comes and goes as thin
 * cloud passes. Each -1..1, slow and never in step, from the picture's clock.
 */
export const breathAt = (t: number) => ({ sway: Math.sin(t / 3.7) * 0.6 + Math.sin(t / 2.3 + 1.1) * 0.4, near: Math.sin(t / 5.1 + 0.4), light: Math.sin(t / 4.3 + 2.0) * 0.6 + Math.sin(t / 1.9) * 0.4 });

/**
 * The light before it has arrived, as the keys the shading pass is given (see skyAt): `k` 0 is the first frame,
 * 1 the day's (or the night's) own light, untouched. By day the sun is still behind the ranges at first: the
 * ground is lit low, warm and weak, and the band along the horizon is strong; it clears them and the light
 * comes down the lake. Before dawn the aurora is faint at first and comes up. Changes `sky` in place.
 */
export function firstLight(sky: { sun: number[]; key: number[]; keyDir: number[]; amb: number[]; band: number[]; aurora: number }, k: number, night: number, breath = 0) {
  const w = 1 - Math.min(1, Math.max(0, k));
  const day = 1 - night;
  const lower = (d: number[], by: number) => {
    const az = Math.atan2(d[0], d[1]);
    const el = Math.asin(Math.max(-1, Math.min(1, d[2]))) - by;
    d[0] = Math.sin(az) * Math.cos(el);
    d[1] = Math.cos(az) * Math.cos(el);
    d[2] = Math.sin(el);
  };
  if (w > 0) {
    lower(sky.sun, 0.062 * w * day);
    lower(sky.keyDir, 0.05 * w * day);
    const dim = 1 - w * (0.5 * day + 0.42 * night);
    const warm = [1, 1 - 0.12 * w * day, 1 - 0.3 * w * day];
    for (let i = 0; i < 3; i++) {
      sky.key[i] *= dim * warm[i];
      sky.amb[i] *= 1 - 0.1 * w;
      sky.band[i] *= 1 + 0.45 * w * day - 0.3 * w * night;
    }
    sky.aurora *= 1 - 0.72 * w;
  }
  // At rest the light comes and goes a little, as thin cloud passes.
  if (breath) for (let i = 0; i < 3; i++) sky.key[i] *= 1 + 0.07 * breath * (1 - w);
}

/**
 * The first screen's own light. The name is plates of clear ice, and what
 * lights them stands behind them and to one side, low: by day the sun, so
 * they are rim lit and lit through and throw their shade toward the eye;
 * before dawn a low moon in the same place, cold. `az`: its bearing from +y
 * toward +x, radians; `el`: how high it stands. (The rest of the flight has
 * the hour's own sun: this is let go as the eye leaves the lake.)
 */
export const HERO_SUN = { az: -0.2, el: 0.11, moonAz: -0.23, moonEl: 0.125, moon: [0.105, 0.135, 0.19] };
/** How much of the first screen's light there is at a scroll position (screens): all of it while the name stands, none once the eye has turned to the river. */
export const heroLightAt = (s: number) => 1 - smooth(1.3, 1.95, s);
/**
 * Bring the hour's light round to the first screen's (see HERO_SUN): `k` 0 leaves it, 1 is the first screen's own.
 * Changes `sky` in place; returns where the moon stands and how much of it there is (none by day).
 */
export function heroLight(sky: { sun: number[]; key: number[]; keyDir: number[] }, k: number, night: number): [number, number, number, number] {
  const day = 1 - night;
  const turn = (d: number[], az1: number, el1: number, w: number) => {
    const az = Math.atan2(d[0], d[1]);
    const el = Math.asin(Math.max(-1, Math.min(1, d[2])));
    const a = az + (az1 - az) * w;
    const e = el + (el1 - el) * w;
    d[0] = Math.sin(a) * Math.cos(e);
    d[1] = Math.cos(a) * Math.cos(e);
    d[2] = Math.sin(e);
  };
  if (k > 0) {
    // By day the sun itself comes round. Before dawn the sun stays where it will rise; the ground's light becomes the moon's.
    turn(sky.sun, HERO_SUN.az, HERO_SUN.el, k * day);
    turn(sky.keyDir, HERO_SUN.az + (HERO_SUN.moonAz - HERO_SUN.az) * night, HERO_SUN.el + (HERO_SUN.moonEl - HERO_SUN.el) * night, k);
    for (let i = 0; i < 3; i++) sky.key[i] += (HERO_SUN.moon[i] - sky.key[i]) * k * night;
  }
  const c = Math.cos(HERO_SUN.moonEl);
  return [Math.sin(HERO_SUN.moonAz) * c, Math.cos(HERO_SUN.moonAz) * c, Math.sin(HERO_SUN.moonEl), k * night];
}

/** The light event at the ending, `t` seconds after the camera comes to rest: the sun's last lift and the line of light, 0..1 each. */
// (The line of light runs out over the first two thirds of `ray`; the ribbon of light climbs, `rise`, from where it ends.)
export const DAWN = { lift: [0, 2.6], ray: [0.7, 4.4], rise: [2.7, 4.9], over: 5.2 } as const;
export const dawnLight = (t: number) => ({ lift: smooth(DAWN.lift[0], DAWN.lift[1], t), ray: smooth(DAWN.ray[0], DAWN.ray[1], t), rise: smooth(DAWN.rise[0], DAWN.rise[1], t) });

/**
 * The ribbon of light at the ending. `at`: where its foot stands in the
 * frame, as a share of half the frame's width right of its middle (the sun
 * stands at 0.46, or 0.7 on an upright screen). `lean`: how far it leans
 * toward the sun as it climbs. `e0` and `reach` are the shading pass's own
 * (RIB_E0, RIB_REACH).
 */
export const RIBBON = { at: (aspect: number) => (aspect < 0.8 ? 0.16 : 0.2), lean: 0.5, e0: 0.1, reach: 0.13 };

/** How much of each later station's subject is there to see from a camera position: the columns, the dam, the lattice, the canyon. */
// (The dam is drawn out to 3300 units and let go by 4000: whole from the columns' frame, never a half-faded duplicate.)
export function stationsNear(pos: ArrayLike<number>): [number, number, number, number] {
  const lanes: [number, number, number, number] = [0, 0, 0, 0];
  for (const { lane, x, y, from, to } of proximity) {
    lanes[lane] = 1 - smooth(from, to, Math.hypot(pos[0] - x, pos[1] - y));
  }
  return lanes;
}

/**
 * The next drip from the columns, chosen ahead of its time: when it falls,
 * from which column (the taller, the more often) and where it lands.
 * @param time the picture's clock now
 * @param colH each column's height
 */
export function nextDrip(time: number, colH: ArrayLike<number>, rnd: () => number): { at: number; i: number; x: number; y: number } {
  const at = time + 0.22 + 0.3 * rnd();
  let pick = rnd() * (colH[0] + colH[1] + colH[2] + colH[3]);
  let i = 0;
  while (i < 3 && pick > colH[i]) pick -= colH[i++];
  const a = rnd() * Math.PI * 2;
  // (Each serac is as wide as it is tall, in proportion: the drop lands at its own foot, clear of its shoulder and its fallen block.)
  const r = COLS.r * (colH[i] / COLS.hMax) * 2.0;
  return { at, i, x: COLS.xs[i] + Math.cos(a) * r, y: COLS.y + 26 * Math.sin(i * 2.3) + Math.sin(a) * r };
}
