import { describe, expect, it } from 'vitest';
import { arrivalIndex, arrivalOf, camN, crackVoice, dripVoice, dropVoice, gust, latticeAt, latticeVoice, mixOf, scrollN, shardVoice, swell, uiVoice } from '@/audio/mapping';
import { type Scene, SceneReader, type SignalsLike, groundAt, movementAt, seenAt, wetUnder } from '@/audio/scene';
import { ARRIVAL, MOVE, PENTA } from '@/audio/theory';
import { END_AT, MELT, SETTLE_AT, basisOf, dayAt, flightKeys, poseAt, sectionStarts, stillStops } from '@/water/camera';
import { COLS, DAM, DELTA, LAKE, LATTICE, SHARDS, SLUICES, STREAM, TARN } from '@/water/world';

/** A scene with nothing in it, to change one thing at a time. */
const scene = (over: Partial<Scene> = {}): Scene => ({
  home: true,
  dt: 1 / 60,
  s: 5,
  sv: 0,
  melt: 1,
  meltRate: 0,
  day: 0,
  rest: false,
  night: 0,
  calm: false,
  camH: 200,
  camV: 0,
  water: 0.3,
  near: 0.5,
  pan: 0,
  flow: 0.6,
  white: 0.1,
  ice: 0,
  sea: 0,
  tarn: 0,
  cols: 0,
  dam: 0,
  lattice: 0,
  canyon: 0,
  walls: 0,
  move: MOVE.river,
  over: false,
  px: 0.5,
  pv: 0,
  far: 0,
  clock: 0,
  gate: [1, 0, 0],
  surge: [1, 0, 0],
  ray: 0,
  lift: 0,
  cam: null,
  aspect: 1.6,
  ...over,
});

const pc = (m: number) => ((m % 12) + 12) % 12;

