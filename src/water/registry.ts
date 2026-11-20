import { BASIN_OBJECT, CONFLUENCE, ROCK_POOL, TARN_OBJECT } from './shaders/river-stations';
import { paintLake, paintReach, paintBasin, paintConfluence, paintPool, paintTarn, paintShallows, paintDam, paintLattice, paintCanyon, paintDelta } from './geography';
import type { BedPainter } from './bed';
import { COLUMNS, DAM_ICE, DAM_WATER, LATTICE_ICE, CANYON_ICE } from './shaders/stations';
import { boxInView, projectPoint, type Box, type Rect } from './projection';
import type { Basis, Key, Move, Pose, V3 } from './camera';
import { BENDS, BOARD_DEPTH, FACE, SHEET, boardSpan, sheetCols, CANYON, COLS, CONF_Y, DAM, DY, LATTICE, LIP, POOL, SHARDS, SLAB, T2, TARN, TARN_BAY, lipY } from './geography';

type FrameMove = (at: Pose, x: number, y: number, push: number, arc: number, rise: number, z?: number) => Move;
export interface CameraContext {
  aspect: number; upright: boolean; band: boolean; g: number;
  start: number; stop: number; end: number;
  move: FrameMove;
  holdKeys: (m: Move, stop: number, before?: number) => Key[];
  opening: () => Key[];
  reach: (s: number, y: number) => Key;
  ending: (sea: boolean) => Key[];
}

/** Times are screens relative to the section's start. Camera keys use absolute screens. */
type Words =
  | { kind: 'section'; layout?: 'opening' | 'statement' | 'interests' | 'ending' | 'beat' }
  | { kind: 'figure'; layout: 'contributions' | 'downloads' }
  | { kind: 'title'; layout?: 'display' | 'table' | 'film' | 'switch' | 'pool' | 'wall' };

type Definition = Words & {
  id: string; rail: string; length: number; offset: number;
  paint?: (bed: BedPainter, tribs: number[], gate: number) => void;
  subject?: Subject;
  steps?: Partial<Record<'eyebrow' | 'title' | 'line' | 'meta' | 'act' | 'leave', number>>;
  project?: string;
  hold?: { name: string; before?: number; after?: number };
  bandLift?: number;
  camera: (frame: CameraContext) => Key[];
}

/** The water lies at most this far below the land (the walled basin's freeboard, with room). */
export const WATER_LOW = -64;
/**
 * The ground under a ray can stand this far above the land: at the confluence the pass takes the place where the ray
 * comes down on the snowfield for the ground's (confLift), and looks for whatever lies by place from there. So a
 * subject near the snowfield can be found by a ray that is still this high over it.
 */
const FIELD_HIGH = LIP.h * 3.3;


/** Where the block's shade, its light, its image and its white water can lie: the ground and water within four widths of it. */
const SLAB_REACH = SLAB.w * 4 + 8;
const SLAB_GROUND: Box = [
  [SLAB.x - SLAB_REACH, SLAB.y - SLAB_REACH, WATER_LOW],
  [SLAB.x + SLAB_REACH, SLAB.y + SLAB_REACH, 2],
];
/** Where the confluence's trails lie in the river (the water looks for them by place). */
const CONF_RIVER_BOX: Box = [
  [700, lipY(LIP.x0) - 900, WATER_LOW],
  [2500, lipY(700) + 40, FIELD_HIGH],
];
/** Where the pool's water is (the bed under a ray lies up to a few hundred units on). */
const POOL_BOX: Box = [
  [POOL.x - 560, POOL.y - 560, WATER_LOW],
  [POOL.x + POOL.w + 560, POOL.y + POOL.h + 560, FIELD_HIGH],
];
/**
 * Where each of the later stations' subjects can be: what the pass's own tests admit (each names the test it mirrors).
 * All of a subject's own ice is inside its box, and so is every place on the water or the ground where its image, its
 * shade or its light is looked for: a ray that meets such a place passes through the box's foot.
 */
