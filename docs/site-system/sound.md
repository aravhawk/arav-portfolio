# Sound

Status: **as built** (R1, 2026-11-21, on the behaviour of S2).

The site has sound: the place heard (wind, water, ice, a slow piece in
one key), synthesized, steered by the live picture as it was before. It
is **on unless the reader mutes it**. An inner page has it too, as it
did before.

## What a reader gets

- **First visit: on.** A browser lets sound start only inside an event it
  counts as the reader's own act: a press, a key, the end of a touch. A
  wheel, a scroll and a pointer's move do not count. So the control
  reads "on" from the first paint, the sound starts at the first such
  act, and it fades in from silence over 1.5 s.
- **A first press on the control mutes**, and nothing ever sounds.
- **One press mutes** (200 ms to true silence, then the audio context
  rests) **and one brings it back** (400 ms). So does the **M** key,
  anywhere but in a field.
- **The choice is kept** (`localStorage`, key `sound`, `on` or `off`) and
  read before the first paint. A reader who muted stays muted until they
  turn it on, and is never sent the sound's script.
- **What silences it:** a hidden tab or a page put away (out in 300 ms,
  the context suspended, back in 800 ms). A reader who has never chosen
  starts muted if the system asks for less data (`Save-Data`,
  `prefers-reduced-data`) or the device reports a gigabyte of memory or
  less; nothing is stored for them, and the control turns sound on as
  for anyone.
- **Reduced motion does not mute.** It leaves out the swells on
  transitions (the air on a jump by the rail and on the theme's turn;
  the swell as the last ice goes) and calms what motion drives, as
  before.
- **Without scripts** there is no sound and the control is not shown.

## The control

In the nav on every page (`SoundToggle.tsx`), beside the theme switch
and in its manner. Its look and its three states are written at the top
of `src/components/sound.css`.

| State | `<html>` | Looks | Said |
| --- | --- | --- | --- |
| on, waiting | `data-sound="on"` | speaker, three faint still bars | switch "Sound", on; "Sound is on and starts at your first click or key. Mute (M)" |
| on, playing | `data-sound="on" data-sound-live` | the bars at full strength, moving | switch "Sound", on; "Sound is on. Mute (M)" |
| muted | `data-sound="off"` | speaker and a cross, set back | switch "Sound", off; "Sound is muted. Turn it on (M)" |

- **True from the first paint.** `boot` in `layout.tsx` writes
  `data-sound` before anything is drawn; the control is drawn from it by
  CSS alone. For a reader who had muted, a one-line script after the
  button sets its state for assistive technology as it is parsed. Its
  title (the sentence shown when it is pointed at) comes with its
  script.
- **Its markup is three empty bars.** The speaker and the cross are
  drawn in `sound.css` (shapes cut from the mark's colour), the status
  line is made by the script, and the script after the button is one
  short line: the nav is in every page, and `/work`'s HTML is within a
  byte of what a new connection sends before it waits
  (`performance.md`). With the speaker and the cross in the markup,
  `/work` lost two points on a phone.
- **It never says "playing" while the browser is holding sound back:**
  `data-sound-live` is set only when the audio context's state is
  `running` and the sound is built.
- A switch like the one beside it (`role="switch"`, named "Sound",
  `aria-checked`, `aria-keyshortcuts="M"`), 44 by 44 at every width, a
  focus ring round the mark. A change is also said in a status line
  (`.nav-sound-status`, empty until the first change, so it adds no
  words to the page): the key works wherever the reader's attention is.
- Whole pixels: an 8 by 12 speaker, bars 2 wide and 2 apart (6, 12, 8
  tall about one line), an 8 px cross in a stroke of a pixel and a
  half, in a 22 by 14 mark. Only opacity and transform change, 180 ms,
  ease-out; the press is `scale(0.97)`; from the keys nothing is in
  transition; with reduced motion the bars stand still and playing is
  told from waiting by their strength.
- On a narrow screen the nav's mark and links give up side padding so
  the control and the switch keep their targets (`nav.css`).

`scripts/sound-sheet.mjs <base> <outdir>` photographs every state, at
rest, pointed at, focused and pressed, in both themes at 1x and 2x, and
writes what the keys do.

## Starting, exactly

`SoundToggle.tsx` listens (capture, passive) for `pointerdown`,
`pointerup`, `touchend`, `click`, `keydown` and `wheel`. On each, while
sound is on and not yet playing:

1. Where the browser has `navigator.userActivation` it is asked whether
   the event counts (`isActive`, or `hasBeenActive` for one remembered).
   If not, nothing is done: an audio context made or resumed where the
   browser would refuse it is a warning in the console. Where that
   interface is missing, only `pointerup`, `touchend`, `click` and
   `keydown` are tried.
2. The context is made (or resumed) inside the event and handed to
   `soundOn` in `src/audio`. If the context is still not `running`, the
   next event tries again. Nothing throws and nothing is logged.

A press on the control itself is never a start: it is the reader's
choice to mute.

`scripts/sound-visit.mjs` runs first and second visits in Chromium,
WebKit and Firefox. A real browser does not count a wheel; the WebKit
and Firefox builds Playwright drives do count the wheel it sends, so
there the sound starts on it, and the script holds the page to what the
browser itself said.

## Cost

- The sound's code is two files, **33.5 kB gzipped** (the sound 27.0, a
  shared piece 6.5), on every page that has a picture. It is asked for a
  second after the page's `load` event, at an idle moment (`whenCalm`,
  the one gate), or at the reader's first gesture if that comes sooner;
  never in the first load, never before the largest paint, and never
  for a muted reader until they turn it on. `scripts/sound-load.mjs`
  proves each.
- The sound reads the world's plan (`src/water/registry.ts` and what it
  imports), and that file carries the picture's shader text (61 kB
  gzipped). On a page with a picture it is the picture's own and is
  fetched for it anyway. On the one kind of page with none (a project
  the world has no place for yet, the newsletter's answer pages) it
  comes with the sound: 94.8 kB there. Taking the shader text out of
  the plan is a change to `src/water` that this task was told to leave
  alone; it was done once in 1bf59c7 and can be brought over.
- The audio service is warmed at idle (`enumerateDevices`, no prompt), so
  making the context at the first gesture does not hold the page.

## Levels

`scripts/audio-check.mjs` renders scripted visits offline through the
page's own graph and measures them (`NODE_PATH=<playwright> node
scripts/audio-check.mjs --out <dir>`). What must hold:

- **`walk`** (the first screen, then every place in the flight's order,
  1.6 s to each and 6 s there, the ending held): **-23 LUFS** within 1,
  no peak over **-3 dBTP**. As built: -23.3 by day, -22.5 by night,
  -23.3 on the phone's tier, true peaks at -5.1 dBTP or under. The
  level is `MASTER` in `src/audio/graph.ts` (4 dB over the level the
  sound had when it was off until asked for); the ceiling is
  `LEVEL.ceiling`.
- **`power-start`, `power-mute`, `power-mute-hero`, `power-hidden`**: no
  click and no step in any turn of the mix, true silence after a mute.
  The mix's fade (`Sound.setOn`) is an eased curve laid in straight
  pieces that ends exactly at 0 or 1 and can be turned round part way;
  `tests/audio/power.test.ts` holds it.
- Six of the check's older scenes fail on yesterday's build as they do
  on this one (the harmony moving twice inside two seconds on the long
  flights, a loop in one solo of the water, the tarn's pulse on an
  upright screen, the aurora at the delta). They are not this task's
  and are listed in its report.

Change log: 2026-11-21 R1: sound on by default, the mute control, the
measured level, on yesterday's live engine.
