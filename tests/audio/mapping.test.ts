import { starts, composed } from '@/water/registry';
import { describe, expect, it } from 'vitest';
import { DAWN, GATE, LAP, RIBBON, stationsNear } from '@/water/moments';
import { ARRIVE_AT, BLOCK_EARS, BLOCK_MID, LIGHT, NAME_MELT, SHEET_BREAKS, SHIMMER_AT, W, WATER, arrivalOf, arrivalTime, bearingAt, blockSet, camN, climbTime, climbVoice, curtainAt, curtainsAt, gatherTime, gatherVoice, landings, lightPan, lineRun, lineTime, nameLetters, nameMelt, railVoice, ribbonHead, ribbonTime, sinkAt, sinkOrder, sinkVoice, unsmooth, chirpAt, chirpLen, crackVoice, dripVoice, dropVoice, gust, latticeAt, latticeTime, latticeVoice, mixOf, roomsOf, scrollN, seaAt, shardVoice, slapTime, surgeRing, swellAt, uiVoice, waterOf, windPanOf } from '@/audio/mapping';
import { APPROACH, type Scene, SceneReader, type Seen, type SignalsLike, groundAt, heard, movementAt, seenAt, wetUnder } from '@/audio/scene';
import { ARRIVAL, ARRIVAL_AT, CLIMB, GATHER, MOTIF, MOVE, PENTA } from '@/audio/theory';
import { END_AT, MELT, SETTLE_AT, basisOf, dayAt, endLens, flightKeys, heroDesign, poseAt, stillStops } from '@/water/camera';
import { CANYON, COLS, DELTA, LAKE, LATTICE, NAME, SHARDS, SLAB, SLUICES, STREAM, TARN } from '@/water/world';

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
  dawnAz: 0,
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
  jump: false,
  clock: 0,
  clockAt: 0,
  gate: [1, 0, 0],
  surge: [1, 0, 0],
  ray: 0,
  lift: 0,
  rise: 0,
  falls: [],
  spill: { ...UNSEEN, size: 0 },
  slab: UNSEEN,
  shallows: UNSEEN,
  sluice: UNSEEN,
  thread: UNSEEN,
  lanes: UNSEEN,
  bend: UNSEEN,
  arms: [],
  name: UNSEEN,
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

  it('thin water: the rock pool’s one brook where it leaves, and the lattice’s thread, which runs in at the pool’s head and along every lane', () => {
    const spill = waterOf(scene({ pool: 0.6, spill: { k: 1, pan: -0.5, far: 300, size: 0.3 } }), 0)[W.thin];
    expect(spill[GAIN]).toBeGreaterThan(0.1);
    expect(spill[PAN]).toBeLessThan(-0.3);
    expect(spill[RATE]).toBeLessThan(40);
    expect(spill[NOISE]).toBeLessThan(0.05);
    // The thread is heard between where it enters and the middle of the lattice, spread across the lanes it runs in.
    const thread = waterOf(scene({ lattice: 1, thread: { k: 1, pan: 0.6, far: 300 }, lanes: { k: 1, pan: 0.1, far: 500 } }), 0)[W.thin];
    expect(thread[GAIN]).toBeGreaterThan(0.1);
    expect(thread[PAN]).toBeGreaterThan(0.1);
    expect(thread[PAN]).toBeLessThan(0.6);
    expect(thread[7]).toBeGreaterThan(spill[7] * 3);
    // It is thinner and higher than the brook.
    expect(thread[RATE]).toBeLessThan(spill[RATE]);
    expect(thread[LO]).toBeGreaterThan(spill[LO]);
    // With the entry out of frame the lanes are still heard.
    expect(waterOf(scene({ lattice: 1, lanes: { k: 1, pan: 0.1, far: 500 } }), 0)[W.thin][GAIN]).toBeGreaterThan(0.1);
  });

  it('the meltwater at the name’s feet: none on the whole sheet, a few bubbles as it gathers, more as the ice under the blocks opens, gone once the lake is plates', () => {
    const name = { k: 1, pan: -0.2, far: 1700 };
    const at = (melt: number, more: Partial<Scene> = {}) => waterOf(scene({ melt, ice: 1 - melt, water: 0, name, ...more }), 0)[W.thin];
    expect(at(0)[GAIN]).toBe(0);
    expect(at(0.03)[GAIN]).toBe(0);
    expect(at(0.12)[GAIN]).toBeGreaterThan(0);
    expect(at(0.3)[GAIN]).toBeGreaterThan(at(0.12)[GAIN] * 3);
    expect(at(0.5)[GAIN]).toBeGreaterThan(at(0.3)[GAIN]);
    expect(at(0.5)[RATE]).toBeGreaterThan(at(0.12)[RATE] * 2);
    // (Lower as the hole opens: there is more water under each bubble.)
    expect(at(0.5)[LO]).toBeLessThan(at(0.12)[LO]);
    expect(at(0.85)[GAIN]).toBe(0);
    // It stands where the name does, across the letters, and is not there with the name out of frame or the page held still.
    expect(at(0.4)[PAN]).toBeLessThan(-0.1);
    expect(at(0.4)[7]).toBeGreaterThan(0.3);
    expect(at(0.4, { name: UNSEEN })[GAIN]).toBe(0);
    expect(at(0.4, { calm: true })[GAIN]).toBe(0);
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

  it('the basin laps at its block, louder while a set is running, and the shallows at the columns', () => {
    const basin = (clock: number) => waterOf(scene({ basin: 0.8, slab: { k: 1, pan: 0.3, far: 400 }, clock }), 0)[W.lap];
    expect(basin(0)[GAIN]).toBeGreaterThan(0.15);
    expect(basin(0)[PAN]).toBeGreaterThan(0);
    // (The sets come and go on the picture's clock, about every seventeen seconds.)
    const levels = Array.from({ length: 40 }, (_, i) => basin(i)[GAIN]);
    expect(Math.max(...levels)).toBeGreaterThan(Math.min(...levels) * 2);
    const hi = levels.indexOf(Math.max(...levels));
    expect(blockSet(BLOCK_MID, hi)).toBeGreaterThan(0.9);
    const cols = waterOf(scene({ cols: 1, shallows: { k: 1, pan: -0.3, far: 400 } }), 0)[W.lap];
    expect(cols[GAIN]).toBeGreaterThan(0.2);
    expect(cols[RATE]).toBeLessThan(basin(0)[RATE]);
  });

  it('the basin’s sea lands on the block in sets, each crest at a time known ahead, one end of the face before the other', () => {
    for (const ear of BLOCK_EARS) {
      const all = landings(ear.along, 0, 60);
      // A crest every three to five seconds, never two together, each inside the window asked about.
      expect(all.length).toBeGreaterThan(11);
      all.forEach((l, i) => {
        expect(l.tau).toBeGreaterThan(0);
        expect(l.tau).toBeLessThanOrEqual(60);
        if (i) expect(l.tau - all[i - 1].tau).toBeGreaterThan(2.5);
        if (i) expect(l.tau - all[i - 1].tau).toBeLessThan(5.6);
        if (i) expect(l.n).toBe(all[i - 1].n + 1);
        expect(l.hard).toBeGreaterThanOrEqual(0);
        expect(l.hard).toBeLessThanOrEqual(1);
      });
      // Sets: some crests land hard and some hardly at all.
      expect(Math.max(...all.map((l) => l.hard))).toBeGreaterThan(0.8);
      expect(Math.min(...all.map((l) => l.hard))).toBeLessThan(0.1);
      // Looked for a quarter of a second at a time, as the page does, the same crests are found, once each.
      const found: number[] = [];
      for (let t = 0; t < 60; t += 0.25) for (const l of landings(ear.along, t, t + 0.25)) found.push(l.tau);
      expect(found).toHaveLength(all.length);
      found.forEach((tau, i) => expect(tau).toBeCloseTo(all[i].tau, 4));
    }
    // The two ends of the face are not struck together.
    const a = landings(BLOCK_EARS[0].along, 0, 30).map((l) => l.tau);
    const b = landings(BLOCK_EARS[1].along, 0, 30).map((l) => l.tau);
    expect(Math.min(...a.map((t) => Math.min(...b.map((u) => Math.abs(u - t)))))).toBeGreaterThan(0.05);
    expect(BLOCK_EARS[0].x).toBeLessThan(0);
    expect(BLOCK_EARS[1].x).toBeGreaterThan(0);
    expect(Math.abs(BLOCK_EARS[0].x)).toBeLessThan(SLAB.w / 2);
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

  it('the aurora has a voice only before dawn, while the hour has it and there is sky in frame; it follows the curtains on the picture’s clock and thins from the top as first light grows', () => {
    const cam = basisOf(poseAt(flightKeys(1.6), 0));
    const on = { night: 1, aurora: 1, sky: 1, cam, dawnAz: 0.225 };
    expect(mixOf(scene(on), 0).aurora).toBeGreaterThan(0.9);
    expect(mixOf(scene({ ...on, night: 0 }), 0).aurora).toBe(0);
    expect(mixOf(scene({ ...on, aurora: 0 }), 0).aurora).toBe(0);
    expect(mixOf(scene({ ...on, sky: 0 }), 0).aurora).toBeLessThan(0.3);
    expect(mixOf(scene({ ...on, home: false }), 0).aurora).toBe(0);
    expect(mixOf(scene({ ...on, rest: true }), 0).aurora).toBe(0);
    const a = mixOf(scene({ ...on, clock: 10 }), 0).shimmer;
    const b = mixOf(scene({ ...on, clock: 14 }), 0).shimmer;
    expect(a).not.toEqual(b);
    // (The sound's own time does not move them: only the picture's clock does.)
    expect(mixOf(scene({ ...on, clock: 10 }), 99).shimmer).toEqual(a);
    // Each partial keeps its place across the frame and is as loud as the curtains are bright on that bearing.
    a.forEach(([g, pan], i) => {
      expect(pan).toBe(SHIMMER_AT[i]);
      expect(g).toBeCloseTo(curtainsAt(bearingAt(cam, 1.6, pan), 10, 0.225), 9);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    });
    // A length of curtain drifts along the sky: over five minutes every place has had it and has been without it.
    for (const az of [-0.5, 0, 0.5]) {
      const there = Array.from({ length: 300 }, (_, t) => curtainAt(0, az, t).there);
      expect(Math.max(...there)).toBeGreaterThan(0.9);
      expect(Math.min(...there)).toBeLessThan(0.1);
      // (Slowly: it does not come and go inside a second.)
      for (let t = 1; t < 300; t++) expect(Math.abs(there[t] - there[t - 1])).toBeLessThan(0.2);
    }
    // The ripple along a border comes round every 2 pi / 0.5 seconds at a place, and runs along the sky.
    expect(curtainAt(0, 0.2, 0).ripple).toBeCloseTo(curtainAt(0, 0.2, (2 * Math.PI) / 0.5).ripple, 6);
    expect(curtainAt(0, 0.2, 3).ripple).toBeCloseTo(curtainAt(0, 0.2 + (0.5 * 3) / 14, 6).ripple, 6);
    // Nothing of it toward the first light.
    expect(curtainsAt(0.225, 10, 0.225)).toBeLessThan(0.16);
    // As the first light grows the hour has less of it, and it thins from the top: the highest partial goes first.
    const full = mixOf(scene({ ...on, clock: 40 }), 0);
    const thin = mixOf(scene({ ...on, clock: 40, aurora: 0.8 }), 0);
    expect(thin.aurora).toBeLessThanOrEqual(full.aurora);
    full.shimmer.forEach(([g], i) => {
      if (g <= 0) return;
      const left = thin.shimmer[i][0] / g;
      expect(left).toBeCloseTo(Math.max(0, 1 - 0.2 * (1 + 0.9 * i)), 6);
    });
    expect(mixOf(scene({ ...on, clock: 40, aurora: 0.4 }), 0).shimmer.slice(1).every(([g]) => g === 0)).toBe(true);
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

  it('the ending’s light, as the shading pass draws it: the line runs out from the foot of the frame to the far shore, then the ribbon climbs from the water out of the top of the frame', () => {
    const smooth = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    for (const y of [0, 0.04, 0.3, 0.5, 0.77, 1]) expect(smooth(0, 1, unsmooth(y))).toBeCloseTo(y, 9);
    // The line: nowhere at the dawn, at the far shore before `ray` has run its share, and never back.
    expect(lineRun(0)).toBe(0);
    expect(lineRun(LIGHT.run)).toBe(1);
    let was = 0;
    for (let ray = 0; ray <= 1; ray += 0.01) {
      expect(lineRun(ray)).toBeGreaterThanOrEqual(was);
      was = lineRun(ray);
    }
    for (const p of [0.05, 0.3, 0.6, 0.95]) expect(lineRun(smooth(DAWN.ray[0], DAWN.ray[1], lineTime(p)))).toBeCloseTo(p, 6);
    expect(lineTime(0)).toBeCloseTo(DAWN.ray[0], 6);
    // The ribbon: not seen until `first`, then its head climbs; the time asked for is the time the picture puts it there.
    expect(ribbonHead(0)).toBe(0);
    expect(ribbonHead(LIGHT.first)).toBeGreaterThan(0);
    for (const e of [0.05, 0.12, 0.2, 0.24]) expect(ribbonHead(smooth(DAWN.rise[0], DAWN.rise[1], ribbonTime(e)))).toBeCloseTo(e, 6);
    expect(smooth(DAWN.rise[0], DAWN.rise[1], ARRIVE_AT)).toBeCloseTo(LIGHT.first, 9);
    // The line has reached the far shore before the ribbon leaves the water: a breath between the two.
    expect(lineTime(1)).toBeLessThan(ARRIVE_AT - 0.25);
    expect(lineTime(1)).toBeGreaterThan(DAWN.ray[0] + 1);
    // Where the light stands across the frame: the ribbon's foot is right of the middle, and it leans further right both as it climbs and, in the water, toward the eye.
    const L = endLens(1.6);
    const tan = Math.tan((L.fov * Math.PI) / 360);
    expect(lightPan(0, 1.6, tan)).toBeCloseTo(RIBBON.at(1.6), 9);
    expect(lightPan(0, 0.46, tan)).toBeCloseTo(RIBBON.at(0.46), 9);
    expect(lightPan(0.2, 1.6, tan)).toBeGreaterThan(lightPan(0.05, 1.6, tan));
    expect(lightPan(LIGHT.foot, 1.6, tan)).toBeGreaterThan(lightPan(0.2, 1.6, tan));
    expect(lightPan(LIGHT.foot, 1.6, tan)).toBeLessThan(0.75);
  });

  it('the arrival: the theme gathers as the line runs out, is stated whole as the ribbon climbs with the ladder following its head, and the bed’s swell comes to its height with the ribbon', () => {
    const L = endLens(1.6);
    const tan = Math.tan((L.fov * Math.PI) / 360);
    // The gathering: six notes inside the line's run, the last as it reaches the far shore, each sooner after the one before or about as soon.
    const gather = GATHER.map((_, i) => gatherTime(i));
    gather.forEach((t, i) => {
      expect(t).toBeGreaterThan(DAWN.ray[0]);
      expect(t).toBeLessThanOrEqual(lineTime(1));
      if (i) expect(t).toBeGreaterThan(gather[i - 1]);
    });
    expect(gather[1] - gather[0]).toBeGreaterThan(gather[2] - gather[1]);
    expect(lineTime(1) - gather[5]).toBeLessThan(0.1);
    // Each is further off than the last: softer, more of the place round it, and its two bells closer together, closing on where the line ends.
    const voices = GATHER.map((_, i) => gatherVoice(i, 1.6, tan, 0));
    voices.forEach((v, i) => {
      expect(v.midi).toBe(GATHER[i]);
      if (!i) return;
      const u = voices[i - 1];
      expect(v.gain).toBeLessThan(u.gain);
      expect(v.send).toBeGreaterThan(u.send);
      expect(v.width).toBeLessThan(u.width);
      expect(v.pan).toBeLessThan(u.pan);
    });
    expect(voices[0].width).toBeGreaterThan(0.4);
    expect(voices[5].width).toBeLessThan(0.05);
    expect(voices[5].pan).toBeCloseTo(lightPan(0, 1.6, tan), 6);
    expect(gatherVoice(2, 1.6, tan, 1).bright).toBeLessThan(voices[2].bright);
    // The theme, whole: its first chord on the ribbon's first light, its last as the rise ends, its own rhythm between.
    const chords = ARRIVAL.map((_, i) => arrivalTime(i));
    expect(chords[0]).toBeCloseTo(ARRIVE_AT, 9);
    expect(chords[4]).toBeCloseTo(DAWN.rise[1], 9);
    chords.forEach((t, i) => expect((t - chords[0]) / (chords[4] - chords[0])).toBeCloseTo(ARRIVAL_AT[i], 9));
    expect(chords[4]).toBeLessThan(DAWN.over);
    // The ladder: a rung each sixth of the way up, the last as the ribbon's head leaves the top of the frame; all within the rise.
    const top = 0.24;
    const climb = CLIMB.map((_, j) => climbTime(j, top));
    climb.forEach((t, j) => {
      expect(t).toBeGreaterThan(ARRIVE_AT);
      expect(t).toBeLessThan(DAWN.rise[1]);
      if (j) expect(t).toBeGreaterThan(climb[j - 1] + 0.1);
      expect(ribbonHead((t - DAWN.rise[0]) / (DAWN.rise[1] - DAWN.rise[0]) < 0 ? 0 : (() => { const x = (t - DAWN.rise[0]) / (DAWN.rise[1] - DAWN.rise[0]); return x * x * (3 - 2 * x); })())).toBeCloseTo(LIGHT.base + ((j + 1) / CLIMB.length) * (top - LIGHT.base), 6);
    });
    expect(climb[CLIMB.length - 1]).toBeCloseTo(ribbonTime(top), 9);
    const rungs = CLIMB.map((_, j) => climbVoice(j, top, 1.6, tan, 0));
    rungs.forEach((v, j) => {
      expect(v.midi).toBe(CLIMB[j]);
      if (!j) return;
      expect(v.midi).toBeGreaterThan(rungs[j - 1].midi);
      expect(v.gain).toBeLessThan(rungs[j - 1].gain);
      expect(v.send).toBeGreaterThan(rungs[j - 1].send);
      // (It leans toward the sun as it climbs.)
      expect(v.pan).toBeGreaterThan(rungs[j - 1].pan);
    });
    // The bed's swell: it leans in with the sun's lift, comes to its height with the ribbon, and lets go after it.
    expect(arrivalOf(0, 0, 0)).toBe(0);
    expect(arrivalOf(1, 0, 0)).toBeCloseTo(0.55, 9);
    expect(arrivalOf(1, 0.5, 0)).toBeGreaterThan(arrivalOf(1, 0, 0));
    expect(arrivalOf(1, 0.999, 0)).toBeGreaterThan(0.99);
    expect(arrivalOf(1, 1, 0)).toBe(1);
    expect(arrivalOf(1, 1, 6)).toBeLessThan(0.4);
    expect(arrivalOf(1, 1, 60)).toBeLessThan(0.001);
  });

  it('the name on the lake: each letter has its place and its turn to go under, and the sheet breaks after the last', () => {
    for (const aspect of [1.6, 0.46]) {
      const hero = heroDesign(aspect).name;
      const at = nameLetters(aspect);
      // A letter for each letter of the name, none for the space, inside the name's width, about its middle.
      expect(at).toHaveLength(hero.lines.join('').replace(/ /g, '').length);
      for (const l of at) {
        expect(Math.abs(l.x - NAME.x)).toBeLessThan(hero.width / 2);
        expect(l.y).toBe(NAME.y);
      }
      expect(Math.min(...at.map((l) => l.x))).toBeLessThan(NAME.x - hero.width * 0.3);
      expect(Math.max(...at.map((l) => l.x))).toBeGreaterThan(NAME.x + hero.width * 0.3);
      // Their order: every letter once, and never two neighbours one after the other.
      const order = sinkOrder(at.length);
      expect(order.slice().sort((a, b) => a - b)).toEqual(at.map((_, i) => i));
      for (let i = 1; i < order.length; i++) expect(Math.abs(order[i] - order[i - 1])).toBeGreaterThan(1);
    }
    for (const n of [4, 6, 8, 9, 10]) expect(new Set(sinkOrder(n)).size).toBe(n);
    // On a wide screen the name is one line and there is a gap where the space is.
    const wide = nameLetters(1.6).map((l) => l.x);
    expect(wide[4] - wide[3]).toBeGreaterThan((wide[1] - wide[0]) * 1.8);
    // Their turns are spread evenly through the stretch of the melt in which the picture lets the blocks go.
    expect(nameMelt(NAME_MELT.left[0]).left).toBe(1);
    expect(nameMelt(NAME_MELT.left[1]).left).toBe(0);
    for (let turn = 0; turn < 8; turn++) {
      expect(sinkAt(turn, 8)).toBeLessThan(1);
      expect(sinkAt(turn, 8)).toBeGreaterThan(0);
      if (turn) expect(sinkAt(turn - 1, 8) - sinkAt(turn, 8)).toBeCloseTo(1 / 8, 9);
    }
    // Each is a small low drop where its letter stood, each lower than the one before, in key.
    const v = Array.from({ length: 8 }, (_, turn) => sinkVoice(turn, 8, -0.7 + 0.2 * turn));
    v.forEach((x, i) => {
      expect(PENTA).toContain(pc(x.midi));
      expect(x.gain).toBeLessThan(0.5);
      expect(x.pan).toBeCloseTo(0.95 * (-0.7 + 0.2 * i), 9);
      if (i) expect(x.midi).toBeLessThan(v[i - 1].midi);
    });
    // The water under the blocks opens before any of them goes, and the sheet breaks only once all have gone.
    expect(nameMelt(NAME_MELT.left[0]).hole).toBe(1);
    expect(nameMelt(0.2).pond).toBeGreaterThan(nameMelt(0.2).hole);
    expect(SHEET_BREAKS).toBeGreaterThan(NAME_MELT.left[1]);
    expect(SHEET_BREAKS).toBeLessThan(0.6);
  });

  it('the rail plays down the flight: each tick its own note, the first the highest, a press the hover’s note an octave down', () => {
    const notes = Array.from({ length: 12 }, (_, i) => railVoice('hover', i, 12, 0.98).midi);
    for (let i = 1; i < 12; i++) expect(notes[i]).toBeLessThan(notes[i - 1]);
    for (const m of notes) expect(PENTA).toContain(pc(m));
    expect(railVoice('hover', 3, 12, 0.98).midi - railVoice('tap', 3, 12, 0.98).midi).toBe(12);
    expect(railVoice('hover', 3, 12, 0.98).gain).toBeLessThan(uiVoice('hover', 0.98).gain);
    expect(railVoice('tap', 3, 12, 0.98).pan).toBeGreaterThan(0.3);
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
    return { at, s, cam, aspect: 1.6, melt: (s - MELT.from) / (MELT.to - MELT.from), day: dayAt(s), rest: s >= SETTLE_AT - 0.02, clock: at / 1000, clockAt: at, tribs: null, st: stationsNear(cam.pos), gate: [1, 0, 0], surge: [1, 0, 0], ray: 0, lift: 0, rise: 0, px: 0.5, py: 0.5, far: 0, moved: -1e9, scrollY: 0, ...more };
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
    // At rest the piece still waits on the dominant until the ribbon of light has left the water.
    expect(end.move).toBe(MOVE.approach);
    expect(new SceneReader().read(sig(END_AT, 1000, { rise: 0.03 }), 1000, env).move).toBe(MOVE.approach);
    expect(new SceneReader().read(sig(END_AT, 1000, { rise: 0.05 }), 1000, env).move).toBe(MOVE.rest);
    // (Where no light event runs, with motion reduced or the sun already up, the ribbon simply stands.)
    expect(new SceneReader().read(sig(END_AT, 1000, { ray: 1, lift: 1, rise: 1 }), 1000, env).move).toBe(MOVE.rest);
  });

  it('the tarn is found at its station and nowhere else', () => {
    const stops = stillStops();
    stops.forEach((s, i) => {
      const sc = new SceneReader().read(sig(s, 1000), 1000, env);
      if (s === composed.bridge) expect(sc.tarn).toBeGreaterThan(0.6);
      else expect(sc.tarn, `station ${i}`).toBeLessThan(0.2);
    });
    // An upright screen holds the two shards against the sky over a foot of bank: little of the tarn lies under
    // the frame's foot, and it is the tarn all the same (the shards' call and answer are heard there).
    const tall = (i: number) => {
      const cam = basisOf(poseAt(flightKeys(0.46), stops[i]));
      return new SceneReader().read({ ...sig(stops[i], 1000), cam, aspect: 0.46, st: stationsNear(cam.pos) }, 1000, env);
    };
    expect(tall(stops.indexOf(composed.bridge)).tarn).toBeGreaterThan(0.6);
    stops.forEach((_, i) => {
      if (stops[i] !== composed.bridge) expect(tall(i).tarn, `station ${i}, upright`).toBeLessThan(0.2);
    });
  });

  it('the walls close in only inside the canyon', () => {
    const { canyon } = starts;
    const stops = stillStops();
    expect(new SceneReader().read(sig(canyon + 1.2, 1000), 1000, env).walls).toBeGreaterThan(0.7);
    for (const s of stops.filter(s => s !== composed.hero && s !== composed.canyon)) expect(new SceneReader().read(sig(s, 1000), 1000, env).walls, `station ${s}`).toBeLessThan(0.05);
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
    expect(sc.jump).toBe(false);
    // Then a jump to another part of the page (a tick of the rail): nothing between was passed, so nothing sped up, and the scene says so.
    const jumped = r.read(sig(20, 2040), 2040, env);
    expect(jumped.jump).toBe(true);
    expect(jumped.sv).toBeLessThan(sc.sv + 0.01);
    expect(jumped.camV).toBeLessThan(sc.camV + 0.01);
    expect(r.read(sig(20, 2056.7), 2056.7, env).jump).toBe(false);
    // From the frozen lake straight to a station: the lake melted on the way in no frame, and the melt has no rate.
    const r2 = new SceneReader();
    r2.read(sig(0.05, 1000), 1000, env);
    r2.read(sig(0.05, 1016.7), 1016.7, env);
    const far = r2.read(sig(composed.infiniview, 1033.4), 1033.4, env);
    expect(far.jump).toBe(true);
    expect(far.meltRate).toBe(0);
    expect(mixOf(far, 0).cracks).toBe(0);
    // A hard flick of the wheel is not a jump.
    const r3 = new SceneReader();
    r3.read(sig(3, 1000), 1000, env);
    expect(r3.read(sig(3.12, 1016.7), 1016.7, env).jump).toBe(false);
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
    const cam = (stop: number) => basisOf(poseAt(flightKeys(1.6), stop));
    // At the dam all three sluices are in frame, left to right.
    const gates = SLUICES.map((line) => seenAt(cam(composed.fork), 1.6, line[0].x, line[0].y, 40));
    for (const g of gates) expect(g.k).toBeGreaterThan(0.9);
    expect(gates[0].pan).toBeLessThan(gates[1].pan);
    expect(gates[1].pan).toBeLessThan(gates[2].pan);
    // The dam is seen from downstream, looking back upstream. The columns stand far behind it: the picture has stopped
    // their drips by then (they are not near), so none is set, and their shallows are not heard.
    expect(stationsNear(cam(composed.fork).pos)[0]).toBe(0);
    expect(stationsNear(cam(composed.models).pos)[0]).toBe(1);
    // At their own station the columns, the lattice and both shards are in frame.
    for (const x of COLS.xs) expect(seenAt(cam(composed.models), 1.6, x, COLS.y, 0).k).toBeGreaterThan(0.9);
    expect(seenAt(cam(composed.lattice), 1.6, LATTICE.x, LATTICE.y, 0).k).toBeGreaterThan(0.9);
    for (const sh of SHARDS) expect(seenAt(cam(composed.bridge), 1.6, sh.x, sh.y, sh.h / 2).k).toBeGreaterThan(0.9);
    // The lattice is near from its own station. At the dam the eye stands over it looking back upstream: it is under the lens, out of frame, and not heard.
    expect(seenAt(cam(composed.lattice), 1.6, LATTICE.x, LATTICE.y, 0).far).toBeLessThan(1500);
    expect(seenAt(cam(composed.fork), 1.6, LATTICE.x, LATTICE.y, 0).k).toBe(0);
    expect(seenAt(null, 1.6, 0, 0, 0).k).toBe(0);
  });

  it('the movements follow the flight in order', () => {
    const { say, bridge, models, canyon, delta, sea } = starts;
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
    // (At rest, but the ribbon of light has not yet left the water: the dominant is still held.)
    expect(movementAt(true, END_AT, 1, true, false)).toBe(MOVE.approach);
    expect(movementAt(false, 3, 1, false)).toBe(MOVE.page);
  });

  it('at each station’s composed stop, what has a voice is what is in frame, on the side it is in frame', () => {
    const at = (stop: number, more: Partial<SignalsLike> = {}) => new SceneReader().read(sig(stop, 1000, more), 1000, env);
    const gain = (sc: Scene, v: number) => waterOf(sc, 0)[v][GAIN];

    // 1 The statement: the river runs down the right of the frame. The cliff's falls, the block and everything later are a station or more away and silent.
    const say = at(composed.say);
    expect(say.pan).toBeGreaterThan(0.5);
    expect(gain(say, W.stream)).toBeGreaterThan(0.1);
    expect(Math.max(...say.falls.map(heard))).toBe(0);
    for (let i = 0; i < 7; i++) expect(gain(say, W.falls + i)).toBe(0);
    expect(gain(say, W.lap) + gain(say, W.thin) + gain(say, W.sluice) + gain(say, W.wall)).toBe(0);

    // 2 The basin: the block stands right of the middle with the basin's water round it. The far cliff is a few pixels at the horizon: its falls are all but silent.
    const basin = at(composed.infiniview);
    expect(basin.basin).toBeGreaterThan(0.8);
    expect(basin.slab.k).toBe(1);
    expect(basin.slab.pan).toBeGreaterThan(0.05);
    expect(basin.slab.pan).toBeLessThan(0.5);
    expect(heard(basin.slab)).toBeGreaterThan(0.3);
    expect(gain(basin, W.lap)).toBeGreaterThan(0.15);
    for (let i = 0; i < 7; i++) expect(gain(basin, W.falls + i)).toBeLessThan(0.03);

    // 3 The confluence: all seven falls stand across the frame over the cliff, the broadest furthest right, each next one further left; the river below them runs off to the right.
    const conf = at(composed.upstream);
    expect(conf.falls).toHaveLength(7);
    conf.falls.forEach((f, i) => {
      expect(f.k, `fall ${i}`).toBe(1);
      expect(heard(f)).toBeGreaterThan(0.35);
      if (i) expect(f.pan).toBeLessThan(conf.falls[i - 1].pan);
      if (i) expect(f.size).toBeLessThanOrEqual(conf.falls[i - 1].size);
      expect(gain(conf, W.falls + i)).toBeGreaterThan(0.05);
    });
    expect(conf.falls[0].pan).toBeGreaterThan(0.2);
    expect(conf.falls[6].pan).toBeLessThan(-0.3);
    expect(conf.falls[0].size).toBe(1);
    expect(conf.falls[6].size).toBeLessThan(0.3);
    expect(conf.pan).toBeGreaterThan(0.3);
    // (Published widths take over from the plan's.)
    const live = at(composed.upstream, { tribs: [10, 10, 10, 10, 10, 10, 168] });
    expect(live.falls[6].size).toBe(1);
    expect(live.falls[0].size).toBeLessThan(0.1);

    // 4 The rock pool: still water under the lens, and its one brook leaving from the far shore, near the middle of the frame. The tarn beyond is not yet the tarn.
    const pool = at(composed.bench);
    expect(pool.pool).toBeGreaterThan(0.8);
    expect(pool.spill.k).toBe(1);
    expect(Math.abs(pool.spill.pan)).toBeLessThan(0.3);
    expect(heard(pool.spill)).toBeGreaterThan(0.5);
    expect(gain(pool, W.thin)).toBeGreaterThan(0.3);
    expect(pool.tarn).toBeLessThan(0.2);

    // 5 The tarn: both shards in frame, the further one left of the nearer, and next to no water sound.
    const tarn = at(composed.bridge);
    expect(tarn.tarn).toBeGreaterThan(0.9);
    const shards = SHARDS.map((sh) => seenAt(tarn.cam, 1.6, sh.x, sh.y, sh.h / 2));
    for (const sh of shards) expect(sh.k).toBe(1);
    expect(waterOf(tarn, 0).reduce((s, v) => s + v[GAIN] * v[RATE], 0)).toBeLessThan(1);

    // 6 The columns: the shallows in the middle of the frame. The dam is in the distance with its back to the eye: the sluice's rush is on its far side and is not heard.
    const cols = at(composed.models);
    expect(cols.cols).toBe(1);
    expect(cols.shallows.k).toBe(1);
    expect(Math.abs(cols.shallows.pan)).toBeLessThan(0.3);
    expect(gain(cols, W.lap)).toBeGreaterThan(0.2);
    expect(cols.sluice.k).toBe(0);
    expect(gain(cols, W.sluice)).toBe(0);

    // 7 The dam, from downstream: the one running channel comes toward the eye near the middle of the frame; the two shut ones are dry beds and say nothing; the lattice is under the lens.
    const dam = at(composed.fork);
    expect(dam.dam).toBe(1);
    expect(dam.sluice.k).toBe(1);
    expect(Math.abs(dam.sluice.pan)).toBeLessThan(0.3);
    expect(heard(dam.sluice)).toBeGreaterThan(0.3);
    expect(gain(dam, W.sluice)).toBeGreaterThan(0.08);
    for (const i of [1, 2]) for (const p of SLUICES[i].slice(1, 4)) expect(groundAt(p.x, p.y, 1, [1, 0, 0]).wet).toBe(0);
    for (const p of SLUICES[0].slice(1, 4)) expect(groundAt(p.x, p.y, 1, [1, 0, 0]).wet).toBe(1);
    expect(dam.lanes.k).toBe(0);
    // (With the middle gate open instead, the water is heard further right: the sluices run left to right in the picture.)
    expect(at(composed.fork, { gate: [0, 1, 0] }).sluice.pan).toBeGreaterThan(dam.sluice.pan + 0.2);

    // 8 The lattice: the whole of it in frame, the thread coming in from the right of it.
    const lat = at(composed.lattice);
    expect(lat.lattice).toBe(1);
    expect(lat.lanes.k).toBe(1);
    expect(lat.thread.k).toBe(1);
    expect(lat.thread.pan).toBeGreaterThan(lat.lanes.pan);
    expect(gain(lat, W.thin)).toBeGreaterThan(0.2);
    expect(waterOf(lat, 0)[W.thin][PAN]).toBeGreaterThan(lat.lanes.pan * 0.4);

    // 9 The canyon: closed in, fast water under the lens.
    const can = at(composed.canyon);
    expect(can.walls).toBe(1);
    expect(gain(can, W.wall)).toBeGreaterThan(0.15);
    expect(mixOf(can, 0).rooms[1]).toBe(1);

    // 10 The delta: five channels, all in frame, all in the right half of it (the bank and the words are on the left), west to east.
    const delta = at(composed.delta);
    expect(delta.arms).toHaveLength(5);
    delta.arms.forEach((a, i) => {
      expect(a.k).toBeGreaterThan(0.5);
      expect(a.pan).toBeGreaterThanOrEqual(0);
      expect(gain(delta, W.arms + i)).toBeGreaterThan(0.1);
    });
    expect(delta.arms[4].pan).toBeGreaterThan(delta.arms[0].pan + 0.5);

    // 11 The sea: all sea, and nothing of the river's.
    const sea = at(composed.sea);
    expect(sea.sea).toBeGreaterThan(0.9);
    expect(gain(sea, W.sea)).toBeGreaterThan(0);
    for (const v of [W.falls, W.thin, W.lap, W.sluice, W.wall, W.arms]) expect(gain(sea, v)).toBe(0);

    // None of any of it is heard from the frozen lake; the name is in the middle of that frame.
    const top = at(composed.hero);
    expect(Math.max(...top.falls.map(heard), heard(top.spill), ...top.arms.map(heard))).toBe(0);
    expect(waterOf(top, 0).reduce((s, v) => s + v[GAIN], 0)).toBe(0);
    expect(top.name.k).toBe(1);
    expect(Math.abs(top.name.pan)).toBeLessThan(0.05);
  });

  it('a thing a station or more away is not heard, however squarely it is in frame', () => {
    expect(heard({ k: 1, pan: 0, far: 300 })).toBeGreaterThan(0.9);
    expect(heard({ k: 1, pan: 0, far: 1100 })).toBeCloseTo(0.5, 6);
    expect(heard({ k: 1, pan: 0, far: 2400 })).toBeGreaterThan(0.15);
    expect(heard({ k: 1, pan: 0, far: 3000 })).toBeLessThan(0.07);
    expect(heard({ k: 1, pan: 0, far: 3400 })).toBe(0);
    expect(heard({ k: 0, pan: 0, far: 300 })).toBe(0);
    for (let far = 100; far < 4000; far += 100) expect(heard({ k: 1, pan: 0, far: far + 100 })).toBeLessThanOrEqual(heard({ k: 1, pan: 0, far }));
  });

  it('the camera’s bank and turn, the sky it sees, the wall it flies under, the run out to sea', () => {
    const { canyon, sea } = starts;
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
