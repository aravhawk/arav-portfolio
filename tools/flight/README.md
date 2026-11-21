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
| `gate1`, `gate2` | the stretch in which cc-switch's switch can be worked (from 0.3 screens before its composed frame to a screen after it: 40 frames), second and third gate open | by scroll, when the switch says so |

The gates' tracks are whole frames, but only of the 1.3 screens in which
the switch stands in cc-switch's words: 80 frames a stream, 5.4 MB over all
eight streams. Over the whole stretch in which the sluices are in the frame
(about eight screens) they would not fit the limit. The player plays a
gate's track while the scroll is inside it and that gate is chosen, and
dissolves at its two ends (`player.ts`); outside it the picture is `main`,
the first gate open.

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
`<shape>.mask.json` (a sheet for every screen of scroll). The
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

## The inner pages' pictures

The inner pages open on stills of the same world (`public/media/scenes`),
and the sharing cards on photographs of the flight (`public/og`). They are
not made here, but they go stale with the same changes:

```sh
node scripts/capture-scenes.mjs --base http://localhost:3183 --only ask-around   # a scene, four shapes, both themes
node scripts/capture-og.mjs --base http://localhost:3183       # the cards' pictures
```

`capture-scenes.mjs` photographs the engine's own band
(`src/water/scene-band.ts`) on the route `/render/band`, which exists for
it. No visitor's page mounts the band. (Only Ask Around's pictures were
made with it: see "Re-render the flight" in `docs/site-system/recipes.md`
before re-shooting another scene.)

## Before rendering

`scripts/render-sheet.mjs` photographs `/render` at places down the flight
(words and all, stepped as this tool steps it) and lays them on a sheet:
look at a change to the world there first.
