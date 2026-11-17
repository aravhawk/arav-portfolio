import { describe, expect, it } from 'vitest';
import { DAWN, GATE, LAP } from '@/water/moments';
import { W, WATER, arrivalIndex, arrivalOf, arrivalRay, arrivalTime, camN, chirpAt, chirpLen, crackVoice, dripVoice, dropVoice, gust, latticeAt, latticeTime, latticeVoice, mixOf, roomsOf, scrollN, seaAt, shardVoice, slapTime, surgeRing, swellAt, uiVoice, waterOf, windPanOf } from '@/audio/mapping';
import { APPROACH, type Scene, SceneReader, type Seen, type SignalsLike, groundAt, heard, movementAt, seenAt, wetUnder } from '@/audio/scene';
import { ARRIVAL, MOTIF, MOVE, PENTA } from '@/audio/theory';
import { END_AT, MELT, SETTLE_AT, basisOf, dayAt, flightKeys, poseAt, sectionStarts, stillStops } from '@/water/camera';
import { CANYON, COLS, DELTA, LAKE, LATTICE, SHARDS, SLUICES, STREAM, TARN } from '@/water/world';

const UNSEEN: Seen = { k: 0, pan: 0, far: 0 };
const NEAR: Seen = { k: 1, pan: 0, far: 300 };

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
  bank: 0,
  turn: 0,
  sky: 0,
  north: 0,
  aurora: 0,
  water: 0.3,
  near: 0.5,
  pan: 0,
  flow: 0.6,
  white: 0.1,
  ice: 0,
  sea: 0,
  basin: 0,
  pool: 0,
  tarn: 0,
  cols: 0,
  dam: 0,
  lattice: 0,
  canyon: 0,
  walls: 0,
  wallD: 75,
  approach: 0,
  move: MOVE.river,
  over: false,
  px: 0.5,
  pv: 0,
  far: 0,
  clock: 0,
  clockAt: 0,
  gate: [1, 0, 0],
  surge: [1, 0, 0],
  ray: 0,
  lift: 0,
  falls: [],
  spill: { ...UNSEEN, size: 0 },
  slab: UNSEEN,
  shallows: UNSEEN,
  sluice: UNSEEN,
  thread: UNSEEN,
  bend: UNSEEN,
  arms: [],
  cam: null,
  aspect: 1.6,
  ...over,
});

const pc = (m: number) => ((m % 12) + 12) % 12;
const GAIN = 0;
const RATE = 1;
const LO = 2;
const HI = 3;
const PAN = 6;
const NOISE = 8;
const NHI = 10;
const total = (sc: Scene, t = 0) => waterOf(sc, t).reduce((s, v) => s + v[GAIN], 0);

