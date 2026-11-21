import { describe, expect, it } from 'vitest';

import { pack, unpack } from '@/components/Held';

/**
 * A held picture carries its widths once (`data-set`) and Runtime.tsx
 * writes the list out again. What comes out must be the list that went
 * in, to the letter: it is the picture's `srcset`.
 */
describe('a held picture\'s widths', () => {
  const list = [384, 640, 750, 828, 1080, 1200, 1920].map((w) => `/_next/image?url=%2Fmedia%2Fscenes%2Fdelta-wide-light.webp&w=${w}&q=90 ${w}w`).join(', ');

  it('packs the optimiser\'s list and gives the same list back', () => {
    const set = pack(list);
    expect(set).toBe('/_next/image?url=%2Fmedia%2Fscenes%2Fdelta-wide-light.webp|90|384,640,750,828,1080,1200,1920');
    expect(unpack(set!)).toBe(list);
  });

  it('carries any other list whole', () => {
    expect(pack(undefined)).toBeNull();
    expect(pack('/a.webp 1x, /b.webp 2x')).toBeNull();
    expect(pack('/_next/image?url=%2Fa.webp&w=640&q=90 640w, /_next/image?url=%2Fb.webp&w=750&q=90 750w')).toBeNull();
    expect(pack('/_next/image?url=%2Fa.webp&w=640&q=75 640w, /_next/image?url=%2Fa.webp&w=750&q=90 750w')).toBeNull();
  });

  it('Runtime.tsx writes the list out the way unpack does', async () => {
    const { readFileSync } = await import('node:fs');
    const runtime = readFileSync('src/components/Runtime.tsx', 'utf8');
    expect(runtime).toContain("widths.split(',').map((w) => `${base}&w=${w}&q=${q} ${w}w`).join(', ')");
  });
});
