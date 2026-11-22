import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The display face and the mono are served as a Latin cut (layout.tsx), with
 * the whole font fetched only for a character the cut leaves out
 * (globals.css). The site's own text should never need that second file:
 * this fails when a character outside the cut is written into the copy or
 * the components, so it is a choice and not an accident. (The same ranges
 * are in scripts/font-cuts.sh.)
 */
const CORE: Array<[number, number]> = [
  [0x09, 0x0d],
  [0x20, 0x7e],
  [0xa0, 0xbf],
  [0x2010, 0x202f],
  [0x2190, 0x2199],
  [0x2212, 0x2212],
  [0x2713, 0x2713],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
];
const inCore = (cp: number) => CORE.some(([a, b]) => cp >= a && cp <= b);

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      // (The lab is not shipped as a page of the site, and a shader is not text anyone reads.)
      if (!/\/(lab|shaders|fonts)$/.test(path)) files(path, out);
    } else if (/\.(tsx?|mdx?|css)$/.test(name)) out.push(path);
  }
  return out;
}

describe('the fonts’ Latin cuts', () => {
  it('hold every character the site’s own text sets', () => {
    const outside: string[] = [];
    for (const file of [...files(join(process.cwd(), 'src')), ...files(join(process.cwd(), 'content'))]) {
      for (const ch of new Set(readFileSync(file, 'utf8'))) {
        const cp = ch.codePointAt(0)!;
        if (!inCore(cp)) outside.push(`U+${cp.toString(16).toUpperCase().padStart(4, '0')} in ${file.replace(process.cwd() + '/', '')}`);
      }
    }
    expect(outside).toEqual([]);
  });

  it('what the whole font is fetched for is exactly what the cut leaves out', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const ranges = [...css.matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => m[1]);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toBe(ranges[1]);
    const wide = ranges[0].split(',').map((r) => {
      const [a, b] = r.trim().replace('U+', '').split('-');
      return [parseInt(a, 16), parseInt(b ?? a, 16)] as [number, number];
    });
    const inWide = (cp: number) => wide.some(([a, b]) => cp >= a && cp <= b);
    // Every code point of the basic plane (private use and controls aside) belongs to one face and not both.
    for (let cp = 0x20; cp <= 0xfffd; cp++) {
      if ((cp >= 0x7f && cp <= 0x9f) || (cp >= 0xd800 && cp <= 0xf8ff) || cp === 0xfffe || cp === 0xffff) continue;
      if (inCore(cp) === inWide(cp)) throw new Error(`U+${cp.toString(16)} is in ${inCore(cp) ? 'both faces' : 'neither face'}`);
    }
  });
});