describe('the mix follows the scene', () => {
  it('keeps every level between nothing and full, whatever the scene', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ k: 1, pan: i / 3 - 1, far: 100, size: 1 }));
    const extremes: Partial<Scene>[] = [
      {},
      { over: true, far: 70, pv: 0 },
      { sv: 40, camV: 1e5, water: 1, near: 1, flow: 1, white: 1, ice: 1, sea: 1, pv: 50, over: true, far: 12, meltRate: 9, melt: 0.5, walls: 1, tarn: 1, surge: [0.5, 0.5, 0.5], dam: 1, basin: 1, pool: 1, cols: 1, lattice: 1, night: 1, sky: 1, north: 1, aurora: 1, bank: 1, turn: 5, falls: many, arms: many.slice(0, 5), spill: many[0], slab: NEAR, shallows: NEAR, sluice: NEAR, thread: NEAR, bend: NEAR, approach: 1, move: MOVE.approach },
      { home: false },
      { calm: true, sv: 9 },
    ];
    for (const e of extremes) {
      for (const t of [0, 3.7, 100.2]) {
        const m = mixOf(scene(e), t);
        for (const k of ['air', 'bass', 'wind', 'whistle', 'wake', 'echo', 'worldSend', 'aurora'] as const) {
          expect(m[k], k).toBeGreaterThanOrEqual(0);
          expect(m[k], k).toBeLessThanOrEqual(1);
        }
        expect(m.bed).toBeGreaterThan(0);
        expect(m.bed).toBeLessThanOrEqual(1.25);
        for (const k of ['windPan', 'wakePan'] as const) expect(Math.abs(m[k]), k).toBeLessThanOrEqual(1);
        for (const k of ['bedCut', 'windHz', 'wakeHz', 'worldCut'] as const) {
          expect(m[k], k).toBeGreaterThan(60);
          expect(m[k], k).toBeLessThanOrEqual(20000);
        }
        expect(m.water).toHaveLength(20);
        for (const v of m.water) {
          expect(v).toHaveLength(11);
          expect(v[GAIN]).toBeGreaterThanOrEqual(0);
          expect(v[GAIN]).toBeLessThanOrEqual(1);
          expect(v[RATE]).toBeGreaterThanOrEqual(0);
          expect(v[RATE]).toBeLessThan(700);
          expect(v[LO]).toBeGreaterThan(100);
          expect(v[HI]).toBeGreaterThan(v[LO]);
          expect(v[HI]).toBeLessThan(12000);
          expect(Math.abs(v[PAN])).toBeLessThanOrEqual(1);
          expect(v[NOISE]).toBeGreaterThanOrEqual(0);
          expect(v[NOISE]).toBeLessThanOrEqual(8);
          expect(v[NHI]).toBeGreaterThan(v[9]);
        }
        expect(m.rooms.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
        for (const r of m.rooms) expect(r).toBeGreaterThanOrEqual(0);
        expect(m.echoTime).toBeGreaterThanOrEqual(0.04);
        expect(m.echoTime).toBeLessThanOrEqual(0.24);
        expect(m.shimmer).toHaveLength(5);
        for (const [g, p] of m.shimmer) {
          expect(g).toBeGreaterThanOrEqual(0);
          expect(g).toBeLessThanOrEqual(1);
          expect(Math.abs(p)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('the four kinds of water are four different askings of one model', () => {
    expect(WATER.pool[RATE]).toBeLessThan(1);
    expect(WATER.trickle[RATE]).toBeLessThan(WATER.stream[RATE] / 4);
    expect(WATER.stream[RATE]).toBeLessThan(WATER.fall[RATE]);
    expect(WATER.trickle[NOISE]).toBeLessThan(WATER.stream[NOISE]);
    expect(WATER.stream[NOISE]).toBeLessThan(WATER.fall[NOISE]);
    expect(WATER.pool[NOISE]).toBe(0);
    // A trickle is small bubbles only; a fall has large ones among them; a pool's are large and low.
    expect(WATER.trickle[LO]).toBeGreaterThan(WATER.stream[LO]);
    expect(WATER.fall[LO]).toBeLessThan(WATER.stream[LO]);
    expect(WATER.pool[HI]).toBeLessThan(WATER.trickle[LO]);
  });

  it('the river: more of it in frame, nearer, and faster is louder; it sits on the side it is seen on', () => {
    const s = (o: Partial<Scene>) => waterOf(scene(o), 0)[W.stream];
    expect(s({ water: 0.5 })[GAIN]).toBeGreaterThan(s({ water: 0.1 })[GAIN]);
    expect(s({ near: 0.9 })[GAIN]).toBeGreaterThan(s({ near: 0.2 })[GAIN]);
    expect(s({ flow: 1 })[GAIN]).toBeGreaterThan(s({ flow: 0.1 })[GAIN]);
    expect(s({ water: 0 })[GAIN]).toBe(0);
    expect(s({ pan: 0.6 })[PAN]).toBeGreaterThan(0.3);
    expect(s({ pan: -0.6 })[PAN]).toBeLessThan(-0.3);
    // Nearer water is brighter and has larger bubbles in it; faster water and a moving page mean more of them.
    expect(s({ near: 0.9 })[HI]).toBeGreaterThan(s({ near: 0.2 })[HI]);
    expect(s({ near: 0.9 })[LO]).toBeLessThan(s({ near: 0.2 })[LO]);
    expect(s({ flow: 1 })[RATE]).toBeGreaterThan(s({ flow: 0.2 })[RATE]);
    expect(s({ sv: 2 })[RATE]).toBeGreaterThan(s({ sv: 0 })[RATE]);
    // Away from the flight the only water heard is what the pointer turns over.
    expect(total(scene({ home: false }))).toBe(0);
    const inner = waterOf(scene({ home: false, over: true, far: 30, pv: 2 }), 0);
    expect(inner[W.wake][GAIN]).toBeGreaterThan(0.2);
    expect(inner.reduce((a, v) => a + v[GAIN], 0)).toBe(inner[W.wake][GAIN]);
  });

  it('white water follows the white in frame, the scroll and the camera', () => {
    const w = (o: Partial<Scene>) => waterOf(scene({ white: 0, ...o }), 0)[W.white][GAIN];
    expect(w({ white: 0.8 })).toBeGreaterThan(w({}));
    expect(w({ sv: 2 })).toBeGreaterThan(w({}));
    expect(w({ camV: 2000 })).toBeGreaterThan(w({}));
    expect(w({})).toBe(0);
  });

  it('the confluence: one fall to a stream, panned to it and sized by it', () => {
    const falls = [-0.8, -0.3, 0.1, 0.5, 0.9].map((pan, i) => ({ k: 1, pan, far: 400, size: 1 - i * 0.2 }));
    const v = waterOf(scene({ falls }), 0);
    for (let i = 0; i < 5; i++) {
      expect(v[W.falls + i][GAIN]).toBeGreaterThan(0);
      if (i) {
        expect(v[W.falls + i][PAN]).toBeGreaterThan(v[W.falls + i - 1][PAN]);
        // The smaller stream is quieter, thinner and higher.
        expect(v[W.falls + i][GAIN]).toBeLessThan(v[W.falls + i - 1][GAIN]);
        expect(v[W.falls + i][RATE]).toBeLessThan(v[W.falls + i - 1][RATE]);
        expect(v[W.falls + i][LO]).toBeGreaterThan(v[W.falls + i - 1][LO]);
        expect(v[W.falls + i][NOISE]).toBeLessThan(v[W.falls + i - 1][NOISE]);
      }
      // (Each sits at its own place: its bubbles are not spread across the field.)
      expect(v[W.falls + i][7]).toBeLessThan(0.2);
    }
    // A stream out of frame is not heard, and a far one is softer.
    expect(waterOf(scene({ falls: [{ k: 0, pan: 0, far: 400, size: 1 }] }), 0)[W.falls][GAIN]).toBe(0);
    expect(waterOf(scene({ falls: [{ k: 1, pan: 0, far: 3000, size: 1 }] }), 0)[W.falls][GAIN]).toBeLessThan(v[W.falls][GAIN]);
  });

  it('the still pool has one spill and the lattice one thread: a trickle, where it enters', () => {
    const spill = waterOf(scene({ pool: 0.6, spill: { k: 1, pan: -0.5, far: 300, size: 0.3 } }), 0)[W.thin];
    expect(spill[GAIN]).toBeGreaterThan(0.1);
    expect(spill[PAN]).toBeLessThan(-0.3);
    expect(spill[RATE]).toBeLessThan(40);
    expect(spill[NOISE]).toBeLessThan(0.05);
    const thread = waterOf(scene({ lattice: 1, thread: { k: 1, pan: 0.4, far: 300 } }), 0)[W.thin];
    expect(thread[GAIN]).toBeGreaterThan(0.1);
    expect(thread[PAN]).toBeGreaterThan(0.2);
    // The thread is thinner and higher than the spill.
    expect(thread[RATE]).toBeLessThan(spill[RATE]);
    expect(thread[LO]).toBeGreaterThan(spill[LO]);
  });

  it('the tarn is nearly silent', () => {
    const river = scene();
    const tarn = scene({ tarn: 1, flow: 0.02, white: 0, water: 0.9 });
    // What is heard is bubbles and the water's body: at the tarn, next to none of either.
    const heardOf = (sc: Scene) => waterOf(sc, 0).reduce((s, v) => s + v[GAIN] * (v[RATE] + 300 * v[NOISE]), 0);
    expect(heardOf(tarn)).toBeLessThan(heardOf(river) * 0.01);
    expect(total(tarn)).toBeLessThan(total(river));
    const v = waterOf(tarn, 0);
    expect(v[W.stream][GAIN]).toBeLessThan(0.02);
    expect(v[W.white][GAIN]).toBeLessThan(0.02);
    // What is left is a bubble now and then.
    expect(v[W.lap][RATE]).toBeLessThan(1);
    expect(v[W.lap][NOISE]).toBe(0);
    expect(mixOf(tarn, 0).wind).toBeLessThan(mixOf(river, 0).wind * 0.4);
  });

  it('the basin laps at its block and the shallows at the columns', () => {
    const basin = waterOf(scene({ basin: 0.8, slab: { k: 1, pan: 0.3, far: 400 } }), 0)[W.lap];
    expect(basin[GAIN]).toBeGreaterThan(0.2);
    expect(basin[PAN]).toBeGreaterThan(0);
    const cols = waterOf(scene({ cols: 1, shallows: { k: 1, pan: -0.3, far: 400 } }), 0)[W.lap];
    expect(cols[GAIN]).toBeGreaterThan(0.2);
    expect(cols[RATE]).toBeLessThan(basin[RATE]);
  });

  it('the open sluice rushes, and swells as the surge runs down the channel', () => {
    const at = (g: number) => waterOf(scene({ water: 0, dam: 1, sluice: NEAR, gate: [0, 1, 0], surge: [0, g, 0] }), 0)[W.sluice][GAIN];
    // The surge is a swell: least as it sets out, most half way down, settled when it has passed.
    expect(at(0.5)).toBeGreaterThan(at(0.05));
    expect(at(0.5)).toBeGreaterThan(at(0.95));
    expect(at(1)).toBeGreaterThan(0);
    expect(waterOf(scene({ dam: 1, sluice: UNSEEN, gate: [0, 1, 0], surge: [0, 0.5, 0] }), 0)[W.sluice][GAIN]).toBe(0);
    expect(waterOf(scene({ dam: 0, sluice: NEAR, gate: [0, 1, 0], surge: [0, 0.5, 0] }), 0)[W.sluice][GAIN]).toBe(0);
  });

  it('the canyon: fast water against the wall, dark, and a slap whose time follows how far off the wall stands', () => {
    const wall = waterOf(scene({ walls: 1, bend: NEAR }), 0)[W.wall];
    expect(wall[GAIN]).toBeGreaterThan(0.2);
    expect(wall[HI]).toBeLessThan(waterOf(scene(), 0)[W.stream][HI]);
    expect(wall[NOISE]).toBeGreaterThan(0.8);
    expect(waterOf(scene({ walls: 0, bend: NEAR }), 0)[W.wall][GAIN]).toBe(0);
    expect(slapTime(70)).toBeGreaterThan(slapTime(20));
    expect(slapTime(0)).toBe(0.04);
    expect(slapTime(1e4)).toBe(0.24);
    expect(mixOf(scene({ walls: 1, wallD: 60 }), 0).echoTime).toBeCloseTo(slapTime(60), 9);
  });

  it('the delta is many small channels, each its own size in its own place', () => {
    const arms = [-0.7, -0.2, 0.2, 0.5, 0.8].map((pan, i) => ({ k: 1, pan, far: 500, size: [1, 0.4, 0.9, 0.3, 0.6][i] }));
    const v = waterOf(scene({ arms }), 0).slice(W.arms, W.arms + 5);
    for (let i = 0; i < 5; i++) {
      expect(v[i][GAIN]).toBeGreaterThan(0);
      if (i) expect(v[i][PAN]).toBeGreaterThan(v[i - 1][PAN]);
      // Small water: trickles and little streams, never a fall.
      expect(v[i][RATE]).toBeLessThan(100);
    }
    expect(new Set(v.map((x) => Math.round(x[LO]))).size).toBe(5);
    expect(v[0][RATE]).toBeGreaterThan(v[1][RATE]);
  });

  it('the sea is a swell, and its waves are not all the same length', () => {
    const sea = (t: number) => waterOf(scene({ sea: 1, water: 1, rest: true, flow: 0.18 }), t)[W.sea];
    const levels = Array.from({ length: 400 }, (_, i) => sea(i * 0.25)[GAIN]);
    // It never stops, and it rises to more than twice its rest.
    expect(Math.min(...levels)).toBeGreaterThan(0.02);
    expect(Math.max(...levels)).toBeGreaterThan(Math.min(...levels) * 2.2);
    // It is nearly all body, low; the fizz comes as a wave draws back.
    expect(sea(3)[NOISE]).toBeGreaterThan(3);
    // Crests, and the time from each to the next.
    const crests: number[] = [];
    let prev = seaAt(0).level;
    let rising = false;
    for (let t = 0.01; t < 400; t += 0.01) {
      const l = seaAt(t).level;
      if (rising && l < prev) crests.push(t);
      rising = l > prev;
      prev = l;
    }
    const gaps = crests.slice(1).map((c, i) => c - crests[i]);
    expect(gaps.length).toBeGreaterThan(25);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(4);
    // No two waves in a row the same length, to a tenth of a second.
    for (let i = 1; i < gaps.length; i++) expect(Math.abs(gaps[i] - gaps[i - 1])).toBeGreaterThan(0.05);
    // And each comes in on its own side.
    const sides = new Set(Array.from({ length: 60 }, (_, i) => Math.sign(Math.round(seaAt(i * 7.3).side * 5))));
    expect(sides.size).toBe(3);
  });

  it('a swell train never repeats and never leaves its range', () => {
    for (let t = 0; t < 600; t += 0.37) {
      const s = swellAt(t, 9.5, 3);
      expect(s.level).toBeGreaterThanOrEqual(0);
      expect(s.level).toBeLessThanOrEqual(1);
      expect(s.wash).toBeGreaterThanOrEqual(0);
      expect(s.wash).toBeLessThanOrEqual(1);
      expect(Math.abs(s.side)).toBeLessThanOrEqual(1);
      expect(gust(t, false)).toBeGreaterThan(0.6);
      expect(gust(t, false)).toBeLessThanOrEqual(1);
    }
    // The same moment is the same; another seed is another train.
    expect(swellAt(41.3, 9.5, 3)).toEqual(swellAt(41.3, 9.5, 3));
    expect(swellAt(41.3, 9.5, 3).level).not.toBe(swellAt(41.3, 9.5, 4).level);
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

  it('the wind moves across the field with the camera’s bank and against its turn', () => {
    expect(windPanOf(scene({ bank: 0.5 }), 0)).toBeLessThan(-0.3);
    expect(windPanOf(scene({ bank: -0.5 }), 0)).toBeGreaterThan(0.3);
    expect(windPanOf(scene({ turn: 0.5 }), 0)).toBeLessThan(windPanOf(scene({ turn: -0.5 }), 0));
    expect(Math.abs(windPanOf(scene({ bank: 1, turn: 3 }), 0))).toBeLessThanOrEqual(0.85);
    expect(windPanOf(scene({ bank: 1, calm: true }), 0)).toBe(0);
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

  it('three rooms, cross-faded with the place', () => {
    expect(roomsOf(scene())).toEqual([1, 0, 0]);
    expect(roomsOf(scene({ walls: 1 }))).toEqual([0, 1, 0]);
    expect(roomsOf(scene({ tarn: 1 }))).toEqual([0, 0, 1]);
    const pool = roomsOf(scene({ pool: 0.75 }));
    expect(pool[2]).toBeCloseTo(0.6, 6);
    expect(pool[0]).toBeCloseTo(0.4, 6);
    const between = roomsOf(scene({ walls: 0.5, tarn: 0.4 }));
    expect(between[0] + between[1] + between[2]).toBeCloseTo(1, 9);
    expect(between[1]).toBe(0.5);
    // An inner page sits in a little of the open room and a little of the still one.
    expect(roomsOf(scene({ home: false }))).toEqual([0.6, 0, 0.4]);
  });

  it('the bed is brighter by day than before dawn, brighter as the ice goes, has no bass until there is water, and leans in on the run out to sea', () => {
    expect(mixOf(scene({ night: 0 }), 0).bedCut).toBeGreaterThan(mixOf(scene({ night: 1 }), 0).bedCut);
    expect(mixOf(scene({ melt: 1 }), 0).bedCut).toBeGreaterThan(mixOf(scene({ melt: 0, ice: 1 }), 0).bedCut);
    expect(mixOf(scene({ melt: 0 }), 0).bass).toBe(0);
    expect(mixOf(scene({ melt: 1 }), 0).bass).toBe(1);
    expect(mixOf(scene({ home: false }), 0).bed).toBeLessThan(mixOf(scene(), 0).bed);
    expect(mixOf(scene({ move: MOVE.approach, approach: 1 }), 0).bed).toBeGreaterThan(mixOf(scene({ move: MOVE.approach, approach: 0 }), 0).bed);
    expect(mixOf(scene({ move: MOVE.delta, approach: 1 }), 0).bed).toBe(1);
  });

  it('the two themes are two mixes: before dawn the wind is steadier and lower, the water darker and closer', () => {
    const day = mixOf(scene({ ice: 1 }), 0);
    const dark = mixOf(scene({ ice: 1, night: 1 }), 0);
    expect(dark.windHz).toBeLessThan(day.windHz * 0.8);
    expect(dark.whistle).toBeLessThan(day.whistle);
    expect(dark.worldSend).toBeLessThan(day.worldSend);
    expect(dark.water[W.stream][HI]).toBeLessThan(day.water[W.stream][HI]);
    expect(dark.water[W.stream][GAIN]).toBeGreaterThan(day.water[W.stream][GAIN]);
    // Steadier: over ten minutes the gusts move the wind less.
    const span = (night: number) => {
      const g = Array.from({ length: 600 }, (_, i) => gust(i, false, night));
      return Math.max(...g) - Math.min(...g);
    };
    expect(span(1)).toBeLessThan(span(0) * 0.6);
    // Half way through the turn it is half way between.
    const mid = mixOf(scene({ ice: 1, night: 0.5 }), 0);
    expect(mid.windHz).toBeCloseTo((day.windHz + dark.windHz) / 2, 6);
  });

  it('the aurora has a voice only before dawn, while the hour has it and the lens is on the sky; its partials move with the picture’s clock', () => {
    const on = { night: 1, aurora: 1, sky: 1, north: 1 };
    expect(mixOf(scene(on), 0).aurora).toBeGreaterThan(0.9);
    expect(mixOf(scene({ ...on, night: 0 }), 0).aurora).toBe(0);
    expect(mixOf(scene({ ...on, aurora: 0 }), 0).aurora).toBe(0);
    expect(mixOf(scene({ ...on, sky: 0, north: 0 }), 0).aurora).toBeLessThan(0.15);
    expect(mixOf(scene({ ...on, home: false }), 0).aurora).toBe(0);
    const a = mixOf(scene({ ...on, clock: 10 }), 0).shimmer;
    const b = mixOf(scene({ ...on, clock: 14 }), 0).shimmer;
    expect(a).not.toEqual(b);
    // (The sound's own time does not move them: only the picture's clock does.)
    expect(mixOf(scene({ ...on, clock: 10 }), 99).shimmer).toEqual(a);
    expect(new Set(a.map(([g]) => g.toFixed(3))).size).toBeGreaterThan(3);
  });

  it('the ice cracks as fast as it melts, and not at all when it is whole, gone, or held still', () => {
    expect(mixOf(scene({ melt: 0.3, meltRate: 0 }), 0).cracks).toBe(0);
    expect(mixOf(scene({ melt: 0.3, meltRate: 0.2 }), 0).cracks).toBeGreaterThan(mixOf(scene({ melt: 0.3, meltRate: 0.05 }), 0).cracks);
    expect(mixOf(scene({ melt: 0, meltRate: 0.3 }), 0).cracks).toBe(0);
    // The first frames of the melt already crack.
    expect(mixOf(scene({ melt: 0.01, meltRate: 0.3 }), 0).cracks).toBeGreaterThan(0);
    expect(mixOf(scene({ melt: 0.99, meltRate: 0.3 }), 0).cracks).toBe(0);
    expect(mixOf(scene({ melt: 0.3, meltRate: 0.3, calm: true }), 0).cracks).toBe(0);
    expect(mixOf(scene({ melt: 0, ice: 1 }), 0).groans).toBeGreaterThan(0);
    expect(mixOf(scene({ melt: 1, ice: 0 }), 0).groans).toBe(0);
  });

  it('the pointer’s wake: only over water, more bubbles and brighter when faster, softer when farther, placed where the pointer is', () => {
    const w = (o: Partial<Scene>) => waterOf(scene({ over: true, far: 20, ...o }), 0)[W.wake];
    expect(w({ over: false, pv: 2 })[GAIN]).toBe(0);
    expect(w({ pv: 0 })[GAIN]).toBe(0);
    expect(w({ pv: 2 })[GAIN]).toBeGreaterThan(w({ pv: 0.5 })[GAIN]);
    expect(w({ pv: 2 })[RATE]).toBeGreaterThan(w({ pv: 0.5 })[RATE]);
    expect(w({ pv: 2 })[HI]).toBeGreaterThan(w({ pv: 0.5 })[HI]);
    expect(w({ pv: 2, far: 70 })[GAIN]).toBeLessThan(w({ pv: 2, far: 12 })[GAIN]);
    expect(w({ pv: 2, px: 0.1 })[PAN]).toBeLessThan(-0.4);
    expect(w({ pv: 2, px: 0.9 })[PAN]).toBeGreaterThan(0.4);
    expect(mixOf(scene({ over: true, far: 20, pv: 2 }), 0).wake).toBeGreaterThan(0);
  });

  it('reduced motion calms what motion drives, and leaves the bed alone', () => {
    expect(scrollN(2.5, true)).toBeCloseTo(0.3, 6);
    expect(camN(2400, true)).toBeCloseTo(0.3, 6);
    const moving = { sv: 3, camV: 3000 };
    expect(mixOf(scene({ ...moving, calm: true }), 0).wind).toBeLessThan(mixOf(scene(moving), 0).wind);
    expect(mixOf(scene({ calm: true }), 0).bed).toBe(mixOf(scene(), 0).bed);
    expect(mixOf(scene({ calm: true }), 0).bedCut).toBe(mixOf(scene(), 0).bedCut);
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

  it('a crack is drawn out by the sheet: the further it has come, the longer its fall; the snap is heard only from near, the body only under a big one', () => {
    const near = crackVoice(0.5, 200, 0.6);
    const far = crackVoice(0.5, 5000, 0.6);
    expect(crackVoice(0.1, 800, 0.5).pan).toBeLessThan(-0.5);
    expect(crackVoice(0.9, 800, 0.5).pan).toBeGreaterThan(0.5);
    expect(far.disp).toBeGreaterThan(near.disp * 4);
    expect(chirpLen(far.disp, far.top, far.foot)).toBeGreaterThan(chirpLen(near.disp, near.top, near.foot) * 3);
    // Near, a ping of some tens of milliseconds; far, a call of a few tenths of a second.
    expect(chirpLen(near.disp, near.top, near.foot)).toBeLessThan(0.09);
    expect(chirpLen(far.disp, far.top, far.foot)).toBeGreaterThan(0.25);
    expect(chirpLen(far.disp, far.top, far.foot)).toBeLessThan(1);
    expect(far.top).toBeLessThan(near.top);
    expect(far.send).toBeGreaterThan(near.send);
    expect(far.gain).toBeLessThan(near.gain);
    expect(near.tick).toBeGreaterThan(0.5);
    expect(far.tick).toBe(0);
    expect(crackVoice(0.5, 800, 0.3).body).toBe(0);
    expect(crackVoice(0.5, 800, 0.95).body).toBeGreaterThan(0.5);
    // A big one sings lower.
    expect(crackVoice(0.5, 800, 1).foot).toBeLessThan(crackVoice(0.5, 800, 0.1).foot);
    // A whole sheet answers from its far shore; floes do not.
    expect(crackVoice(0.5, 3000, 0.8, 0.1).echo).toBeGreaterThan(0.4);
    expect(crackVoice(0.5, 3000, 0.8, 0.95).echo).toBe(0);
    expect(crackVoice(0.5, 3000, 0.8, 0.95).disp).toBeLessThan(crackVoice(0.5, 3000, 0.8, 0.1).disp);
  });

  it('the chirp falls: its top arrives first and the rest follows, steeply and then slowly', () => {
    const { disp, top, foot } = crackVoice(0.5, 2500, 0.7);
    expect(chirpAt(0, disp, top)).toBeCloseTo(top, 6);
    const len = chirpLen(disp, top, foot);
    expect(chirpAt(len, disp, top)).toBeCloseTo(foot, 6);
    let last = Infinity;
    for (let i = 0; i <= 20; i++) {
      const f = chirpAt((len * i) / 20, disp, top);
      expect(f).toBeLessThan(last);
      last = f;
    }
    // More of the fall happens in its first fifth than in its last half.
    expect(top - chirpAt(len / 5, disp, top)).toBeGreaterThan(chirpAt(len / 2, disp, top) - foot);
  });

  it('the shards, the lattice, the drips and the controls', () => {
    expect([shardVoice(0, 0, 0, 0).midi, shardVoice(0, 1, 0, 0).midi, shardVoice(1, 0, 0, 0).midi, shardVoice(1, 1, 0, 0).midi, shardVoice(2, 0, 0, 0).midi]).toEqual(MOTIF);
    expect(shardVoice(0, 0, -0.5, 0).pan).toBeLessThan(0);
    expect(shardVoice(0, 1, 0.5, 0).pan).toBeGreaterThan(0);
    expect(shardVoice(0, 0, 0, 1).cut).toBeLessThan(shardVoice(0, 0, 0, 0).cut);
    expect(latticeVoice(2, 3, 0).midi).toBeGreaterThan(latticeVoice(0, 0, 0).midi);
    // A tall column drips lower and fuller than a short one.
    expect(dripVoice(1, 0).midi).toBeLessThan(dripVoice(0.1, 0).midi);
    expect(dripVoice(1, 0).gain).toBeGreaterThan(dripVoice(0.1, 0).gain);
    // The nav plays left to right, and a press is the hover's note an octave down.
    expect(uiVoice('hover', 0.9).midi).toBeGreaterThan(uiVoice('hover', 0.1).midi);
    expect(uiVoice('hover', 0.5).midi - uiVoice('tap', 0.5).midi).toBe(12);
    for (const x of [0, 0.3, 0.6, 1]) expect(PENTA).toContain(pc(uiVoice('hover', x).midi));
  });

  it('the arrival: the swell rises with the sun’s lift and lets go after it; each chord comes as the light reaches its place, at a time known ahead', () => {
    expect(arrivalOf(0, 0)).toBe(0);
    expect(arrivalOf(0.5, 0)).toBeGreaterThan(0.3);
    expect(arrivalOf(1, 0)).toBe(1);
    expect(arrivalOf(1, 6)).toBeLessThan(0.4);
    expect(arrivalOf(1, 60)).toBeLessThan(0.001);
    expect(arrivalIndex(0)).toBe(-1);
    let last = -1;
    for (let ray = 0.005; ray <= 1; ray += 0.005) {
      const i = arrivalIndex(ray);
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
    }
    expect(last).toBe(ARRIVAL.length - 1);
    // The time each is set for is the time the picture's own easing brings the light there.
    const smooth = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    let before = 0;
    for (let i = 0; i < ARRIVAL.length; i++) {
      const t = arrivalTime(i);
      expect(t).toBeGreaterThan(before);
      before = t;
      expect(t).toBeGreaterThanOrEqual(DAWN.ray[0]);
      expect(t).toBeLessThanOrEqual(DAWN.ray[1]);
      expect(smooth(DAWN.ray[0], DAWN.ray[1], t)).toBeCloseTo(arrivalRay(i), 6);
      expect(arrivalIndex(smooth(DAWN.ray[0], DAWN.ray[1], t + 0.001))).toBe(i);
    }
  });

  it('the lattice’s light: sixteen cubes in order each lap, at times known ahead, four to a row a third of a second apart', () => {
    const times: number[] = [];
    let seen = -1;
    for (let t = 0; t < LAP; t += 0.005) {
      const { cube, lap } = latticeAt(t, LATTICE.pitch);
      expect(lap).toBe(0);
      if (cube > seen) {
        expect(cube).toBe(seen + 1);
        seen = cube;
        times.push(t);
        expect(t - latticeTime(cube, LATTICE.pitch)).toBeGreaterThanOrEqual(0);
        expect(t - latticeTime(cube, LATTICE.pitch)).toBeLessThan(0.006);
      }
    }
    expect(seen).toBe(15);
    // Within a row the light takes pitch / speed from cube to cube.
    const run = Math.hypot(2 * LATTICE.pitch, 110) * 2 + 3 * (4 * LATTICE.pitch + (Math.PI * LATTICE.pitch) / 2) + 4 * LATTICE.pitch + 500;
    const stepT = LATTICE.pitch / (run / LAP);
    expect(times[1] - times[0]).toBeCloseTo(stepT, 1);
    expect(times[4] - times[3]).toBeGreaterThan(stepT * 2);
    expect(latticeAt(LAP + 0.2, LATTICE.pitch).lap).toBe(1);
  });

  it('the surge throws its rings at times known ahead, the last as its head meets the pool', () => {
    expect(surgeRing(10, GATE.rings)).toBeCloseTo(10 + GATE.surge, 9);
    for (let k = 2; k <= GATE.rings; k++) expect(surgeRing(10, k) - surgeRing(10, k - 1)).toBeCloseTo(GATE.surge / GATE.rings, 9);
  });
});

describe('the scene is read from what the picture publishes', () => {
  const sig = (s: number, at: number, more: Partial<SignalsLike> = {}): SignalsLike => {
    const cam = basisOf(poseAt(flightKeys(1.6), s));
    return { at, s, cam, aspect: 1.6, melt: (s - MELT.from) / (MELT.to - MELT.from), day: dayAt(s), rest: s >= SETTLE_AT - 0.02, clock: at / 1000, clockAt: at, tribs: null, st: [0, 0, 0, 0], gate: [1, 0, 0], surge: [1, 0, 0], ray: 0, lift: 0, px: 0.5, py: 0.5, far: 0, moved: -1e9, scrollY: 0, ...more };
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
    expect(sc.over).toBe(false);
    // There the picture's own bed says whether the pointer is over water.
    expect(new SceneReader().read({ ...none, far: 30, moved: 4990 }, 5000, env).over).toBe(true);
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
    const gates = SLUICES.map((line) => seenAt(cam(7), 1.6, line[0].x, line[0].y, 40));
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
    const [, say, , , , bridge, models, , , canyon, delta, sea] = sectionStarts();
    expect(movementAt(true, 0, 0, false)).toBe(MOVE.ice);
    expect(movementAt(true, 1, 0.5, false)).toBe(MOVE.melt);
    expect(movementAt(true, say + 1, 1, false)).toBe(MOVE.river);
    expect(movementAt(true, bridge + 1.2, 1, false)).toBe(MOVE.tarn);
    expect(movementAt(true, models + 1, 1, false)).toBe(MOVE.works);
    expect(movementAt(true, canyon + 1.5, 1, false)).toBe(MOVE.canyon);
    expect(movementAt(true, delta + 1, 1, false)).toBe(MOVE.delta);
    // The run out to sea begins before the sea's own section, and holds until the camera rests.
    expect(movementAt(true, sea - APPROACH + 0.01, 1, false)).toBe(MOVE.approach);
    expect(movementAt(true, SETTLE_AT - 0.1, 1, false)).toBe(MOVE.approach);
    expect(movementAt(true, END_AT, 1, true)).toBe(MOVE.rest);
    expect(movementAt(false, 3, 1, false)).toBe(MOVE.page);
  });

  it('each station’s own water stands where it is seen: the streams left to right, the spill, the block, the thread, the delta’s channels', () => {
    const stops = stillStops();
    const at = (i: number) => new SceneReader().read(sig(stops[i], 1000), 1000, env);
    // The confluence: seven streams, most of them in frame, each further right than the last one seen to its left.
    const conf = at(3);
    expect(conf.falls).toHaveLength(7);
    const inFrame = conf.falls.filter((f) => f.k > 0.5);
    expect(inFrame.length).toBeGreaterThanOrEqual(4);
    const pans = inFrame.map((f) => f.pan);
    expect(Math.max(...pans) - Math.min(...pans)).toBeGreaterThan(0.5);
    // The biggest stream is the first, and each is sized against it.
    expect(conf.falls[0].size).toBe(1);
    expect(conf.falls[6].size).toBeLessThan(0.3);
    // Published widths take over from the plan's.
    const live = new SceneReader().read(sig(stops[3], 1000, { tribs: [10, 10, 10, 10, 10, 10, 168] }), 1000, env);
    expect(live.falls[6].size).toBe(1);
    expect(live.falls[0].size).toBeLessThan(0.1);
    // The basin has its block and its water in frame; the pool its spill; the lattice its thread; the delta its channels.
    expect(at(2).basin).toBeGreaterThan(0.3);
    expect(heard(at(2).slab)).toBeGreaterThan(0.2);
    expect(at(4).pool).toBeGreaterThan(0.2);
    expect(at(8).thread.k + at(8).lattice).toBeGreaterThanOrEqual(0);
    expect(at(10).arms).toHaveLength(5);
    expect(at(10).arms.filter((a) => a.k > 0.5).length).toBeGreaterThanOrEqual(2);
    // None of it is heard from the frozen lake.
    const top = at(0);
    expect(Math.max(...top.falls.map(heard), heard(top.spill), ...top.arms.map(heard))).toBeLessThan(0.05);
    expect(waterOf(top, 0).reduce((s, v) => s + v[GAIN], 0)).toBe(0);
  });

  it('the camera’s bank and turn, the sky it sees, the wall it flies under, the run out to sea', () => {
    const [, , , , , , , , , canyon, , sea] = sectionStarts();
    const top = new SceneReader().read(sig(0, 1000), 1000, env);
    expect(top.sky).toBeGreaterThan(0);
    expect(top.north).toBeGreaterThan(0.5);
    expect(Math.abs(top.bank)).toBeLessThanOrEqual(1);
    // In the canyon the nearer wall is never further off than half the canyon's width.
    const inside = new SceneReader().read(sig(canyon + 1.2, 1000), 1000, env);
    expect(inside.wallD).toBeGreaterThan(0);
    expect(inside.wallD).toBeLessThanOrEqual(CANYON.w / 2);
    // Turning: the heading's change per second, smoothed. Through the canyon's bends the camera turns.
    const r = new SceneReader();
    let turned = 0;
    for (let i = 0; i <= 120; i++) turned = Math.max(turned, Math.abs(r.read(sig(canyon + 0.6 + i / 60, 1000 + i * 16.67), 1000 + i * 16.67, env).turn));
    expect(turned).toBeGreaterThan(0.05);
    expect(new SceneReader().read(sig(sea - APPROACH - 0.2, 1000), 1000, env).approach).toBe(0);
    expect(new SceneReader().read(sig(SETTLE_AT, 1000), 1000, env).approach).toBe(1);
    // The aurora belongs to the hour: it has gone by the ending's light.
    expect(top.aurora).toBeGreaterThan(0.9);
    expect(new SceneReader().read(sig(END_AT, 1000), 1000, env).aurora).toBeLessThan(0.2);
  });

  it('the theme turns over about a second, not in a frame', () => {
    const r = new SceneReader();
    expect(r.read(sig(3, 1000), 1000, env).night).toBe(0);
    const dark = { ...env, night: 1 };
    const a = r.read(sig(3, 1016.7), 1016.7, dark).night;
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(0.05);
    let n = a;
    for (let i = 2; i <= 100; i++) n = r.read(sig(3, 1000 + i * 16.67), 1000 + i * 16.67, dark).night;
    expect(n).toBe(1);
  });
});
