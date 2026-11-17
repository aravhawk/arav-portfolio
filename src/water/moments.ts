/**
 * The picture's clockwork: the things in the flight that run by its own
 * clock and not by scroll. Pure functions and plain numbers, so whoever
 * follows the picture (the sound, the checks' offline renders) runs the
 * very same rules instead of a copy of them.
 */

import { CANYON, COLS, DAM, LATTICE } from './world';

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
  const near = (x: number, y: number, a: number, b: number) => 1 - smooth(a, b, Math.hypot(pos[0] - x, pos[1] - y));
  return [near(1340, COLS.y, 1750, 2350), near(1300, DAM.y, 3300, 4000), near(LATTICE.x, LATTICE.y, 2300, 2900), near(1700, (CANYON.y0 + CANYON.y1) / 2, 3700, 4600)];
}

/**
 * The next drip from the columns, chosen ahead of its time: when it falls
 * and from which column (the taller, the more often).
 * @param time the picture's clock now
 * @param colH each column's height
 */
export function nextDrip(time: number, colH: ArrayLike<number>, rnd: () => number): { at: number; i: number } {
  const at = time + 0.22 + 0.3 * rnd();
  let pick = rnd() * (colH[0] + colH[1] + colH[2] + colH[3]);
  let i = 0;
  while (i < 3 && pick > colH[i]) pick -= colH[i++];
  return { at, i };
}
