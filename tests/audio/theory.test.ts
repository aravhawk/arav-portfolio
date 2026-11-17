import { describe, expect, it } from 'vitest';
import { ARRIVAL, ARRIVAL_AT, BEAT, CHORDS, LATTICE_START, MOTIF, MOTIF_BEATS, MOTIF_STEPS, MOVE, MOVEMENTS, PENTA, SHARD_ROUNDS, type Variation, bassNote, climb, derives, hz, ladder, latticeNote, motifBeats, motifNotes, motifPhrase, rung, shardNote, snap, vary, voiceLead } from '@/audio/theory';

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
    for (const m of [...SHARD_ROUNDS.flat(), ...MOTIF, LATTICE_START]) expect(PENTA).toContain(pc(m));
    for (let row = 0; row < 4; row++) for (let i = 0; i < 4; i++) expect(PENTA).toContain(pc(latticeNote(row, i)));
    for (let m = 40; m < 100; m += 0.7) expect(PENTA).toContain(pc(snap(m)));
  });

  it('concert pitch', () => {
    expect(hz(69)).toBeCloseTo(440, 6);
    expect(hz(81)).toBeCloseTo(880, 6);
    expect(hz(62)).toBeCloseTo(293.665, 2);
  });

  it('the ladder rises and stays in range, and a note can be climbed from', () => {
    const l = ladder(60, 84);
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThan(l[i - 1]);
    expect(l[0]).toBeGreaterThanOrEqual(60);
    expect(l[l.length - 1]).toBeLessThanOrEqual(84);
    expect(climb(78, 1)).toBe(81);
    expect(climb(78, -2)).toBe(74);
    expect(rung(81) - rung(78)).toBe(1);
  });

  it('the flight begins on the minor side and arrives in D major', () => {
    expect(MOVEMENTS[MOVE.ice].day[0].bass).toBe(11);
    const home = MOVEMENTS[MOVE.rest].day[0];
    expect(home.bass).toBe(2);
    // The arrival has the tonic and its major third in the upper voices.
    expect(home.tones).toContain(2);
    expect(home.tones).toContain(6);
  });

  it('the run out to sea waits on the dominant, by day and before dawn, and nothing else', () => {
    const run = MOVEMENTS[MOVE.approach];
    for (const c of [...run.day, ...run.night]) expect(c.bass).toBe(9);
    expect(run.name).toBe('approach');
  });

  it('every chord is held for a whole number of beats', () => {
    for (const mv of MOVEMENTS) expect(Math.abs(mv.hold / BEAT - Math.round(mv.hold / BEAT)), mv.name).toBeLessThan(1e-6);
  });
});