// The seracs: themselves, and the water and bank within `rect` of them (columns: `abs(pwp.x - 1340.0) < 800.0 && abs(pwp.y - COL_Y) < 560.0`).
const COLS_BOX: Box = [
  [1340 - 830, COLS.y - 590, WATER_LOW],
  [1340 + 830, COLS.y + 590, COLS.hMax * 1.25 + 40],
];
// (And a serac is looked for along the whole of a ray, under the water too: a ray that would meet one below the water
// is given the seracs' long shade on the water it meets first, wherever that is (columns: `best > tw`). So every pixel
// under a serac in the frame can need them: the box they stand in, carried down out of sight.)
const COL_REACH = 2.7 * COLS.r + 40;
const COLS_DEEP: Box = [
  [COLS.xs[0] - COL_REACH, COLS.y - 26 - COL_REACH, -1e5],
  [COLS.xs[3] + COL_REACH, COLS.y + 26 + COL_REACH, COLS.hMax * 1.25 + 40],
];
// The dam: its wall and hips, its pond behind it and its three channels below it (dam: `d < -pond - 120 || d > 1010 || abs(pwp.x - 1300) > 640`).
const DAM_BOX: Box = [
  [Math.min(DAM.x0 - 180, 1300 - 660), DAM.y - DAM.pond - 150, WATER_LOW],
  [Math.max(DAM.x1 + 180, 1300 + 660), DAM.y + 1040, DAM.h + 40],
];
// The lattice: its cubes, and the pool's water round them (lattice: `max(abs(q.x), abs(q.y)) > 2.0 * LAT_P + 300.0`).
const LAT_REACH = 2 * LATTICE.pitch + 330;
const LAT_BOX: Box = [
  [LATTICE.x - LAT_REACH, LATTICE.y - LAT_REACH, WATER_LOW],
  [LATTICE.x + LAT_REACH, LATTICE.y + LAT_REACH, LATTICE.h * 3 + 60],
];
// The canyon: the glacier's own box (glacierHit's), which its water lies in too.
const CANYON_BOX: Box = [
  [CANYON.x0 - 4, CANYON.y0 - 4, WATER_LOW],
  [CANYON.x1 + 4, CANYON.y1 + 4, CANYON.h + 6],
];
// The tarn's shards: the tarn and its bay (their image, their rings, the pulse), and the light each throws into the
// air and onto the water round it, which dies away with distance (to a three-thousandth of itself, eight of its own
// lengths off: far under one step of the screen's 255).
const SHARD_GLOW = 8 * 1.9 * Math.max(SHARDS[0].r, SHARDS[1].r);
const SHARDS_BOX: Box = [
  [Math.min(TARN.x - TARN.rx - 20, TARN_BAY.x - TARN_BAY.r - 20, SHARDS[0].x - SHARD_GLOW, SHARDS[1].x - SHARD_GLOW), Math.min(TARN.y - TARN.ry - 20, TARN_BAY.y - TARN_BAY.r - 20, SHARDS[0].y - SHARD_GLOW, SHARDS[1].y - SHARD_GLOW), -SHARD_GLOW],
  [Math.max(TARN.x + TARN.rx + 20, TARN_BAY.x + TARN_BAY.r + 20, SHARDS[0].x + SHARD_GLOW, SHARDS[1].x + SHARD_GLOW), Math.max(TARN.y + TARN.ry + 20, TARN_BAY.y + TARN_BAY.r + 20, SHARDS[0].y + SHARD_GLOW, SHARDS[1].y + SHARD_GLOW), Math.max(SHARDS[0].h, SHARDS[1].h) + SHARD_GLOW],
];

/** The block's place in the frame: the part of the screen it can be on (vUv: x0, y0, x1, y1), and how many of its corners are behind the eye. */
export function slabInFrame(cam: Basis, aspect: number) {
  const sin = Math.sin(SLAB.turn);
  const cos = Math.cos(SLAB.turn);
  const nx = -sin;
  const ny = -cos;
  const rx = cos;
  const ry = -sin;
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  let behind = 0;
  for (let i = 0; i < 8; i++) {
    const side = (i & 1 ? 0.5 : -0.5) * SLAB.w;
    const back = i & 2 ? SLAB.thick : 0;
    const z = SLAB.lift + (i & 4 ? SLAB.h : 0);
    const pr = projectPoint(cam, [SLAB.x + rx * side - nx * back, SLAB.y + ry * side - ny * back, z], aspect);
    if (pr[2] < 1) behind++;
    x0 = Math.min(x0, pr[0]);
    x1 = Math.max(x1, pr[0]);
    y0 = Math.min(y0, 1 - pr[1]);
    y1 = Math.max(y1, 1 - pr[1]);
  }
  const box: [number, number, number, number] = behind > 0 ? [0, 0, 1, 1] : [x0 - 0.01, y0 - 0.01, x1 + 0.01, y1 + 0.01];
  return { nx, ny, rx, ry, behind, box };
}

/** Whether the tarn's shards are near enough to be looked for (the pass's uShardOn). */
export const tarnNear = (cam: Basis) => Math.hypot(cam.pos[0] - TARN.x, cam.pos[1] - TARN.y) < 3200 && cam.pos[2] < 700;

const confNearCam = (cam: Basis) => cam.pos[1] > CONF_Y - 3300 && cam.pos[1] < CONF_Y + 1500;
const poolNearCam = (cam: Basis) => Math.abs(cam.pos[0] - (POOL.x + POOL.w / 2)) < 2300 && Math.abs(cam.pos[1] - (POOL.y + POOL.h / 2)) < 2300;