describe('the mix follows the scene', () => {
  it('keeps every level between nothing and full, whatever the scene', () => {
    const extremes: Partial<Scene>[] = [{}, { over: true, far: 70, pv: 0 }, { sv: 40, camV: 1e5, water: 1, near: 1, flow: 1, white: 1, ice: 1, sea: 1, pv: 50, over: true, far: 12, meltRate: 9, melt: 0.5, walls: 1, tarn: 1, surge: [0.5, 0.5, 0.5], dam: 1 }, { home: false }, { calm: true, sv: 9 }];
    for (const e of extremes) {
      for (const t of [0, 3.7, 100.2]) {
        const m = mixOf(scene(e), t);
        for (const k of ['bed', 'air', 'bass', 'wind', 'whistle', 'stream', 'rush', 'sea', 'wake', 'echo', 'worldSend'] as const) {
          expect(m[k], k).toBeGreaterThanOrEqual(0);
          expect(m[k], k).toBeLessThanOrEqual(1);
        }
        for (const k of ['windPan', 'streamPan', 'rushPan', 'wakePan'] as const) expect(Math.abs(m[k]), k).toBeLessThanOrEqual(1);
        for (const k of ['bedCut', 'windHz', 'streamCut', 'rushHz', 'seaCut', 'wakeHz', 'worldCut'] as const) {
          expect(m[k], k).toBeGreaterThan(60);
          expect(m[k], k).toBeLessThanOrEqual(20000);
        }
        expect(m.streamRate).toBeGreaterThan(0.5);
        expect(m.streamRate).toBeLessThan(2);
      }
    }
  });

  it('water: more of it in frame, nearer, and faster is louder; it sits on the side it is seen on', () => {
    expect(mixOf(scene({ water: 0.5 }), 0).stream).toBeGreaterThan(mixOf(scene({ water: 0.1 }), 0).stream);
    expect(mixOf(scene({ near: 0.9 }), 0).stream).toBeGreaterThan(mixOf(scene({ near: 0.2 }), 0).stream);
    expect(mixOf(scene({ flow: 1 }), 0).stream).toBeGreaterThan(mixOf(scene({ flow: 0.1 }), 0).stream);
    expect(mixOf(scene({ water: 0 }), 0).stream).toBe(0);
    expect(mixOf(scene({ pan: 0.6 }), 0).streamPan).toBeGreaterThan(0.3);
    expect(mixOf(scene({ pan: -0.6 }), 0).streamPan).toBeLessThan(-0.3);
    // Nearer water is brighter, and it runs higher when the page moves.
    expect(mixOf(scene({ near: 0.9 }), 0).streamCut).toBeGreaterThan(mixOf(scene({ near: 0.2 }), 0).streamCut);
    expect(mixOf(scene({ sv: 2 }), 0).streamRate).toBeGreaterThan(mixOf(scene({ sv: 0 }), 0).streamRate);
  });

  it('white water follows the white in frame, the scroll, the camera and the open sluice', () => {
    const still = mixOf(scene({ white: 0 }), 0).rush;
    expect(mixOf(scene({ white: 0.8 }), 0).rush).toBeGreaterThan(still);
    expect(mixOf(scene({ white: 0, sv: 2 }), 0).rush).toBeGreaterThan(still);
    expect(mixOf(scene({ white: 0, camV: 2000 }), 0).rush).toBeGreaterThan(still);
    // The surge is a swell: nothing as it sets out, most half way down, gone when it has passed.
    const at = (g: number) => mixOf(scene({ white: 0, water: 0, dam: 1, surge: [0, g, 0] }), 0).rush;
    expect(at(0)).toBe(0);
    expect(at(0.5)).toBeGreaterThan(at(0.15));
    expect(at(0.5)).toBeGreaterThan(at(0.9));
    expect(at(1)).toBe(0);
  });

  it('wind: louder over ice, from higher up and when the camera moves; nearly gone at the tarn and between the canyon’s walls', () => {
    const base = mixOf(scene(), 0).wind;
    expect(mixOf(scene({ ice: 1 }), 0).wind).toBeGreaterThan(base);
    expect(mixOf(scene({ camH: 700 }), 0).wind).toBeGreaterThan(base);
    expect(mixOf(scene({ camV: 2000 }), 0).wind).toBeGreaterThan(base);
    expect(mixOf(scene({ tarn: 1 }), 0).wind).toBeLessThan(base * 0.4);
    expect(mixOf(scene({ walls: 1 }), 0).wind).toBeLessThan(base * 0.6);
    expect(mixOf(scene({ camV: 2000 }), 0).windHz).toBeGreaterThan(mixOf(scene(), 0).windHz);
  });

  it('the tarn is nearly silent', () => {
    const river = mixOf(scene(), 0);
    const tarn = mixOf(scene({ tarn: 1, flow: 0.02, white: 0, water: 0.9 }), 0);
    expect(tarn.stream).toBeLessThan(0.06);
    expect(tarn.rush).toBeLessThan(0.02);
    expect(tarn.wind).toBeLessThan(river.wind * 0.4);
  });

  it('the canyon closes the sound in and opens it again', () => {
    const open = mixOf(scene({ walls: 0 }), 0);
    const half = mixOf(scene({ walls: 0.5 }), 0);
    const shut = mixOf(scene({ walls: 1 }), 0);
    expect(open.worldCut).toBeCloseTo(18000, 0);
    expect(shut.worldCut).toBeCloseTo(1400, 0);
    expect(half.worldCut).toBeLessThan(open.worldCut);
    expect(half.worldCut).toBeGreaterThan(shut.worldCut);
    expect(shut.echo).toBeGreaterThan(open.echo);
    expect(open.echo).toBe(0);
    expect(shut.bedCut).toBeLessThan(open.bedCut);
  });

  it('the bed is brighter by day than before dawn, brighter as the ice goes, and has no bass until there is water', () => {
    expect(mixOf(scene({ night: 0 }), 0).bedCut).toBeGreaterThan(mixOf(scene({ night: 1 }), 0).bedCut);
    expect(mixOf(scene({ melt: 1, ice: 0 }), 0).bedCut).toBeGreaterThan(mixOf(scene({ melt: 0, ice: 1 }), 0).bedCut);
    expect(mixOf(scene({ melt: 0 }), 0).bass).toBe(0);
    expect(mixOf(scene({ melt: 1 }), 0).bass).toBe(1);
    expect(mixOf(scene({ home: false }), 0).bed).toBeLessThan(mixOf(scene(), 0).bed);
  });

  it('the ice cracks as fast as it melts, and not at all when it is whole, gone, or held still', () => {
    const at = (r: number, melt = 0.5) => mixOf(scene({ meltRate: r, melt, ice: 1 - melt }), 0).cracks;
    expect(at(0)).toBe(0);
    expect(at(0.1)).toBeGreaterThan(0);
    expect(at(0.3)).toBeGreaterThan(at(0.1));
    expect(at(0.3, 0)).toBe(0);
    expect(at(0.3, 1)).toBe(0);
    expect(mixOf(scene({ meltRate: 0.3, melt: 0.5, calm: true }), 0).cracks).toBe(0);
    // Whole ice groans; ice that is going does not.
    expect(mixOf(scene({ ice: 1, melt: 0 }), 0).groans).toBeGreaterThan(0);
    expect(mixOf(scene({ ice: 0 }), 0).groans).toBe(0);
  });

  it('the pointer’s wake: only over water, louder and brighter when faster, softer when farther, placed where the pointer is', () => {
    expect(mixOf(scene({ over: false, pv: 3 }), 0).wake).toBe(0);
    expect(mixOf(scene({ over: true, far: 20, pv: 0 }), 0).wake).toBe(0);
    const slow = mixOf(scene({ over: true, far: 20, pv: 0.4 }), 0);
    const fast = mixOf(scene({ over: true, far: 20, pv: 2.2 }), 0);
    expect(fast.wake).toBeGreaterThan(slow.wake);
    expect(fast.wakeHz).toBeGreaterThan(slow.wakeHz);
    expect(mixOf(scene({ over: true, far: 65, pv: 2.2 }), 0).wake).toBeLessThan(fast.wake);
    expect(mixOf(scene({ over: true, far: 20, pv: 1, px: 0.9 }), 0).wakePan).toBeGreaterThan(0.5);
    expect(mixOf(scene({ over: true, far: 20, pv: 1, px: 0.1 }), 0).wakePan).toBeLessThan(-0.5);
  });

  it('reduced motion calms what motion drives, and leaves the bed alone', () => {
    const moving = { sv: 2.5, camV: 2400, water: 0.3 };
    const full = mixOf(scene(moving), 0);
    const calm = mixOf(scene({ ...moving, calm: true }), 0);
    expect(calm.rush).toBeLessThan(full.rush * 0.6);
    expect(calm.streamRate).toBeLessThan(full.streamRate);
    expect(calm.windHz).toBeLessThan(full.windHz);
    expect(calm.windPan).toBe(0);
    expect(calm.bed).toBe(full.bed);
    expect(scrollN(2.5, true)).toBeCloseTo(0.3, 5);
    expect(camN(2400, true)).toBeCloseTo(0.3, 5);
  });

  it('gusts and the swell never stop and never leave their range', () => {
    for (let t = 0; t < 200; t += 0.37) {
      expect(gust(t, false)).toBeGreaterThan(0.7);
      expect(gust(t, false)).toBeLessThanOrEqual(1);
      expect(swell(t)).toBeGreaterThanOrEqual(0);
      expect(swell(t)).toBeLessThanOrEqual(1);
    }
  });
});

