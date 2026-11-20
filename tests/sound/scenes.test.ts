import { describe, expect, it } from 'vitest';

import { scenes } from '@/scene/flight/scenes';
import { BARE, SOUND } from '@/sound/scenes';

describe('a sound for every scene', () => {
  it('gives every scene in the registry its own line (add one in src/sound/scenes.ts)', () => {
    expect(scenes.map((s) => s.id).filter((id) => !SOUND[id])).toEqual([]);
  });
  it('keeps no line for a scene that is gone', () => {
    const ids = new Set(scenes.map((s) => s.id));
    expect(Object.keys(SOUND).filter((id) => !ids.has(id))).toEqual([]);
  });
  it('says how much of each thing, from 0 to 1', () => {
    for (const [id, sound] of [...Object.entries(SOUND), ['bare', BARE] as const]) {
      expect(Object.keys(sound).sort(), id).toEqual(['drift', 'fall', 'ice', 'lap', 'run', 'wind']);
      for (const [k, v] of Object.entries(sound)) {
        expect(v, `${id}.${k}`).toBeGreaterThanOrEqual(0);
        expect(v, `${id}.${k}`).toBeLessThanOrEqual(1);
      }
    }
  });
  it('has wind everywhere, and open water somewhere at the lake, the gap and the ending', () => {
    for (const sound of Object.values(SOUND)) expect(sound.wind).toBeGreaterThan(0.2);
    expect(SOUND.lake.lap).toBeGreaterThan(0);
    expect(SOUND.infiniview.fall).toBeGreaterThan(SOUND.infiniview.run);
    expect(SOUND.ending.lap).toBeGreaterThan(0);
    // The ice says most at the lake, and next most at the grid of blocks.
    const byIce = Object.entries(SOUND).sort((a, b) => b[1].ice - a[1].ice).map(([id]) => id);
    expect(byIce.slice(0, 2)).toEqual(['lake', 'tensorpow']);
  });
});
