# Sound

Status: **as built** (S2, 2026-11-21).

The home page has sound: the place heard (wind, water, ice, a slow piece
in one key), synthesized, following the reader through the flight. It is
**on unless the reader mutes it**. No other page has sound or shows the
control.

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
- **The choice is kept** (`localStorage`, key `sound`, `on` or `off`). A
  reader who muted stays muted until they turn it on, and is never sent
  the sound's script.
- **What silences it:** a hidden tab or a page put away (out in 300 ms,
  the context suspended, back in 800 ms); an inner page (it fades as the
  home page is left and carries on when the reader comes back). A reader
  who has never chosen starts muted if the system asks for less data
  (`Save-Data`, `prefers-reduced-data`) or the device reports a gigabyte
  of memory or less; nothing is stored for them, and the control turns
  sound on as for anyone.
- **Reduced motion does not mute.** It removes the swells on transitions
  (the air on a jump, on a route, on the theme's turn; the swell as the
  last ice goes) and calms what motion drives, as before.

## The control

In the nav, home page only (`Nav.tsx`), beside the theme switch and in
its manner. Its look and its three states are written at the top of
`src/components/sound.css`; its behaviour is `src/lib/sound-control.ts`.

| State | `<html>` | Looks | Name, title |
| --- | --- | --- | --- |
| on, waiting | `data-sound="on"` | speaker, three faint still bars | "Mute sound"; "Sound is on and starts at your first click or key. Mute (M)" |
| on, playing | `data-sound="on" data-sound-live` | the bars at full strength, moving | "Mute sound"; "Mute sound (M)" |
| muted | `data-sound="off"` | speaker and a cross, set back | "Turn sound on"; "Turn sound on (M)" |

- **True from the first paint.** `boot` in `layout.tsx` writes
  `data-sound` before anything is drawn; the control is drawn from it by
  CSS alone. For a reader who had muted, a one-line script after the
  button gives it its name as it is parsed.
- **It never says "playing" while the browser is holding sound back:**
  `data-sound-live` is set only when the audio context's state is
  `running` and the sound is built.
- A button (not a switch: its name says what a press will do), 44 by 44
  everywhere, a focus ring round the mark, `aria-keyshortcuts="M"`. A
  change is said in a status line (`.nav-sound-status`, empty until the
  first change, so it adds no words to the page).
- Whole pixels: an 8 by 12 speaker, bars 2 wide and 2 apart (6, 12, 8
  tall about one line), an 8 px cross, in a 22 by 14 mark. Only opacity
  and transform change, 180 ms, ease-out; the press is `scale(0.97)`;
  from the keys nothing is in transition; with reduced motion the bars
  stand still and playing is told from waiting by their strength.
- **The markup is in the nav, the behaviour is in the home page's
  script** (`FlightPlayer.tsx` mounts `mountSoundControl`). The nav's
  script is in every page and sits just under the size at which the
  bundler splits it (`performance.md`, "The first round"): with the
  behaviour in it every page had one more request.

## Starting, exactly

`sound-control.ts` listens (capture, passive) for `pointerdown`,
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

`scripts/sound-visit.mjs` runs first and second visits in Chromium,
WebKit and Firefox. A real browser does not count a wheel; the WebKit
and Firefox builds Playwright drives do count the wheel it sends, so
there the sound starts on it, and the script holds the page to what the
browser itself said.

## Cost

- The sound's code is three files, **46.6 kB gzipped** (the sound 27.5,
  the world's plan it reads 18.4, a loader 0.7). It is asked for after
  the `load` event, a frame, and an idle callback; never in the first
  load, never for a muted reader until they turn it on, never on an
  inner page. `scripts/sound-load.mjs` proves each.
- It holds no shader text. The registry (`src/water/registry.ts`) names
  each subject's GLSL function and `src/water/shaders/subjects.ts`, which
  only the renderer loads, holds the source. Keep it so: an import of a
  shader file from the registry, `camera.ts`, `sky.ts`, `moments.ts` or
  `geography.ts` puts 50 kB back.
- The audio service is warmed at idle (`enumerateDevices`, no prompt), so
  making the context at the first gesture does not hold the page.
  `scripts/sound-inp.mjs`: no task over 50 ms round the first gesture,
  interactions 16 to 48 ms (wide, and a phone's screen with the thread
  four times slower).

## Levels

`scripts/audio-check.mjs` renders scripted visits offline through the
page's own graph and measures them (`NODE_PATH=<playwright> node
scripts/audio-check.mjs --out <dir>`). What must hold:

- **`walk`** (the first screen, then every place in the flight's order,
  1.6 s to each and 6 s there, the ending held): **-23 LUFS** within 1,
  no peak over **-3 dBTP**. As built: -23.2 by day, -22.2 by night,
  -23.0 on the phone's tier; the highest true peak in any scene is
  -5.1 dBTP. The level is `MASTER` in `src/audio/graph.ts`; the ceiling
  is `LEVEL.ceiling`.
- **`power-start`, `power-mute`, `power-mute-hero`, `power-jump`,
  `power-hidden`**: no click and no step in any turn of the mix, true
  silence after a mute. The mix's fade (`Sound.setOn`) is an eased curve
  laid in straight pieces that ends exactly at 0 or 1.

## A place's cue

Each place has its own (`mixOf` and `waterOf` in `src/audio/mapping.ts`,
the clockwork and moments in `sound.ts`); `tests/audio/mapping.test.ts`
("at each station's composed stop") holds each to its place by name, so
a reordered flight cannot leave a cue behind. **A new place needs one:**
a reading of how it is seen in `scene.ts`, its part in the mix, a test
at its composed stop, and a scene in `audio-check.mjs`. Ask Around's
ring is the model (`ringNear`, `ringVoice`): still air (the wind falls
away), the still room, its pool's rare bubble, and one of its six lit
stones ringing faintly every three seconds or so, each with its own note
of the key, from where it stands; the dark stone never.

Change log: 2026-11-21 S2: sound on by default, the mute control, the
chunk without shader text, the ring's cue, the measured level.
