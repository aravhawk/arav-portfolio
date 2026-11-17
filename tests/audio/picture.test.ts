import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURTAIN, LIGHT, NAME_MELT, SEA } from '@/audio/mapping';
import { LAP, PULSE, RIBBON } from '@/water/moments';
import { LATTICE } from '@/water/world';

/**
 * Some of what the sound follows is written only in the picture's shading
 * pass (GLSL) or in the flight's own uniforms, where the sound cannot
 * import it. The sound keeps those numbers as its own copies. These tests
 * read the picture's text and hold the copies to it: when a line of the
 * picture changes, the test that names it fails, and the copy is brought
 * into line with it.
 */
const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../src/water/${path}`, import.meta.url)), 'utf8');
const flightGlsl = read('shaders/flight.ts');
const stationsGlsl = read('shaders/stations.ts');
const flight = read('flight.ts');
const f = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

describe('the sound’s copies of the picture’s own numbers', () => {
  it('the ending’s light: the line’s run and the ribbon’s head, as the shading pass draws them', () => {
    expect(flightGlsl).toContain(`float run = smoothstep(0.0, ${f(LIGHT.run)}, uRay.x);`);
    expect(flightGlsl).toContain(`float headM = mix(${f(LIGHT.foot)}, ${f(LIGHT.past)}, run);`);
    expect(flightGlsl).toContain(`float head = ${f(LIGHT.base)} + ${f(LIGHT.climb)} * rise + 4.0 * smoothstep(${f(LIGHT.out)}, 1.0, rise);`);
    expect(flightGlsl).toContain(`smoothstep(0.0, ${f(LIGHT.first)}, rise)`);
    // The ribbon's lean is the shading pass's own measure, and the flight hands it the same number the sound reads.
    expect(flightGlsl).toContain(`const float RIB_E0 = ${f(RIBBON.e0)};`);
    expect(flight).toContain('gl.uniform4f(r.u.uRay, this.ray, this.rise, on, RIBBON.lean);');
    expect(flight).toContain('Math.atan(RIBBON.at(aspect) * aspect * th)');
  });

  it('the name’s blocks: the meltwater at their feet, the ice opening under them, and the stretch of the melt in which the last of them goes', () => {
    expect(flight).toContain(`const pond = 32 + 34 * smooth(${NAME_MELT.pond[0]}, ${NAME_MELT.pond[1]}, m);`);
    expect(flight).toContain(`const hole = -30 + 78 * smooth(${NAME_MELT.hole[0]}, ${NAME_MELT.hole[1]}, m);`);
    expect(flight).toContain(`const left = 1 - smooth(${NAME_MELT.left[0]}, ${NAME_MELT.left[1]}, m);`);
  });

  it('the basin’s sea: the waves that strike the block and the sets they come in', () => {
    expect(flightGlsl).toContain(`float set_ = ${f(SEA.setLo)} + ${f(SEA.setHi)} * sin(uTime * ${f(SEA.set)} + along * ${f(SEA.setA)});`);
    expect(flightGlsl).toContain(`float w = sin(uTime * ${f(SEA.wave)} + along * ${f(SEA.along)} + ${f(SEA.wander)} * sin(uTime * ${f(SEA.wanderT)} + along * ${f(SEA.wanderA)}));`);
    expect(flightGlsl).toContain('return clamp((0.5 + 0.5 * w) * set_, 0.0, 1.0);');
    expect(flightGlsl).toContain(`float along = lb.y < 0.0 ? c.x + uSlabSize.x * 0.5 + ${f(SEA.front)} : c.y + 570.0;`);
    expect(flightGlsl).toContain('float land_ = beat * beat;');
  });

  it('the aurora’s curtains: where they hang, how their borders fold and the ripple that runs along them, and the noise they are made of', () => {
    expect(flightGlsl).toContain('float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }');
    expect(flightGlsl).toContain('float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), f); }');
    expect(flightGlsl).toContain('float a = az * (1.0 - 0.2 * k) + k * 3.8;');
    expect(flightGlsl).toContain(`float p1 = a * (1.9 + 0.8 * k) + 0.6 + 2.3 * k + uTime * ${f(CURTAIN.fold)};`);
    expect(flightGlsl).toContain(`float fold = n1(a * 3.1 + uTime * ${f(CURTAIN.lengths)} + k * 14.0);`);
    expect(flightGlsl).toContain('float reach = i == 0 ? smoothstep(0.2, 0.62, fold + 0.25 * s1) : smoothstep(0.34, 0.74, fold - 0.22 * s1);');
    expect(flightGlsl).toContain(`sin(a * ${f(CURTAIN.rippleK)} - uTime * ${f(CURTAIN.ripple)} + 1.7 * k)`);
    expect(flightGlsl).toContain('sum *= 1.0 - 0.85 * dawn * dawn * dawn');
    // The picture's clock is the shading pass's time: what the flight publishes is what it hands the pass.
    expect(flight).toContain('gl.uniform1f(r.u.uTime, this.time);');
    expect(flight).toContain('pictureSignal(this.time, st, this.gateNow, this.surge, this.ray, this.lift, this.rise);');
  });

  it('the stations: the tarn’s pulse, the lattice’s lap and where its thread comes in, the shut sluices’ dry beds', () => {
    expect(stationsGlsl).toContain(`fract(uTime / ${f(LAP)})`);
    expect(flight).toContain('Math.floor(this.time / (PULSE / 2))');
    expect(PULSE).toBe(7);
    expect(stationsGlsl).toContain('float best = segD(q, vec2(0.0, -2.0 * LAT_P - 110.0), vec2(-2.0 * LAT_P, -2.0 * LAT_P), h);');
    expect(stationsGlsl).toContain('const float LAT_P = ${f(LATTICE.pitch)};');
    expect(LATTICE.pitch).toBeGreaterThan(0);
    expect(stationsGlsl).toContain('col = mix(col, bare, (1.0 - open) * fade);');
    expect(stationsGlsl).toContain('float open = gateOf(i) * (1.0 - smoothstep(front - 30.0, front + 30.0, d));');
  });
});
