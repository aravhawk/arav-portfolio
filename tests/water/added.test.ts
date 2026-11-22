import { describe, expect, it } from 'vitest';
import { END_AT, LIGHT_END, dayAt, dayOnLight, lightAt } from '@/water/camera';
import { vaultLitAt } from '@/water/moments';
import { byId, timeline } from '@/water/registry';
import { VAULT_SLIVERS } from '@/water/world';

/**
 * A station laid into the flight after its light was set (`added` in the registry) moves no other station's hour:
 * the light reads the scroll without it. And the vault's event belongs to the reader's arrival.
 */
describe('a station laid in later', () => {
  const added = timeline.filter((entry) => 'added' in entry && entry.added);
  const length = added.reduce((sum, entry) => sum + entry.length, 0);

  it('leaves the light of every other station where it was', () => {
    expect(added.length).toBeGreaterThan(0);
    expect(LIGHT_END).toBeCloseTo(END_AT - length, 9);
    for (const entry of timeline) {
      if (added.includes(entry)) continue;
      const before = added.filter((a) => a.start < entry.start).reduce((sum, a) => sum + a.length, 0);
      // (At its composed frame, and through the whole stretch its words stand.)
      for (const s of [entry.stop - 0.55, entry.stop, entry.stop + 0.75]) {
        expect(lightAt(s), `${entry.id} at ${s}`).toBeCloseTo(s - before, 9);
        expect(dayAt(s)).toBeCloseTo(dayOnLight(s - before), 9);
      }
    }
  });

  it('and the hour goes on through it, never back and never in a step', () => {
    let last = lightAt(0);
    for (let s = 0.01; s <= END_AT; s += 0.01) {
      const now = lightAt(s);
      expect(now - last).toBeGreaterThanOrEqual(0);
      expect(now - last).toBeLessThan(0.0101);
      last = now;
    }
  });

  it('the vault is rimed over as the eye sets out for it, and every sliver is lit by its composed frame', () => {
    const { start, stop, end } = byId.vault;
    expect(vaultLitAt(start)).toBe(0);
    expect(vaultLitAt(stop)).toBe(VAULT_SLIVERS.length);
    expect(vaultLitAt(end)).toBe(VAULT_SLIVERS.length);
    let last = 0;
    for (let s = start; s <= stop; s += 0.01) {
      const n = vaultLitAt(s);
      // (One at a time, in order: each is a note of its own.)
      expect(n - last === 0 || n - last === 1).toBe(true);
      last = n;
    }
  });
});
