# The flight's renderer

The home page does not draw the flight live. It plays frames that the
engine (`src/water`) rendered ahead of time, by scroll
(`src/flight/player.ts`). This folder makes those frames. Run it again
whenever the picture would change: the world, the light, the camera's
path, the words (the picture keeps a calm lee under every block of words,
so where the words stand is baked into it), or the live numbers the
picture shows (the columns' heights, the streams' widths).

## One command

```sh
pnpm build
pnpm exec next start -p 3183 &
NODE_PATH=<a node_modules with playwright> node tools/flight/make.mjs --base http://localhost:3183
```

It needs Playwright's Chromium (not a dependency of this repo: point
`NODE_PATH` at an install that has it), `uv` (ffmpeg comes from
`uv run --with imageio-ffmpeg`; or set `FFMPEG`), and this machine's GPU to
itself. It writes `public/flight/` and prints every file with its size.
Commit `public/flight/`.

## What it does

`render.mjs` opens `/render` (the home page drawn by the live engine: the
only route that loads it; unlinked, not in the sitemap, disallowed in
robots) and photographs the engine's canvas alone, a frame at a time:

- full shading (`engine.holdLean(0)`), every piece of a frame drawn by its
  own shader variant before it is read;
- the page stepped by hand (`__flight.manual`, `__flight.step`): one frame a
  thirtieth of a screen, the picture's clock tied to the frame's place in
  the flight (a screen of scroll is a second of water and light), the lee
  behind the words eased by that same clock. Two runs give the same frames;
- read straight from the WebGL canvas and piped to a lossless file (x264
  RGB, qp 0): no screenshot, no colour management, nothing of the DOM.

A set is a window shape and a theme: `wide` (1920 x 1080 CSS at a density of
4/3: a 2560 x 1440 picture) or `tall` (390 x 844 at 2: 780 x 1688), `day`
or `night`. Of each set it renders these tracks:

| Track | What | Played |
| --- | --- | --- |
| `main` | the whole flight, 30 frames a screen, the ending's light not yet risen | by scroll |
| `enter` | the first screen's entrance (ENTER in `moments.ts`), 30 frames a second | by time, once, on a load at the top |
| `dawn` | the ending's light event (DAWN), 30 frames a second, from the frame of `main` where the camera comes to rest | by time, once |
| `after` | the last stretch with the light risen | by scroll, once the dawn has played |
| `gate1`, `gate2` | the stretch where the sluices are in the frame, second and third gate open (only with `--tracks ...,gate1,gate2`) | by scroll, when the switch says so |

The gates' tracks are not shipped today. The sluices change the picture
from about screen 16 to screen 24 (strongly from 19.5 to 22), in both
directions of the switch, so the two tracks add between a fifth and a half
again to every stream, and the whole of `public/flight/` has a limit of 90
MB. The player plays them when a stream has them (`player.ts`); until then
the picture keeps the first gate open and the switch's own drawing in the
words shows the choice.

Also, with motion reduced (`stills`), each section's composed frame as a
PNG, with its camera. It also writes the camera of every frame of `main`
(`main.cam`): the player places the captions tied to points of the world
with it, and draws the place between two frames through it.

`encode.mjs` turns a set's lossless frames into what ships:

| File | What |
| --- | --- |
| `<set>.av1` | every track's frames as AV1 (SVT-AV1), bare samples end to end |
| `<set>.hevc` | the same as HEVC (x265), for browsers whose decoder cannot take AV1 (Safari on Apple hardware without an AV1 decoder); the wide picture at 1920 x 1080 |
| `<set>.<codec>.json` | the stream's index: the WebCodecs codec string, the decoder's configuration record (HEVC), and for each track where it begins, its rate, its keyframe interval and every frame's size |
| `<shape>.cam`, `<shape>.still.cam` | the cameras (13 floats a frame: position, forward, right, up, tangent of half the field of view) |
| `<set>.poster*.avif`, `.webp` | the first paint: the entrance's first frame |
| `<set>.still-<n>.avif` | section `n`'s still |

A stream is made for scrubbing: a keyframe every half screen of scroll
(every 15 frames), no frame held back for another, so the frames come out
of a decoder in the order they go in and any place in the flight is at
most 14 frames of decoding from a keyframe. The player fetches it by byte
range, a few keyframe groups at a time. The encoder checks that the
keyframes are where the index says and can print the SSIM of each track
against its lossless frames (`--ssim`).

`make.mjs` runs both for every set and removes each set's lossless frames
before the next (a wide set is several GB). Then it makes the masks.

## The live layer's masks

The home page lays a light live layer over the played picture
(`src/flight/live.ts`: glints on open water, the pointer's wake and its
cold light on ice). It has to know what each frame shows. The engine can
write exactly that in place of a frame's colour (`engine.maskOut`, the
main shader's `uMaskOut`): red where the pixel is open water (not ice,
not a floe, not behind a standing object, not lost in the air), green
where it is solid ground or ice, blue where the words' lee lies (the
layer does not use the blue: the lee is far wider than the words, so it
reads the words' own boxes from the page instead).

```sh
node tools/flight/render.mjs --base http://localhost:3183 --out .tools/flight-mask --set wide-day --tracks mask --dpr 1
node tools/flight/mask.mjs --in .tools/flight-mask --set wide-day
```

`render.mjs --tracks mask` photographs every frame of `main` that way (at
a density of 1: the masks ship small; about 8 minutes wide, 2 tall).
`mask.mjs` brings each down to a cell (384 x 216 wide, 180 x 390 tall),
grey (0 sky, 0.5 solid, 1 open water), and packs a screen of scroll's cells, 30 and the
first of the next, onto one WebP sheet: `<shape>.mask-<k>.webp` with
`<shape>.mask.json` (33 sheets a shape; 1.21 MB wide, 0.85 MB tall). The
masks do not depend on the theme: one set a shape, from the day set.
Render them again whenever `main` is rendered again: a mask is looked up
by its frame's number.

## A part of it

```sh
# one set, some tracks, a part of the flight (a trial)
node tools/flight/render.mjs --base http://localhost:3183 --out .tools/flight --set wide-day --tracks main --from 5 --to 6.5
node tools/flight/encode.mjs --in .tools/flight --set wide-day --codecs av1 --ssim --keep
```

`render.mjs` keeps `meta.json` between runs, so one track can be rendered
again without the others; `encode.mjs` always encodes every track it finds
frames for (delete a track's `.mkv` to leave it out).

## What is not here

The engine's own band on an inner page (`src/water/scene-band.ts`) is kept
for making the inner pages' stills (`public/media/scenes`) again. No
visitor's page mounts it.