function slabVisible(cam: Basis, aspect: number, hasMedia: boolean) {
  if (!hasMedia) return false;
  const { box, behind } = slabInFrame(cam, aspect);
  if (behind === 8) return false;
  const dist = Math.hypot(cam.pos[0] - SLAB.x, cam.pos[1] - SLAB.y);
  const extent = Math.hypot(SLAB.w * 0.5 + SLAB.thick, SLAB.thick, SLAB.h + SLAB.lift);
  if (box[0] < 1 && box[2] > 0 && box[1] < 1 && box[3] > 0 && Math.hypot(dist, cam.pos[2]) < 2500 + extent) return true;
  return dist < 5200 && boxInView(cam, aspect, ...SLAB_GROUND);
}

export interface Subject {
  bit: number;
  /** Furthest eye-to-box distance at which the object can contribute. */
  reach?: number;
  define: string;
  boxes: readonly Box[];
  visible?: (cam: Basis, aspect: number, hasMedia: boolean) => boolean;
  /** Near these objects their ground pass covers the frame. Far away small adjacent boxes can share a tile. */
  wholeWhen?: (cam: Basis) => boolean;
  combine?: boolean;
  silhouette?: (cam: Basis, aspect: number) => Rect | null;
  /** A named GLSL function. Custom objects receive (colour, world ray, scroll progress). */
  shader: { source: string; fn: string };
  /** Existing objects whose rays also affect the ground, media or water pass. */
  pass?: 'slab' | 'confluence' | 'pool' | 'shards' | 'columns' | 'dam' | 'lattice' | 'canyon';
  proximity?: { lane: 0 | 1 | 2 | 3; x: number; y: number; from: number; to: number };
  /** Event endpoints in screens from the section start. */
  event?: readonly [number, number];
}
const rad = (d: number) => d * Math.PI / 180;

/**
 * Station 3's frame, composed from the plates backwards: they are set a
 * share of the frame's width, so the table's rows are a known size on any
 * screen. A wide screen looks across the pool from low over its near bank
 * (the plates right of the words, the tarn and the ranges above); an
 * upright one looks down into it (the plates above the middle, the bank at
 * the foot).
 */
function benchPose(aspect: number): Pose {
  const upright = aspect < 0.9;
  const fov = upright ? 52 : 62;
  const th = Math.tan(rad(fov / 2));
  const n = sheetCols(aspect);
  const w = boardSpan(n);
  const half = BOARD_DEPTH / 2;
  // (The plates lie under the water: this far below the land.)
  const bed = 36;
  if (upright) {
    const pitch = rad(76);
    const share = 0.9;
    // The plates' middle stands this far above the frame's.
    const lift = Math.atan(0.2 * th);
    const range = w / (2 * aspect * th * share) / Math.cos(lift);
    const z = range * Math.sin(pitch - lift) - bed;
    const back = range * Math.cos(pitch - lift);
    const x = SHEET.x0 + w / 2;
    const y = SHEET.y - back;
    return { pos: [x, y, z], aim: [x, y + z / Math.tan(pitch), 0], fov };
  }
  const pitch = rad(28);
  // The plates' near edge takes this share of the frame's width, and stands this far in from its left side.
  // (It leaves the bank at lower left wide enough for the station's name, its arrow and its lines to stand on snow alone.)
  const share = Math.min(0.51, Math.max(0.36, 0.9 - 0.69 / aspect));
  const left = 1 - share - 0.03;
  const depth = w / (2 * aspect * th * share);
  // (The camera stands a little further back from the plates' middle than it is high.)
  const BACK = 1.07;
  const z = (depth + half * Math.cos(pitch) - bed * Math.sin(pitch)) / (BACK * Math.cos(pitch) + Math.sin(pitch));
  const x = SHEET.x0 - (left - 0.5) * 2 * aspect * th * depth;
  const y = SHEET.y - z * BACK;
  return { pos: [x, y, z], aim: [x, y + z / Math.tan(pitch), 0], fov };
}

/**
 * Station 4's frame as an inner page's scene keeps it (the home page set its
 * words in the sky here until its fourth round): the eye a man's height over
 * the water of the tarn's near bay, looking a little up, so the horizon lies
 * six tenths of the way down the frame and the two shards stand whole
 * against the sky to the right.
 */
function tarnBand(aspect: number): Pose {
  const fov = 44;
  const th = Math.tan(rad(fov / 2));
  const pos: V3 = [TARN_BAY.x - 100, TARN_BAY.y - 140, 40];
  // (The nearer shard's middle stands a third of the frame's width right of the frame's middle.)
  const near = SHARDS[0];
  const to = Math.atan2(near.x - TARN_BAY.x + 100, near.y - TARN_BAY.y + 140);
  const head = Math.min(rad(21), Math.max(rad(13), to - Math.atan(0.33 * 2 * th * aspect)));
  // (Looking up by this much puts the horizon 0.6 of the way down.)
  const up = 0.2 * th;
  const far = 1000;
  return { pos, aim: [pos[0] + Math.sin(head) * far, pos[1] + Math.cos(head) * far, pos[2] + up * far], fov };
}

