import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PROJECTS } from '@/content/projects';
import { nextPic, stillSize, stillSrc } from '@/components/work/still-pictures';
import { sceneOf } from '@/water/registry';

/** The size a WebP file says it is (VP8, VP8L or VP8X header). */
function webpSize(file: string) {
  const b = readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  const bits = b.readUInt32LE(21);
  return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff) };
}

const scenes = [...new Set([...PROJECTS.map((p) => sceneOf(p.slug)).filter((s): s is NonNullable<typeof s> => !!s), 'delta', 'lake', 'snow'])];

/**
 * A still's picture reserves its place from the size written in
 * still-pictures.tsx. These fail when a still is re-shot at another size, or
 * a scene is added without its files, before a page shifts or shows a gap.
 */
describe('the scenes’ stills', () => {
  it('every scene has its wide and upright still in both themes, at the size the picture reserves', () => {
    for (const scene of scenes) {
      for (const shape of ['wide', 'tall'] as const) {
        for (const theme of ['light', 'dark'] as const) {
          const file = join(process.cwd(), 'public', stillSrc(scene, shape, theme));
          expect(existsSync(file), file).toBe(true);
          const { w, h } = stillSize(scene, shape);
          expect(webpSize(file), file).toEqual({ w, h });
        }
      }
    }
  });

  it('the way on is served from the smallest phone to the whole file, and no wider', () => {
    const tall = nextPic('lake', 'bandtall', 'light');
    const widths = tall.srcSet.split(', ').map((entry) => parseInt(entry.split(' ')[1], 10));
    expect(widths[0]).toBe(640);
    expect(widths.filter((w) => w >= 1170)).toHaveLength(1);
    for (const shape of ['band', 'bandtall'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        const file = join(process.cwd(), 'public', stillSrc('lake', shape, theme));
        expect(webpSize(file), file).toEqual(stillSize('lake', shape));
      }
    }
  });
});