describe('each moment is built from where and what it is', () => {
  it('a drop: near water is higher, brighter and drier than far water; it lands where it was pressed; it is in key', () => {
    const near = dropVoice(0.2, 14);
    const far = dropVoice(0.85, 66);
    expect(near.midi).toBeGreaterThan(far.midi);
    expect(near.cut).toBeGreaterThan(far.cut);
    expect(near.gain).toBeGreaterThan(far.gain);
    expect(near.send).toBeLessThan(far.send);
    expect(near.pan).toBeLessThan(0);
    expect(far.pan).toBeGreaterThan(0);
    for (let far2 = 10; far2 <= 80; far2 += 3) expect(PENTA).toContain(pc(dropVoice(0.5, far2).midi));
  });

  it('a crack: placed across the frame, duller and wetter from far off, with a body only when it is big', () => {
    expect(crackVoice(0.1, 0.2, 0.5).pan).toBeLessThan(-0.5);
    expect(crackVoice(0.9, 0.2, 0.5).pan).toBeGreaterThan(0.5);
    expect(crackVoice(0.5, 0.9, 0.5).cut).toBeLessThan(crackVoice(0.5, 0.1, 0.5).cut);
    expect(crackVoice(0.5, 0.9, 0.5).send).toBeGreaterThan(crackVoice(0.5, 0.1, 0.5).send);
    expect(crackVoice(0.5, 0.9, 0.5).gain).toBeLessThan(crackVoice(0.5, 0.1, 0.5).gain);
    expect(crackVoice(0.5, 0.3, 0.3).body).toBe(0);
    expect(crackVoice(0.5, 0.3, 0.95).body).toBeGreaterThan(0.5);
    expect(crackVoice(0.5, 0.95, 0.8).ring).toBeGreaterThan(crackVoice(0.5, 0.1, 0.8).ring);
    for (const u of [0, 0.5, 1]) for (const d of [0, 0.5, 1]) for (const s of [0, 0.5, 1]) expect(crackVoice(u, d, s).cut).toBeGreaterThan(900);
  });

  it('the shards, the lattice, the drips and the controls', () => {
    expect(shardVoice(0, -0.5, 0).midi - shardVoice(1, 0.5, 0).midi).toBe(3);
    expect(shardVoice(0, -0.5, 0).pan).toBeLessThan(0);
    expect(shardVoice(1, 0.5, 0).pan).toBeGreaterThan(0);
    expect(shardVoice(0, 0, 1).cut).toBeLessThan(shardVoice(0, 0, 0).cut);
    expect(latticeVoice(3, 3, 0).midi).toBeGreaterThan(latticeVoice(0, 0, 0).midi);
    // A tall column drips lower and fuller than a short one.
    expect(dripVoice(1, 0).midi).toBeLessThan(dripVoice(0.1, 0).midi);
    expect(dripVoice(1, 0).gain).toBeGreaterThan(dripVoice(0.1, 0).gain);
    // The nav plays left to right, and a press is the hover's note an octave down.
    expect(uiVoice('hover', 0.9).midi).toBeGreaterThan(uiVoice('hover', 0.1).midi);
    expect(uiVoice('hover', 0.5).midi - uiVoice('tap', 0.5).midi).toBe(12);
    for (const x of [0, 0.3, 0.6, 1]) expect(PENTA).toContain(pc(uiVoice('hover', x).midi));
  });

  it('the arrival: the swell rises with the sun’s lift and lets go after it; the notes come as the light runs in', () => {
    expect(arrivalOf(0, 0)).toBe(0);
    expect(arrivalOf(0.5, 0)).toBeGreaterThan(0.3);
    expect(arrivalOf(1, 0)).toBe(1);
    expect(arrivalOf(1, 6)).toBeLessThan(0.4);
    expect(arrivalOf(1, 60)).toBeLessThan(0.001);
    expect(arrivalIndex(0)).toBe(-1);
    let last = -1;
    for (let ray = 0.02; ray <= 1; ray += 0.01) {
      const i = arrivalIndex(ray);
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
    }
    expect(last).toBe(ARRIVAL.length - 1);
  });

  it('the lattice’s light: sixteen cubes in order each lap, four to a row a third of a second apart', () => {
    const times: number[] = [];
    let seen = -1;
    for (let t = 0; t < 9; t += 0.005) {
      const { cube, lap } = latticeAt(t, LATTICE.pitch);
      expect(lap).toBe(0);
      if (cube > seen) {
        expect(cube).toBe(seen + 1);
        seen = cube;
        times.push(t);
      }
    }
    expect(seen).toBe(15);
    // Within a row the light takes pitch / speed from cube to cube.
    const total = Math.hypot(2 * LATTICE.pitch, 110) * 2 + 3 * (4 * LATTICE.pitch + (Math.PI * LATTICE.pitch) / 2) + 4 * LATTICE.pitch + 500;
    const stepT = LATTICE.pitch / (total / 9);
    expect(times[1] - times[0]).toBeCloseTo(stepT, 1);
    expect(times[4] - times[3]).toBeGreaterThan(stepT * 2);
    expect(latticeAt(9.2, LATTICE.pitch).lap).toBe(1);
  });
});

