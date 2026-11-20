import { expect, it } from 'vitest';
import { position, scenes, starts } from '@/scene/flight/scenes';

it('finishes each push before blending the next scene', () => {
  for (const [index, scene] of scenes.entries()) {
    const end = starts[index] + scene.screens;
    expect(position(end).index).toBe(index);
    expect(position(end).mix).toBe(0);
    if (index + 1 < scenes.length) {
      expect(position(end + scene.exit / 2).mix).toBeCloseTo(0.5);
    }
  }
});