/**
 * Station 4's wide frame on the home page. The words stand at lower left,
 * as at every station, so the lower left must be one calm surface: here it
 * is the snow of the tarn's south-west bank. The eye stands on that bank, a
 * man's height over it, and looks north-east across the water: from that
 * low the bank fills the frame's lower left as far up as the words reach,
 * and over it the tarn is a mirror that holds the ranges, the sky and the
 * two shards, each whole over its own image.
 */
function tarnPose(): Pose {
  // (This near the water the tarn is most of what the frame holds, and the sound reads it so: see the scene reader's `tarn`.)
  const pos: V3 = [TARN_BAY.x - 350, TARN_BAY.y - 170, 42];
  // (It looks down a little: the bank's far edge stands well over the name, with room to spare through the whole move.)
  return { pos, aim: [pos[0] + 700, pos[1] + 720, pos[2] - 165], fov: 44 };
}

/**
 * Station 5's wide frame on the home page: the four seracs across the middle and right, each with its name over it, the
 * shallows running out to the right, and the west bank's snow filling the lower left, where the count stands.
 */
function colsPose(): Pose {
  return { pos: [640, T2 - 20, 300], aim: [1260, T2 + 1090, 20], fov: 42 };
}

const PAST = 54;

/** A place on the canyon's middle line, d along it from the glacier's front. */
function canyonAt(d: number): [number, number] {
  const r = CANYON.r;
  const q = (Math.PI * r) / 2;
  const a = BENDS[0].y - CANYON.y0;
  const b = BENDS[1].x - BENDS[0].x;
  if (d < a) return [1300, CANYON.y0 + d];
  d -= a;
  if (d < q) return [BENDS[0].x - r * Math.cos(d / r), BENDS[0].y + r * Math.sin(d / r)];
  d -= q;
  if (d < b) return [BENDS[0].x + d, BENDS[0].y + r];
  d -= b;
  if (d < q) return [BENDS[1].x + r * Math.sin(d / r), BENDS[1].y - r * Math.cos(d / r)];
  return [BENDS[1].x + r, BENDS[1].y + d - q];
}

/**
 * The flight through the canyon: low on its middle line, looking well down
 * it (so the water leads away, both walls stand in the frame and the day
 * shows at the far end), banking into each bend; held on the straight
 * between them, where the polished face is seen whole.
 */
function canyonKeys(s8: number, fov: number, g = 1): Key[] {
  // (An upright screen keeps its words at the foot: the face is held above the middle, from further back so it is seen whole.)
  const tall = fov > 60;
  // (On a wide screen the eye looks up a little: the wall's foot is under the frame, so the lower left, where the words stand, is the wall's own ice alone.)
  const face: V3 = tall ? [FACE.x, FACE.y, FACE.z + FACE.h * 0.5 - 44] : [FACE.x, FACE.y + 105, FACE.z + FACE.h * 0.5 + (g < 1 ? -24 : 36)];
  const past = tall ? 75 : PAST;
  //            scroll, along, height, bank, looks at the face, how far left of the middle line (the outside of a bend sees furthest down the next reach)
  const run: [number, number, number, number, boolean, number][] = [
    [0.8, 40, 112, 0, false, 0],
    [1.05, 300, 98, 0, false, 20],
    [1.25, 500, 96, 4, false, 46],
    [1.45, 700, 94, 5, false, 30],
    // (Through the hall the eye goes on toward the face the whole time its words stand: the picture in the wall grows.)
    [1.65, (tall ? 796 : 972) - past * 0.55 * g, 93, 0, true, 0],
    [2.2, tall ? 796 : 972, 94, 0, true, 0],
    [2.8, (tall ? 796 : 972) + past * 0.6 * g, 94, 0, true, 0],
    [2.98, 1200, 94, -4, false, -40],
    [3.15, 1380, 94, -5, false, -24],
    [3.35, 1580, 112, 0, false, 0],
  ];
  return run.map(([ds, d, z, roll, toFace, left]) => {
    const [x0, y0] = canyonAt(d);
    const [x1, y1] = canyonAt(d + 2);
    const x = x0 - ((y1 - y0) / 2) * left;
    const y = y0 + ((x1 - x0) / 2) * left;
    const [ax, ay] = canyonAt(d + 340);
    const key: Key = { s: s8 + ds, pos: [x, y, z] as V3, aim: toFace ? face : ([ax, ay, z - 4] as V3), fov, roll };
    // (In the hall the eye goes at one steady pace toward the face: these keys say so themselves, as a station's move does.)
    if (toFace) key.v = { pos: [((x1 - x0) / 2) * past * g, ((y1 - y0) / 2) * past * g, 0], aim: [0, 0, 0], fov: 0, roll: 0 };
    return key;
  });
}