describe('the scene is read from what the picture publishes', () => {
  const sig = (s: number, at: number, more: Partial<SignalsLike> = {}): SignalsLike => {
    const cam = basisOf(poseAt(flightKeys(1.6), s));
    return { at, s, cam, aspect: 1.6, melt: (s - MELT.from) / (MELT.to - MELT.from), day: dayAt(s), rest: s >= SETTLE_AT - 0.02, clock: at / 1000, st: [0, 0, 0, 0], gate: [1, 0, 0], surge: [1, 0, 0], ray: 0, lift: 0, px: 0.5, py: 0.5, far: 0, moved: -1e9, scrollY: 0, ...more };
  };
  const env = { night: 0, calm: false, viewW: 1440, viewH: 900 };

  it('the world’s plan: lake, river, tarn, sea and land', () => {
    expect(groundAt(1300, LAKE.y1 - 800, 0, [1, 0, 0])).toMatchObject({ wet: 0, ice: 1 });
    expect(groundAt(1300, LAKE.y1 - 800, 1, [1, 0, 0])).toMatchObject({ wet: 1, ice: 0 });
    const mid = { x: (STREAM[1].x + STREAM[2].x) / 2, y: (STREAM[1].y + STREAM[2].y) / 2 };
    expect(groundAt(mid.x, mid.y, 1, [1, 0, 0]).wet).toBe(1);
    expect(groundAt(mid.x + 700, mid.y, 1, [1, 0, 0]).wet).toBe(0);
    expect(groundAt(TARN.x, TARN.y, 1, [1, 0, 0])).toMatchObject({ wet: 1, still: 1 });
    expect(groundAt(1800, DELTA.sea + 600, 1, [1, 0, 0])).toMatchObject({ wet: 1, sea: 1 });
  });

  it('at the top the frame is ice; at each station there is water in frame; at the end it is sea', () => {
    const top = new SceneReader().read(sig(0, 1000), 1000, env);
    expect(top.home).toBe(true);
    expect(top.ice).toBeGreaterThan(0.9);
    expect(top.water).toBe(0);
    expect(top.move).toBe(MOVE.ice);
    const stops = stillStops();
    for (const s of stops.slice(1)) {
      const sc = new SceneReader().read(sig(s, 1000), 1000, env);
      expect(sc.water, `water at ${s}`).toBeGreaterThan(0.03);
      expect(sc.near).toBeGreaterThan(0.1);
      expect(Math.abs(sc.pan)).toBeLessThanOrEqual(1);
    }
    const end = new SceneReader().read(sig(END_AT, 1000), 1000, env);
    expect(end.sea).toBeGreaterThan(0.8);
    expect(end.rest).toBe(true);
    expect(end.move).toBe(MOVE.rest);
  });

  it('the tarn is found at its station and nowhere else', () => {
    const stops = stillStops();
    stops.forEach((s, i) => {
      const sc = new SceneReader().read(sig(s, 1000), 1000, env);
      if (i === 5) expect(sc.tarn).toBeGreaterThan(0.6);
      else expect(sc.tarn, `station ${i}`).toBeLessThan(0.2);
    });
  });

  it('the walls close in only inside the canyon', () => {
    const [, , , , , , , , , canyon] = sectionStarts();
    const stops = stillStops();
    expect(new SceneReader().read(sig(canyon + 1.2, 1000), 1000, env).walls).toBeGreaterThan(0.7);
    for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 10, 11]) expect(new SceneReader().read(sig(stops[i], 1000), 1000, env).walls, `station ${i}`).toBeLessThan(0.05);
  });

  it('speeds come from one frame to the next, and a jump is not speed', () => {
    const r = new SceneReader();
    r.read(sig(3, 1000), 1000, env);
    let sc = r.read(sig(3, 1016.7), 1016.7, env);
    expect(sc.sv).toBe(0);
    expect(sc.camV).toBe(0);
    // A second of steady scrolling at one screen a second.
    for (let i = 1; i <= 60; i++) sc = r.read(sig(3 + i / 60, 1016.7 + i * 16.67), 1016.7 + i * 16.67, env);
    expect(sc.sv).toBeGreaterThan(0.9);
    expect(sc.sv).toBeLessThan(1.1);
    expect(sc.camV).toBeGreaterThan(100);
    // Then a jump to another part of the page.
    const jumped = r.read(sig(20, 2040), 2040, env);
    expect(jumped.sv).toBeLessThan(sc.sv + 0.01);
  });

  it('the melt’s rate is its change per second', () => {
    const r = new SceneReader();
    let sc = r.read(sig(0.5, 1000), 1000, env);
    for (let i = 1; i <= 90; i++) sc = r.read(sig(0.5 + (0.5 * i) / 60, 1000 + i * 16.67), 1000 + i * 16.67, env);
    // Half a screen a second over a melt 1.9 screens long.
    expect(sc.meltRate).toBeCloseTo(0.5 / (MELT.to - MELT.from), 1);
  });

  it('with no flight published it is an inner page', () => {
    const none: SignalsLike = { ...sig(0, 0), cam: null, at: 0 };
    const sc = new SceneReader().read(none, 5000, env);
    expect(sc.home).toBe(false);
    expect(sc.move).toBe(MOVE.page);
    expect(sc.water).toBe(0);
    // A flight that stopped publishing (the page was left) is no longer there.
    expect(new SceneReader().read(sig(3, 1000), 3000, env).home).toBe(false);
  });

  it('the pointer is over water only where the picture says so, and its speed dies away when it stops', () => {
    const r = new SceneReader();
    let sc = r.read(sig(3, 1000, { far: 30, moved: 1000, px: 0.2 }), 1000, env);
    for (let i = 1; i <= 30; i++) sc = r.read(sig(3, 1000 + i * 16.67, { far: 30, moved: 1000 + i * 16.67, px: 0.2 + i * 0.02 }), 1000 + i * 16.67, env);
    expect(sc.over).toBe(true);
    expect(sc.pv).toBeGreaterThan(1);
    for (let i = 31; i <= 120; i++) sc = r.read(sig(3, 1000 + i * 16.67, { far: 30, moved: 1500, px: 0.8 }), 1000 + i * 16.67, env);
    expect(sc.pv).toBeLessThan(0.02);
    expect(new SceneReader().read(sig(3, 1000, { far: 0, moved: 1000 }), 1000, env).over).toBe(false);
    // Over the frozen lake the ray meets the ground, but it is ice: no wake. Over the bank beside the river: none either.
    expect(new SceneReader().read(sig(0, 1000, { far: 30, moved: 1000, px: 0.5, py: 0.7 }), 1000, env).over).toBe(false);
    expect(wetUnder(basisOf(poseAt(flightKeys(1.6), 0)), 1.6, 0.5, 0.7, 0, [1, 0, 0])).toBe(0);
    expect(wetUnder(basisOf(poseAt(flightKeys(1.6), 0)), 1.6, 0.5, 0.7, 1, [1, 0, 0])).toBe(1);
  });

  it('a sound is placed where its cause is seen, and a cause out of frame is not heard', () => {
    const stops = stillStops();
    const cam = (i: number) => basisOf(poseAt(flightKeys(1.6), stops[i]));
    // At the dam all three sluices are in frame, left to right.
    const gates = SLUICES.map((line) => seenAt(cam(7), 1.6, line[0].x, DAM.y, 40));
    for (const g of gates) expect(g.k).toBeGreaterThan(0.9);
    expect(gates[0].pan).toBeLessThan(gates[1].pan);
    expect(gates[1].pan).toBeLessThan(gates[2].pan);
    // The dam is seen from downstream, looking back: the columns stand far behind it, in frame but much further off than from their own station.
    for (const x of COLS.xs) expect(seenAt(cam(7), 1.6, x, COLS.y, 0).far).toBeGreaterThan(seenAt(cam(6), 1.6, x, COLS.y, 0).far * 1.5);
    // At their own station the columns, the lattice and both shards are in frame.
    for (const x of COLS.xs) expect(seenAt(cam(6), 1.6, x, COLS.y, 0).k).toBeGreaterThan(0.9);
    expect(seenAt(cam(8), 1.6, LATTICE.x, LATTICE.y, 0).k).toBeGreaterThan(0.9);
    for (const sh of SHARDS) expect(seenAt(cam(5), 1.6, sh.x, sh.y, sh.h / 2).k).toBeGreaterThan(0.9);
    // The lattice is near from its own station. At the dam the eye stands over it looking back upstream: it is under the lens, out of frame, and not heard.
    expect(seenAt(cam(8), 1.6, LATTICE.x, LATTICE.y, 0).far).toBeLessThan(1500);
    expect(seenAt(cam(7), 1.6, LATTICE.x, LATTICE.y, 0).k).toBe(0);
    expect(seenAt(null, 1.6, 0, 0, 0).k).toBe(0);
  });

  it('the movements follow the flight in order', () => {
    const [, say, , , , bridge, models, , , canyon, delta] = sectionStarts();
    expect(movementAt(true, 0, 0, false)).toBe(MOVE.ice);
    expect(movementAt(true, 1, 0.5, false)).toBe(MOVE.melt);
    expect(movementAt(true, say + 1, 1, false)).toBe(MOVE.river);
    expect(movementAt(true, bridge + 1.2, 1, false)).toBe(MOVE.tarn);
    expect(movementAt(true, models + 1, 1, false)).toBe(MOVE.works);
    expect(movementAt(true, canyon + 1.5, 1, false)).toBe(MOVE.canyon);
    expect(movementAt(true, delta + 1, 1, false)).toBe(MOVE.delta);
    expect(movementAt(true, END_AT, 1, true)).toBe(MOVE.rest);
    expect(movementAt(false, 3, 1, false)).toBe(MOVE.page);
  });
});
