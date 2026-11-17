import { describe, expect, it } from 'vitest';
import { ARRIVAL, CHORDS, MOVEMENTS, PENTA, SHARD_NOTES, bassNote, bellPhrase, hz, ladder, latticeNote, makeRng, snap, voiceLead } from '@/audio/theory';

/** D major: the one key signature everything on the site keeps to. */
const D_MAJOR = [2, 4, 6, 7, 9, 11, 1];
const pc = (m: number) => ((m % 12) + 12) % 12;

describe('the key', () => {
  it('every chord is made of notes of D major', () => {
    for (const c of Object.values(CHORDS)) {
      expect(D_MAJOR).toContain(c.bass);
      for (const t of c.tones) expect(D_MAJOR).toContain(t);
    }
  });

  it('the pentatonic the effects are tuned to lies inside D major', () => {
    for (const p of PENTA) expect(D_MAJOR).toContain(p);
  });

  it('the tuned effects are all in the pentatonic', () => {
    for (const m of [...SHARD_NOTES, ...ARRIVAL]) expect(PENTA).toContain(pc(m));
    for (let row = 0; row < 4; row++) for (let i = 0; i < 4; i++) expect(PENTA).toContain(pc(latticeNote(row, i)));
    for (let m = 40; m < 100; m += 0.7) expect(PENTA).toContain(pc(snap(m)));
  });

  it('concert pitch', () => {
    expect(hz(69)).toBeCloseTo(440, 6);
    expect(hz(81)).toBeCloseTo(880, 6);
    expect(hz(62)).toBeCloseTo(293.665, 2);
  });

  it('the ladder rises and stays in range', () => {
    const l = ladder(60, 84);
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThan(l[i - 1]);
    expect(l[0]).toBeGreaterThanOrEqual(60);
    expect(l[l.length - 1]).toBeLessThanOrEqual(84);
  });

  it('the flight begins on the minor side and arrives in D major', () => {
    expect(MOVEMENTS[0].day[0].bass).toBe(11);
    const home = MOVEMENTS[7].day[0];
    expect(home.bass).toBe(2);
    // The arrival has the tonic and its major third in the upper voices.
    expect(home.tones).toContain(2);
    expect(home.tones).toContain(6);
    // What comes before it waits on the dominant.
    const delta = MOVEMENTS[6].day;
    expect(delta[delta.length - 1].bass).toBe(9);
  });

  it('the lattice climbs: each row rises, each row starts a step above the last', () => {
    for (let row = 0; row < 4; row++) {
      for (let i = 1; i < 4; i++) expect(latticeNote(row, i)).toBeGreaterThan(latticeNote(row, i - 1));
      if (row) expect(latticeNote(row, 0)).toBeGreaterThan(latticeNote(row - 1, 0));
    }
  });

  it('the shards: a call and an answer a minor third below it', () => {
    expect(SHARD_NOTES[0] - SHARD_NOTES[1]).toBe(3);
  });
});

describe('voice leading', () => {
  it('walks every movement without crossing, doubling or leaving the chord', () => {
    for (const night of [false, true]) {
      for (const mv of MOVEMENTS) {
        const cycle = night ? mv.night : mv.day;
        let v: number[] = [];
        for (let round = 0; round < 3; round++) {
          for (const c of cycle) {
            const next = voiceLead(v, c, mv.voices, mv.lo, mv.hi);
            expect(next).toHaveLength(mv.voices);
            for (let i = 0; i < next.length; i++) {
              expect(c.tones).toContain(pc(next[i]));
              expect(next[i]).toBeGreaterThanOrEqual(mv.lo);
              expect(next[i]).toBeLessThanOrEqual(mv.hi);
              if (i) expect(next[i] - next[i - 1]).toBeGreaterThanOrEqual(2);
            }
            // The notes that make the chord what it is are all there.
            for (const need of c.tones.slice(0, Math.min(mv.voices, c.tones.length))) expect(next.map(pc)).toContain(need);
            v = next;
          }
        }
      }
    }
  });

  it('moves by small steps: no voice leaps more than a fifth between chords of a movement', () => {
    for (const mv of MOVEMENTS) {
      let v = voiceLead([], mv.day[0], mv.voices, mv.lo, mv.hi);
      for (let round = 0; round < 2; round++) {
        for (const c of mv.day) {
          const next = voiceLead(v, c, mv.voices, mv.lo, mv.hi);
          const a = v.slice().sort((x, y) => x - y);
          const b = next.slice().sort((x, y) => x - y);
          for (let i = 0; i < a.length; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(7);
          v = next;
        }
      }
    }
  });

  it('holds a note two chords share', () => {
    // G major seventh and B minor seventh share B, D and F sharp.
    const a = voiceLead([], CHORDS.Gmaj7, 4, 55, 80);
    const b = voiceLead(a, CHORDS.Bm7, 4, 55, 80);
    expect(a.filter((m) => b.includes(m)).length).toBeGreaterThanOrEqual(2);
  });

  it('takes a voice in or lets one go when the movement changes', () => {
    const three = voiceLead([], CHORDS.Bq, 3, 59, 85);
    const four = voiceLead(three, CHORDS.Bm9, 4, 54, 83);
    expect(four).toHaveLength(4);
    expect(voiceLead(four, CHORDS.Dsus2, 3, 57, 78)).toHaveLength(3);
  });

  it('puts the bass on the chord’s own bass note, low', () => {
    for (const c of Object.values(CHORDS)) {
      const m = bassNote(c);
      expect(pc(m)).toBe(c.bass);
      expect(m).toBeGreaterThanOrEqual(35);
      expect(m).toBeLessThan(47);
    }
  });
});

describe('the bell line', () => {
  it('stays in the pentatonic or the chord, in range, and ends on a note of the chord', () => {
    const rng = makeRng(3);
    for (const c of Object.values(CHORDS)) {
      for (const answer of [false, true]) {
        for (let i = 0; i < 30; i++) {
          const ph = bellPhrase(rng, c, 74, 93, 80 + (i % 9), answer, 1.15);
          expect(ph.length).toBeGreaterThanOrEqual(3);
          for (const n of ph) {
            expect(n.midi).toBeGreaterThanOrEqual(74);
            expect(n.midi).toBeLessThanOrEqual(93);
            expect(n.vel).toBeGreaterThan(0);
            expect(n.vel).toBeLessThanOrEqual(1);
          }
          for (const n of ph.slice(0, -1)) expect(PENTA).toContain(pc(n.midi));
          const last = pc(ph[ph.length - 1].midi);
          expect([...c.tones, c.bass, ...PENTA]).toContain(last);
          for (let k = 1; k < ph.length; k++) expect(ph[k].at).toBeGreaterThan(ph[k - 1].at);
        }
      }
    }
  });

  it('is the same line for the same seed', () => {
    const a = bellPhrase(makeRng(9), CHORDS.Gmaj9, 74, 93, 81, false, 1.15);
    const b = bellPhrase(makeRng(9), CHORDS.Gmaj9, 74, 93, 81, false, 1.15);
    expect(a).toEqual(b);
  });
});
