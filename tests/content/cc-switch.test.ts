import { describe, expect, it } from 'vitest';

import { CC_SWITCH_SINCE } from '@/content/projects';
import { NPM_PACKAGES } from '@/lib/metrics/config';
import { countAt } from '@/lib/count-up';

describe('cc-switch downloads', () => {
  it('say the day the count starts, and it is the package\'s first publish', () => {
    const pkg = NPM_PACKAGES.find((p) => p.name === '@aravhawk/cc-switch');
    expect(pkg).toBeDefined();
    const day = new Date(`${pkg!.firstPublished}T00:00:00Z`);
    const said = day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    expect(CC_SWITCH_SINCE).toBe(said);
  });
});

describe('a count-up', () => {
  it('stays between its two ends and never goes below zero, whatever the clock says', () => {
    // The ticker once drew -571 on its way from 645 to 712 when a frame's time came before the count's start.
    for (const [from, value] of [[645, 712], [712, 645], [10066, 10145], [0, 5], [5, 0]]) {
      for (const t of [-20, -1.09, -0.5, -0.0001, 0, 0.25, 0.5, 1, 1.5, NaN, Infinity, -Infinity]) {
        const n = countAt(from, value, t);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeGreaterThanOrEqual(Math.min(from, value));
        expect(n).toBeLessThanOrEqual(Math.max(from, value));
      }
      expect(countAt(from, value, 1)).toBe(value);
    }
  });

  it('starts at the snapshot and ends on the live value', () => {
    expect(countAt(645, 712, 0)).toBe(645);
    expect(countAt(645, 712, 1)).toBe(712);
    expect(countAt(645, 712, -1.09)).toBe(645);
  });
});