const slabAim: V3 = [SLAB.x, SLAB.y, SLAB.h * 0.5];
/** Registration order is the scroll order. A layout selects an existing server-rendered words block. */
export const FLIGHT = [
  {
    id: 'hero', paint: paintLake, rail: 'Arav Jain', length: 2.4, offset: 0, kind: 'section', layout: 'opening',
    camera: ({ opening }) => opening(),
  },
  {
    id: 'say', paint: paintReach, rail: 'What I do', length: 2.2, offset: 0.7, kind: 'section', layout: 'statement',
    camera: ({ stop, end, upright, reach }) => upright ? [
      // The statement: the near bank fills the foot of the frame, the river crosses beyond it; the eye goes on down the reach.
      reach(1.98, 2060),
      reach(stop, 2640),
      reach(end - 0.5, 3150),
    ] : [
      // Over the river's mouth, already turned to the first reach: the bank his sentence stands on fills the lower
      // left of the frame from here, so the sentence can begin this early; and the eye goes on down the reach the
      // whole time the sentence sets, the river running past on its right.
      reach(1.96, 2140),
      reach(stop, 2720),
      reach(end - 0.5, 3230),
    ],
  },
  {
    id: 'infiniview', paint: paintBasin, rail: 'Infiniview', length: 2.6, offset: 1, kind: 'title', layout: 'display',
    subject: { bit: 2, define: 'F_SLAB', boxes: [SLAB_GROUND], pass: 'slab', visible: slabVisible,
      silhouette: (cam, aspect) => {
        const frame = slabInFrame(cam, aspect);
        return frame.behind === 0 ? frame.box : null;
      }, shader: { source: BASIN_OBJECT, fn: 'slabHit' } },
    project: 'infiniview',
    hold: { name: 'Infiniview' },
    camera: ({ stop, end, upright, move, holdKeys }) => upright ? [
      // The basin: the slab stands above the middle, bank at the foot.
      ...holdKeys(move({ pos: [1010, 3450 + DY, 460], aim: [slabAim[0] - 20, slabAim[1] - 60, 40], fov: 50 }, 0.5, 0.6, 0.14, 3, 2), stop),
      // Out past the island's left side, so the slab is never flown through.
      { s: end - 0.1, pos: [900, 4900 + DY, 330], aim: [1250, 5900 + DY, 0], fov: 54 },
    ] : [
      // The basin: slab and island right of centre, the bank at lower left. The eye closes on the block and goes a little round it.
      ...holdKeys(move({ pos: [930, 4110 + DY, 300], aim: [slabAim[0] - 250, slabAim[1], 105], fov: 42 }, 0.4, 0.72, 0.14, 4.5, 0), stop),

      // Out wide of the island's left side: the slab leaves the frame whole
      // and at a distance, never as an edge sliding past the lens.
      { s: end - 0.1, pos: [780, 4950 + DY, 250], aim: [1180, 5900 + DY, 0], fov: 42 },
    ],
  },
  {
    steps: { eyebrow: -1.3 },
    id: 'upstream', paint: paintConfluence, rail: 'Open source', length: 2.8, offset: 1.25, kind: 'figure', layout: 'contributions',
    subject: { bit: 4, define: 'F_CONF', boxes: [CONF_RIVER_BOX], pass: 'confluence', wholeWhen: confNearCam, combine: true, shader: { source: CONFLUENCE, fn: 'confLift' } },
    project: 'open-source',
    hold: { name: 'Upstream' },
    camera: ({ start, stop, aspect, upright, band, move, holdKeys }) => upright ? [
      { s: start + 0.35, pos: [1380, 5700 + DY, 330], aim: [1560, 6300 + DY, 0], fov: 56 },
      // The confluence, from over the west bank of the river that comes to it: the streams above, the river across the
      // middle, and the bank at the foot wide enough for the count and, beside it, the seven names.
      // (A squarer upright screen has less height for the bank: it looks down a little more, so the words keep clear of the river.)
      ...holdKeys(band ? move({ pos: [1700, 5760 + DY, 590], aim: [1730, 7090 + DY - 250 * Math.min(1, Math.max(0, (aspect - 0.465) / 0.035)), 0], fov: 60 }, 0.5, 0.6, 0.15, 2, 3) : move({ pos: [1000, 5500 + DY, 700], aim: [1750, 6930 + DY - 250 * Math.min(1, Math.max(0, (aspect - 0.465) / 0.035)), 0], fov: 58 }, 0.5, 0.53, 0.15, 2, 2), stop),
    ] : [
      { s: start + 0.35, pos: [1400, 5720 + DY, 230], aim: [1620, 6350 + DY, 0], fov: 46 },
      // The confluence: the cliff and its seven falls across the frame, the river along its foot, the near bank below.
      // The eye rises over the bank and closes on the cliff: the snowfield and its streams open out above the falls.
      ...holdKeys(move({ pos: [1380, 5950 + DY, 330], aim: [1730, 7000 + DY, -118], fov: 52 }, 0.48, 0.52, 0.18, 2, 3), stop),
    ],
  },
  {
    id: 'bench', paint: paintPool, rail: 'Kilo Bench', length: 2.6, offset: 1.15, kind: 'title', layout: 'table',
    subject: { bit: 8, define: 'F_POOL', boxes: [POOL_BOX], pass: 'pool', wholeWhen: poolNearCam, combine: true, shader: { source: ROCK_POOL, fn: 'rockHit' } },
    project: 'kilo-bench',
    hold: { name: 'Kilo Bench' },
    camera: ({ start, stop, aspect, upright, move, holdKeys }) => upright ? [
      { s: start + 0.25, pos: [900, 7700 + DY, 380], aim: [1100, 8500 + DY, 0], fov: 58 },
      // The rock pool, looked down into from over its near bank: the plates across the frame, the bank at the foot.
      ...holdKeys(move(benchPose(aspect), 0.5, 0.62, 0.13, 0, -2, -36), stop),
    ] : [
      // Down the bigger river.
      { s: start + 0.25, pos: [860, 7650 + DY, 300], aim: [1000, 8500 + DY, 0], fov: 46 },
      // The rock pool from low over its near bank: the plates right of the words, the far shore, the tarn and the ranges above.
      ...holdKeys(move(benchPose(aspect), 0.44, 0.8, 0.128, 3, 0), stop),
    ],
  },
  {
    // A beat of words alone, in the run from the pool to the tarn (Ask Around: the world has no place for it yet).
    // No subject, no paint and no camera key: the eye goes on between its neighbours' keys, over this much more scroll.
    // (Its words stand on the bank the eye is flying over, and only while that bank's snow lies under them: they come once
    // the pool's rim has passed and have left before the tarn's water reaches them.)
    // (Measured with scripts/titles-test.mjs: that stretch is about half a screen at this pace. Its label leads, as a station's does.)
    steps: { eyebrow: -0.75, title: -0.25, line: -0.17, leave: 0.25 },
    id: 'around', rail: 'Ask Around', length: 1.3, offset: 0.45, kind: 'section', layout: 'beat',
    camera: () => [],
  },
  {
    id: 'bridge', paint: paintTarn, rail: 'Agent Bridge', length: 2.8, offset: 1.2, kind: 'title', layout: 'film',
    subject: { bit: 16, define: 'F_SHARDS', boxes: [SHARDS_BOX], pass: 'shards', visible: tarnNear, shader: { source: TARN_OBJECT, fn: 'shardHit' } },
    project: 'agent-bridge',
    hold: { name: 'Agent Bridge' },
    camera: ({ start, stop, aspect, upright, band, move, holdKeys }) => upright ? [
      { s: start + 0.3, pos: [1200, 9650 + DY, 360], aim: [1300, 10500 + DY, 0], fov: 58 },
      // The tarn, from low over its near shore: both shards stand against the sky above the middle, the words below on the bank.
      // (The eye closes on the point of the shore nearest the name, which keeps its place: the water never comes under the words.)
      ...holdKeys(move({ pos: [1560, 9750 + DY, 70], aim: [1580, 10900 + DY, -25], fov: 58 }, 0.56, 0.65, 0.3, -4.5, 0), stop),
    ] : [
      { s: start + 0.3, pos: [1150, 9700 + DY, 300], aim: [1300, 10500 + DY, 0], fov: 46 },
      // The tarn, from low on its south-west bank (see tarnPose).
      // (The eye goes round the edge of the bank the words stand on, which keeps its place: the two shards and the ranges slide across the water, away from the words.)
      ...holdKeys(band ? move(tarnBand(aspect), 0.3, 0.8, 0.1, 2, 0) : move(tarnPose(), 0.5, 0.51, 0.1, 9, 0), stop),
    ],
  },
  {
    steps: { eyebrow: -1.3 },
    id: 'models', paint: paintShallows, rail: 'Open models', length: 2.8, offset: 1.2, kind: 'figure', layout: 'downloads',
    subject: { bit: 32, define: 'F_COLS', boxes: [COLS_BOX, COLS_DEEP], pass: 'columns', proximity: { lane: 0, x: 1340, y: COLS.y, from: 1750, to: 2350 }, shader: { source: COLUMNS, fn: 'columns' } },
    project: 'ollama',
    bandLift: 0.1,
    hold: { name: 'Open models' },
    camera: ({ start, stop, end, upright, band, move, holdKeys }) => upright ? [
      { s: start + 0.3, pos: [1300, T2 - 250, 400], aim: [1300, T2 + 600, 0], fov: 56 },
      // Down the row from its tall end, so all four stand in an upright frame.
      ...holdKeys(move({ pos: [420, T2 + 380, 470], aim: [1235, T2 + 1110, 60], fov: 58 }, 0.46, 0.72, 0.18, -3, 0), stop),
      // Past the dam's east end, turning to look back at it.
      { s: end - 0.1, pos: [1560, T2 + 1750, 420], aim: [1300, T2 + 2550, 20], fov: 58 },
    ] : [
      { s: start + 0.3, pos: [1300, T2 - 300, 300], aim: [1300, T2 + 600, 0], fov: 44 },
      // The four seracs from over the shallows' west bank; the eye goes round the row, so each stands clear of the next.
      ...holdKeys(band ? move({ pos: [760, T2 + 60, 250], aim: [1310, T2 + 1080, 96], fov: 42 }, 0.3, 0.8, 0.1, 2, 0) : move(colsPose(), 0.46, 0.62, 0.175, 5, 0), stop),
      // Past the dam's east end, turning to look back at it.
      { s: end - 0.1, pos: [1520, T2 + 1720, 280], aim: [1300, T2 + 2520, 20], fov: 46 },
    ],
  },
  {
    steps: { eyebrow: -1.3, title: -0.45, line: -0.32, meta: -0.2 },
    id: 'fork', paint: paintDam, rail: 'cc-switch', length: 2.8, offset: 1.2, kind: 'title', layout: 'switch',
    subject: { bit: 64, define: 'F_DAM', boxes: [DAM_BOX], pass: 'dam', proximity: { lane: 1, x: 1300, y: DAM.y, from: 3300, to: 4000 }, shader: { source: [DAM_ICE, DAM_WATER].join('\n'), fn: 'dam' } },
    project: 'cc-switch',
    hold: { name: 'cc-switch', before: 0.45 },
    camera: ({ start, stop, end, upright, move, holdKeys }) => upright ? [
      // (Wide of its east end and well over it, already looking back: the wall is never an edge sliding past the lens.)
      { s: start + 0.38, pos: [2330, T2 + 3420, 720], aim: [1340, T2 + 2850, 0], fov: 60 },
      // From the east bank below it: the dam across the frame, its three sluices, the channels running out toward the eye; the bank at the foot.
      // (Further out on the bank, so the running channel passes above the words and snow lies under them.)
      ...holdKeys(move({ pos: [2520, T2 + 4380, 900], aim: [1330, T2 + 2960, 0], fov: 62 }, 0.5, 0.56, 0.145, 3, 0), stop, 0.45),
      // Across the three channels where they meet, turning with the water to look down the river again.
      { s: end - 0.2, pos: [1400, T2 + 3620, 700], aim: [700, T2 + 3720, 0], fov: 60 },
    ] : [
      // (Wide of its east end and well over it, already looking back: the wall is never an edge sliding past the lens.)
      { s: start + 0.38, pos: [2200, T2 + 3150, 500], aim: [1420, T2 + 2810, 10], fov: 45 },
      // From the east bank below it: the dam across the frame, the open sluice's water coming toward the eye, the bank at lower left.
      ...holdKeys(move({ pos: [2130, T2 + 3800, 640], aim: [1520, T2 + 2900, 0], fov: 42 }, 0.45, 0.58, 0.175, -4, 0), stop, 0.45),
      // Across the three channels where they meet, turning with the water to look down the river again.
      { s: end - 0.25, pos: [1620, T2 + 3560, 400], aim: [1120, T2 + 3840, 0], fov: 45 },
    ],
  },
  {
    id: 'lattice', paint: paintLattice, rail: 'TensorPoW', length: 2.6, offset: 1.15, kind: 'title', layout: 'pool',
    subject: { bit: 128, define: 'F_LAT', boxes: [LAT_BOX], pass: 'lattice', proximity: { lane: 2, x: LATTICE.x, y: LATTICE.y, from: 2300, to: 2900 }, shader: { source: LATTICE_ICE, fn: 'lattice' } },
    project: 'tensorpow',
    bandLift: 0.05,
    hold: { name: 'TensorPoW' },
    camera: ({ start, stop, upright, move, holdKeys }) => upright ? [
      // The lattice from up the west bank: all sixteen above the middle, the bank at the foot.
      ...holdKeys(move({ pos: [500, T2 + 2930, 930], aim: [1350, T2 + 4480, 0], fov: 58 }, 0.5, 0.62, 0.14, 4, 0), stop),
    ] : [
      { s: start + 0.3, pos: [800, T2 + 3660, 420], aim: [920, T2 + 4380, 10], fov: 44 },
      // The lattice from over its west bank, corner on: every cube and its mirror image. The eye goes round it, and the rows open and close.
      // (Turned a little to the left, so the bank at lower left is wide enough for the name to stand on snow alone.)
      ...holdKeys(move({ pos: [500, T2 + 3800, 640], aim: [1085, T2 + 4625, 0], fov: 45 }, 0.4, 0.7, 0.14, 6, 0), stop),
    ],
  },
  {
    steps: { eyebrow: -2.15, leave: 0.75 },
    id: 'canyon', paint: paintCanyon, rail: 'RydAR', length: 3.6, offset: 2.2, kind: 'title', layout: 'wall',
    subject: { bit: 256, define: 'F_CANYON', boxes: [CANYON_BOX], pass: 'canyon', proximity: { lane: 3, x: 1700, y: (CANYON.y0 + CANYON.y1) / 2, from: 3700, to: 4600 }, shader: { source: CANYON_ICE, fn: 'canyon' } },
    project: 'rydar',
    hold: { name: 'RydAR', after: 0.6 },
    camera: ({ start, upright, g }) => upright ? [
      { s: start + 0.3, pos: [1300, T2 + 4900, 230], aim: [1300, T2 + 5700, 90], fov: 60 },
      ...canyonKeys(start, 66, g),
    ] : [
      { s: start + 0.3, pos: [1300, T2 + 4960, 170], aim: [1300, T2 + 5700, 90], fov: 48 },
      ...canyonKeys(start, 50, g),
    ],
  },
  {
    steps: { leave: 1.75 },
    id: 'delta', paint: paintDelta, rail: 'Interests', length: 2.6, offset: 1.1, kind: 'section', layout: 'interests',
    hold: { name: 'Interests' },
    camera: ({ ending }) => ending(false),
  },
  {
    id: 'sea', rail: 'Contact', length: 2.3, offset: 1.3, kind: 'section', layout: 'ending',
    camera: ({ ending }) => ending(true),
  },
] as const satisfies readonly Definition[];

