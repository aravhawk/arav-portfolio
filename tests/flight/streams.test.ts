import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAM_STRIDE, type StreamIndex } from '@/flight/types';
import { END_AT, SETTLE_AT, stillStops } from '@/water/camera';

/**
 * What the home page plays (public/flight, made by tools/flight) must agree
 * with itself and with the flight it was rendered from: an index that does
 * not match its stream plays garbage, and frames rendered for another
 * timeline put the words over the wrong picture.
 */

const DIR = join(process.cwd(), 'public', 'flight');
const SETS = ['wide-day', 'wide-night', 'tall-day', 'tall-night'];
const CODECS = ['av1', 'hevc'];
/** The whole of public/flight may weigh this much. */
const LIMIT_MB = 92;
/** Of that, the live layer's masks may weigh this much. */
const MASKS_MB = 6;

const index = (set: string, codec: string) => JSON.parse(readFileSync(join(DIR, `${set}.${codec}.json`), 'utf8')) as StreamIndex;

describe('the pre-rendered flight', () => {
  it('weighs 92 MB or less in all', () => {
    const total = readdirSync(DIR).reduce((sum, f) => sum + statSync(join(DIR, f)).size, 0);
    expect(total / 1048576).toBeLessThanOrEqual(LIMIT_MB);
  });

  for (const set of SETS) {
    for (const codec of CODECS) {
      describe(`${set}.${codec}`, () => {
        const ix = index(set, codec);
        it('has an index that accounts for every byte of its stream', () => {
          let at = 0;
          for (const t of ix.tracks) {
            expect(t.at).toBe(at);
            at += t.sizes.reduce((a, b) => a + b, 0);
          }
          expect(statSync(join(DIR, `${set}.${codec}`)).size).toBe(at);
        });
        it('has the tracks the player plays, a keyframe every half screen', () => {
          const ids = ix.tracks.map((t) => t.id);
          for (const id of ['enter', 'main', 'dawn', 'after']) expect(ids).toContain(id);
          const main = ix.tracks.find((t) => t.id === 'main')!;
          expect(main.per).toBe(30);
          expect(main.key).toBeLessThanOrEqual(main.per! / 2);
        });
        it('was rendered for the flight as it is now', () => {
          const main = ix.tracks.find((t) => t.id === 'main')!;
          // (A phone's screen is a fraction of a pixel off a whole number of screens: within a frame.)
          expect(Math.abs((main.sizes.length - 1) / main.per! - END_AT)).toBeLessThan(1.5 / main.per!);
          const after = ix.tracks.find((t) => t.id === 'after')!;
          expect(after.from!).toBeLessThan(SETTLE_AT - 1);
          expect(Math.abs(after.from! + (after.sizes.length - 1) / after.per! - END_AT)).toBeLessThan(1.5 / after.per!);
        });
      });
    }
    it(`${set}: the two streams have the same frames`, () => {
      const a = index(set, 'av1');
      const b = index(set, 'hevc');
      expect(a.tracks.map((t) => [t.id, t.sizes.length, t.from ?? t.fps])).toEqual(b.tracks.map((t) => [t.id, t.sizes.length, t.from ?? t.fps]));
    });
    it(`${set}: a still for every section`, () => {
      for (let n = 0; n < stillStops().length; n++) expect(existsSync(join(DIR, `${set}.still-${n}.avif`))).toBe(true);
    });
  }
  for (const shape of ['wide', 'tall']) {
    it(`${shape}: a camera for every frame and every still`, () => {
      const frames = index(`${shape}-day`, 'av1').tracks.find((t) => t.id === 'main')!.sizes.length;
      expect(statSync(join(DIR, `${shape}.cam`)).size).toBe(frames * CAM_STRIDE * 4);
      expect(statSync(join(DIR, `${shape}.still.cam`)).size).toBe(stillStops().length * CAM_STRIDE * 4);
    });
  }
  for (const shape of ['wide', 'tall']) {
    it(`${shape}: a mask for every frame of the flight, on the sheets its index names`, () => {
      const ix = JSON.parse(readFileSync(join(DIR, `${shape}.mask.json`), 'utf8')) as { w: number; h: number; cols: number; rows: number; per: number; step: number; from: number; n: number; sheets: number; frames: number };
      const main = index(`${shape}-day`, 'av1').tracks.find((t) => t.id === 'main')!;
      // (The live layer looks a mask up by the frame's number: the masks must be the frames the stream plays.)
      expect(ix.frames).toBe(main.per);
      expect(ix.from).toBe(main.from ?? 0);
      expect(ix.n).toBe(Math.ceil(main.sizes.length / ix.step));
      expect(ix.sheets).toBe(Math.ceil((ix.n - 1) / ix.per));
      // (A sheet holds its masks and the first of the next, so two neighbours are always on one sheet.)
      expect(ix.cols * ix.rows).toBeGreaterThanOrEqual(ix.per + 1);
      for (let k = 0; k < ix.sheets; k++) expect(existsSync(join(DIR, `${shape}.mask-${k}.webp`))).toBe(true);
      expect(readdirSync(DIR).filter((f) => f.startsWith(`${shape}.mask-`)).length).toBe(ix.sheets);
    });
  }
  it('has masks that weigh 6 MB or less in all', () => {
    const total = readdirSync(DIR).filter((f) => f.includes('.mask')).reduce((sum, f) => sum + statSync(join(DIR, f)).size, 0);
    expect(total / 1048576).toBeLessThanOrEqual(MASKS_MB);
  });
  it('has the first paint for every shape, scheme and format the page names', () => {
    for (const theme of ['day', 'night']) {
      for (const type of ['avif', 'webp']) {
        expect(existsSync(join(DIR, `tall-${theme}.poster.${type}`))).toBe(true);
        for (const w of [1280, 1920, 2560]) expect(existsSync(join(DIR, `wide-${theme}.poster-${w}.${type}`))).toBe(true);
      }
    }
  });
});