describe('the theme', () => {
  it('is five notes of the pentatonic: up a step, up a step, down a fourth, down a step', () => {
    expect(MOTIF).toHaveLength(5);
    for (const m of MOTIF) expect(PENTA).toContain(pc(m));
    expect(MOTIF_STEPS).toEqual([0, 1, 2, -1, -2]);
    expect(MOTIF_BEATS).toHaveLength(5);
  });

  it('is a question over the frozen lake and an answer at the dawn: the same notes end on the minor third of B and on the tonic of D', () => {
    const last = pc(MOTIF[4]);
    expect((last - CHORDS.Bq.bass + 12) % 12).toBe(3);
    expect(last).toBe(CHORDS.Dhome.bass);
  });

  it('upside down it falls where it rose; backwards it is its own notes in reverse', () => {
    expect(vary({ form: 'invert' }).steps).toEqual([0, -1, -2, 1, 2]);
    expect(vary({ form: 'retro' }).steps).toEqual([-2, -1, 2, 1, 0]);
    expect(motifNotes({ form: 'retro' }, 78)).toEqual(MOTIF.slice().reverse());
    expect(motifNotes({ form: 'plain' }, 78)).toEqual(MOTIF);
    // Upside down from F sharp: E, D, A, B. It ends on B, the root of the melt's first chord.
    expect(motifNotes({ form: 'invert' }, 78).map(pc)).toEqual([6, 4, 2, 9, 11]);
    expect(pc(motifNotes({ form: 'invert' }, 78)[4])).toBe(MOVEMENTS[MOVE.melt].day[0].bass);
  });

  it('its halves share the middle note, and drawn out it is twice as long', () => {
    expect(vary({ form: 'plain', part: 'head' }).steps).toEqual([0, 1, 2]);
    expect(vary({ form: 'plain', part: 'tail' }).steps).toEqual([2, -1, -2]);
    expect(motifBeats({ form: 'plain' })).toBe(5);
    expect(motifBeats({ form: 'plain', stretch: 2 })).toBe(10);
    expect(vary({ form: 'plain', part: 'tail' }).beats).toEqual([0, 1.5, 3]);
  });

  it('knows itself: any stretch of it, in any form, at any height; and nothing else', () => {
    expect(derives(MOTIF)).toBe(true);
    expect(derives(MOTIF.map((m) => m + 12))).toBe(true);
    expect(derives(MOTIF.slice(1, 4))).toBe(true);
    expect(derives(motifNotes({ form: 'invert', part: 'tail' }, 90))).toBe(true);
    expect(derives(motifNotes({ form: 'plain', shift: -2 }, 78))).toBe(true);
    expect(derives([74, 76, 78, 81, 83])).toBe(false);
    expect(derives([78, 79, 81])).toBe(false);
    expect(derives([78, 83, 74])).toBe(false);
    expect(derives([78])).toBe(false);
  });

  it('every movement’s bells say it: whole on entering, then in its own halves, by day and before dawn, inside the bells’ range', () => {
    for (const mv of MOVEMENTS) {
      const forms: Variation[] = [...(mv.first ? [mv.first] : []), ...mv.then];
      if (mv.bells > 0) expect(forms.length, mv.name).toBeGreaterThan(0);
      for (const form of forms) {
        for (const night of [0, 1]) {
          const phrase = motifPhrase(form, mv.bellLo, mv.bellHi, night);
          const notes = phrase.map((n) => n.midi);
          expect(derives(notes), `${mv.name} ${JSON.stringify(form)}`).toBe(true);
          for (const m of notes) {
            expect(m, mv.name).toBeGreaterThanOrEqual(mv.bellLo - 3);
            expect(m, mv.name).toBeLessThanOrEqual(mv.bellHi + 3);
          }
          for (let i = 1; i < phrase.length; i++) expect(phrase[i].at).toBeGreaterThan(phrase[i - 1].at);
          // A phrase is said inside one chord.
          expect(motifBeats(form) + 2.5, mv.name).toBeLessThanOrEqual(Math.max(Math.round(mv.hold / BEAT), Math.ceil(motifBeats(form) + 3.5)));
        }
      }
    }
  });

  it('each movement begins with the whole theme in its own way, except where something else carries it', () => {
    const whole = (v: Variation | null) => !!v && (v.part ?? 'whole') === 'whole';
    expect(MOVEMENTS[MOVE.ice].first).toEqual({ form: 'plain' });
    expect(MOVEMENTS[MOVE.melt].first?.form).toBe('invert');
    expect(MOVEMENTS[MOVE.works].first?.form).toBe('retro');
    for (const m of [MOVE.ice, MOVE.melt, MOVE.river, MOVE.works, MOVE.delta]) expect(whole(MOVEMENTS[m].first), MOVEMENTS[m].name).toBe(true);
    // The tarn has no bells: its two shards share the theme. The canyon's bells only begin it: its bass has it whole.
    expect(MOVEMENTS[MOVE.tarn].first).toBeNull();
    expect(MOVEMENTS[MOVE.canyon].first).toMatchObject({ part: 'head', stretch: 2 });
    // On the run out to sea it is begun and not finished.
    expect(MOVEMENTS[MOVE.approach].first).toMatchObject({ part: 'head' });
    for (const v of MOVEMENTS[MOVE.approach].then) expect(v.part).toBe('head');
  });

  it('the canyon stands on it: its chords’ bass notes are the theme, a note to a chord', () => {
    for (const cycle of [MOVEMENTS[MOVE.canyon].day, MOVEMENTS[MOVE.canyon].night]) expect(cycle.map((c) => c.bass)).toEqual(MOTIF.map(pc));
  });

  it('the delta says it in sequence: each saying a step lower', () => {
    const mv = MOVEMENTS[MOVE.delta];
    const a = motifPhrase(mv.first!, mv.bellLo, mv.bellHi, 0).map((n) => rung(n.midi));
    const b = motifPhrase(mv.then[0], mv.bellLo, mv.bellHi, 0).map((n) => rung(n.midi));
    const c = motifPhrase(mv.then[1], mv.bellLo, mv.bellHi, 0).map((n) => rung(n.midi));
    expect(b.map((x, i) => x - a[i])).toEqual([-1, -1, -1, -1, -1]);
    expect(c.map((x, i) => x - b[i])).toEqual([-1, -1, -1, -1, -1]);
  });

  it('the two shards share it: three rounds of call and answer say it whole, and its last note is answered by itself an octave down', () => {
    const said = [0, 1, 2].flatMap((r) => [shardNote(r, 0), shardNote(r, 1)]);
    expect(said.slice(0, 5)).toEqual(MOTIF);
    expect(said[5]).toBe(MOTIF[4] - 12);
    expect(shardNote(3, 0)).toBe(shardNote(0, 0));
    expect(shardNote(-1, 1)).toBe(shardNote(2, 1));
  });

  it('the lattice’s rows begin on its first four notes and climb, and the lap begins on its last', () => {
    for (let row = 0; row < 4; row++) {
      expect(pc(latticeNote(row, 0))).toBe(pc(MOTIF[row]));
      for (let i = 1; i < 4; i++) expect(latticeNote(row, i)).toBeGreaterThan(latticeNote(row, i - 1));
    }
    expect(pc(LATTICE_START)).toBe(pc(MOTIF[4]));
  });

  it('the arrival is it, whole and harmonised: the theme on top, D major under it, ending on the tonic chord, laid along the light in its own rhythm', () => {
    expect(ARRIVAL.map((c) => c[0])).toEqual(MOTIF);
    for (const c of ARRIVAL) {
      for (const m of c) expect(D_MAJOR).toContain(pc(m));
      for (let i = 1; i < c.length; i++) expect(c[i]).toBeLessThan(c[i - 1]);
    }
    const last = ARRIVAL[ARRIVAL.length - 1].map(pc);
    expect(last).toContain(2);
    expect(last).toContain(6);
    expect(last).toContain(9);
    // IV under its third note, V under its fourth.
    expect(ARRIVAL[2].map(pc)).toContain(7);
    expect(ARRIVAL[3].map(pc)).toContain(1);
    expect(ARRIVAL_AT[0]).toBe(0);
    expect(ARRIVAL_AT[4]).toBe(1);
    expect(ARRIVAL_AT).toEqual(MOTIF_BEATS.map((b) => b / 5));
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