export type SectionId = typeof FLIGHT[number]['id'];
export type ProjectScene = Extract<typeof FLIGHT[number], { project: string }>['project'];
function buildTimeline(definitions: readonly Definition[]) {
  const ids = new Set<string>();
  const features = new Set<string>(['SEA', 'F_FIELD', 'F_ICE', 'F_NAME']);
  let bits = 1 | 512 | 1024 | 2048;
  let end = 0;
  return definitions.map(definition => {
    const { id, length, offset, subject } = definition;
    if (ids.has(id) || !Number.isFinite(length) || !(offset >= 0 && offset < length)) throw new Error(`Invalid flight section ${id}`);
    ids.add(id);
    if (subject) {
      const { bit, define, event } = subject;
      if (!Number.isInteger(Math.log2(bit)) || bit >= 2 ** 31 || (bits & bit) || features.has(define) || !/^F_[A-Z][A-Z0-9_]*$/.test(define)) {
        throw new Error(`Invalid or repeated shader feature for ${id}: ${define}, bit ${bit}`);
      }
      if (event && !(0 <= event[0] && event[0] < event[1] && event[1] <= length)) throw new Error(`Invalid event interval for ${id}`);
      bits |= bit;
      features.add(define);
    }
    const start = end;
    end += length;
    return { ...definition, start, stop: start + offset, end };
  });
}
export const timeline = buildTimeline(FLIGHT);
export const byId = Object.fromEntries(timeline.map(entry => [entry.id, entry])) as Record<SectionId, typeof timeline[number]>;
export const SECTIONS = Object.fromEntries(FLIGHT.map(entry => [entry.id, entry.length])) as Record<SectionId, number>;
export const projectsInFlight = FLIGHT.flatMap(entry => 'project' in entry ? [entry.project] : []);
export const sceneOf = (slug: string) => projectsInFlight.find(project => project === slug);
export const composed = Object.fromEntries(timeline.map(entry => [entry.id, entry.stop])) as Record<SectionId, number>;

export const subjects = timeline.flatMap(entry => entry.subject ? [{ ...entry.subject, start: entry.start }] : []);
export const customSubjects = subjects.filter(subject => !subject.pass);
export const events = subjects.flatMap(subject => subject.event ? [{
  uniform: 'uProgress_' + subject.define,
  from: subject.start + subject.event[0],
  to: subject.start + subject.event[1],
}] : []);
export const proximity = subjects.flatMap(subject => subject.proximity ? [subject.proximity] : []);
export const starts = Object.fromEntries(timeline.map(entry => [entry.id, entry.start])) as Record<SectionId, number>;
