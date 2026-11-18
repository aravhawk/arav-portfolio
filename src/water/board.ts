/**
 * The results on the rock pool's bed, set as type.
 *
 * The table (world.ts: BOARD_HEAD, BOARD_ROWS, a transcription of the
 * published picture) is drawn here in the site's own mono face as a mask:
 * how much of each place a letter covers. The shading pass lays that mask
 * on the slab under the water and draws its edges a device pixel wide, so
 * the type is type at every size.
 *
 * The slab lies flat and is read from a camera that looks across it, which
 * foreshortens it: the far rows more than the near ones. As the name on the
 * lake is cut for the first camera, each row of the table is set taller
 * than true by exactly what its camera takes away, so its letters read at
 * their own proportions from where they are read.
 */

import { type Pose, basisOf, flightKeys, poseAt, projectPoint, stillStops } from './camera';
import { BOARD, BOARD_CH, BOARD_DEPTH, BOARD_DOT, BOARD_HEAD, BOARD_ROWS, SHEET, boardEdges, boardRun, boardSpan, sheetCols } from './world';

/** How far under the land the table is seen to lie (the water's surface, and the water over it as the eye sees it). */
const SEEN_DEPTH = 46;
/** The mono face's capitals, as a share of its size. */
const CAP = 0.727;

/** Where each line of the table lies, from its far edge: the header, then the rows. */
export const boardLines = (): number[] => [BOARD.head / 2, ...BOARD_ROWS.map((_, i) => BOARD.head + BOARD.row * (i + 0.5))];

/**
 * How much taller than true each line is set for the camera that reads it:
 * a square on that line is drawn in the frame this much wider than it is
 * tall. Never more than a line has room for.
 */
export function boardStretch(pose: Pose, aspect: number): number[] {
  const room = (Math.min(BOARD.head, BOARD.row) * 0.6) / (BOARD.em * CAP);
  const cam = basisOf(pose);
  const x = SHEET.x0 + boardSpan(2) / 2;
  return boardLines().map((at) => {
    const y = SHEET.y + BOARD_DEPTH / 2 - at;
    const p = (dx: number, dy: number) => projectPoint(cam, [x + dx, y + dy, -SEEN_DEPTH], aspect);
    const [ax, ay] = p(-5, 0);
    const [bx, by] = p(5, 0);
    const [cx, cy] = p(0, -5);
    const [ex, ey] = p(0, 5);
    const wide = Math.hypot((bx - ax) * aspect, by - ay);
    const deep = Math.hypot((ex - cx) * aspect, ey - cy);
    return Math.min(room, Math.max(1, wide / Math.max(deep, 1e-6)));
  });
}

// The face's alternate seven (its "ss17": a bar and a curved stem, where its first seven has a notched joint), at the
// table's weight, in the face's own units (2000 to the em, y up, 1200 wide). A canvas cannot ask a face for an alternate,
// so this one glyph is drawn from its outline.
const SEVEN = 'M349 0Q338 292 390 534Q443 776 538 950Q633 1123 747 1207Q767 1222 809 1238Q851 1254 882 1260H85V1454H980L1036 1289Q880 1170 780 992Q679 814 630 569Q582 323 582 0Z';

/**
 * The table as a mask, white on black, all five columns of it.
 * @param family the mono face's family, as the page's styles name it
 * @param perUnit how many of the mask's pixels there are to a world unit
 * @param stretch how much taller than true each line is set (see boardStretch)
 */
export function drawBoard(family: string, perUnit: number, stretch: number[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(64, Math.round(boardSpan(BOARD_HEAD.length) * perUnit));
  c.height = Math.max(32, Math.round(BOARD_DEPTH * perUnit));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const sx = c.width / boardSpan(BOARD_HEAD.length);
  const sy = c.height / BOARD_DEPTH;
  const edges = boardEdges();
  const lines = boardLines();
  const base = (BOARD.em * CAP) / 2;
  const seven = new Path2D(SEVEN);
  [BOARD_HEAD, ...BOARD_ROWS].forEach((row, r) => {
    // The line's own frame: its middle at 0, a unit a world unit across and `stretch` of one deep.
    const line = (x: number) => ctx.setTransform(sx, 0, 0, sy * (stretch[r] ?? 1), x * sx, lines[r] * sy);
    // (Every character stands in its own cell: the table keeps its measure whatever face the browser has drawn it in.)
    const set = (text: string, x0: number) => {
      let x = x0;
      for (const ch of text) {
        const cell = ch === '.' ? BOARD_DOT : BOARD_CH;
        if (ch === '7') {
          line(x);
          ctx.transform(BOARD.em / 2000, 0, 0, -BOARD.em / 2000, 0, base);
          ctx.fill(seven);
        } else {
          line(0);
          ctx.fillText(ch, x + cell / 2, base);
        }
        x += cell;
      }
    };
    line(0);
    ctx.font = `${r === 0 ? 500 : 480} ${BOARD.em}px ${family}`;
    row.forEach((text, i) => {
      if (i === 0) set(text, BOARD.pad);
      else if (r === 0 && i === 1) {
        // "Score" and its sort arrow: the arrow takes the last cell.
        set(text, edges[i] - boardRun(text) - 2 * BOARD_CH);
        line(0);
        const x = edges[i] - BOARD_CH / 2;
        const top = -base + BOARD.em * 0.04;
        const barb = BOARD.em * 0.2;
        ctx.lineWidth = BOARD.em * 0.085;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, base);
        ctx.moveTo(x - barb, base - barb);
        ctx.lineTo(x, base);
        ctx.lineTo(x + barb, base - barb);
        ctx.stroke();
      } else set(text, edges[i] - boardRun(text));
    });
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

/** The mono face as the page's styles name it. */
const monoFamily = () => getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'ui-monospace, Menlo, monospace';

/** Resolves once the mono face can be drawn (or, failing that, after a moment: the fallback face is drawn in the same cells). */
export async function boardReady(): Promise<void> {
  try {
    await Promise.race([document.fonts.load(`500 ${BOARD.em}px ${monoFamily()}`, [...BOARD_HEAD, ...BOARD_ROWS.flat()].join(' ')), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    // The fallback face is drawn instead.
  }
}

/**
 * The table's mask for a screen: set for the camera that composes the pool on a screen of this shape, and drawn fine
 * enough that one of its pixels is never larger than a device pixel there.
 * @param devW the picture's width in device pixels
 */
export function boardMask(aspect: number, devW: number): HTMLCanvasElement {
  const pose = poseAt(flightKeys(aspect), stillStops()[4]);
  const upright = aspect < 0.9;
  // (How many device pixels a world unit of the table's near edge takes in that frame, and half as much again.)
  const need = (1.6 * devW * (upright ? 0.92 : 0.56)) / boardSpan(sheetCols(aspect));
  return drawBoard(monoFamily(), Math.min(12, Math.max(4, need)), boardStretch(pose, aspect));
}
