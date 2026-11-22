/**
 * The shader source of each registered subject, by the name of its GLSL
 * function (`shader.fn` in registry.ts). Kept apart from the registry so
 * that the registry is plain numbers and geometry: the sound and the pages
 * read the plan from it, and must not carry shader text with it. Only the
 * renderer (flight.ts here) loads this file.
 *
 * A new subject: add its source here under the name its definition gives.
 */
import { BASIN_OBJECT, CONFLUENCE, ROCK_POOL, TARN_OBJECT } from './river-stations';
import { COLUMNS, DAM_ICE, DAM_WATER, LATTICE_ICE, CANYON_ICE } from './stations';
import { RING_ICE } from './ring';

const SOURCE: Record<string, string> = {
  slabHit: BASIN_OBJECT,
  confLift: CONFLUENCE,
  rockHit: ROCK_POOL,
  shardHit: TARN_OBJECT,
  columns: COLUMNS,
  dam: [DAM_ICE, DAM_WATER].join('\n'),
  lattice: LATTICE_ICE,
  canyon: CANYON_ICE,
  ringIce: RING_ICE,
};

/** The source of a subject's shader. A subject with none registered is a mistake in the registry, said at once. */
export function sourceOf(subject: { shader: { fn: string } }): string {
  const source = SOURCE[subject.shader.fn];
  if (source === undefined) throw new Error(`No shader source registered for ${subject.shader.fn} (src/water/shaders/subjects.ts)`);
  return source;
}
