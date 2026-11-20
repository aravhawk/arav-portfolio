import { describe, expect, it } from 'vitest';
import { PROJECTS } from '@/content/projects';
import { projectsInFlight } from '@/water/registry';

describe('the featured projects', () => {
  it('are listed in the order the home page visits them', () => {
    expect(PROJECTS.map((p) => p.slug)).toEqual(projectsInFlight);
  });
  it('are numbered in that order', () => {
    expect(PROJECTS.map((p) => p.n)).toEqual(PROJECTS.map((_, i) => String(i + 1).padStart(2, '0')));
  });
});
