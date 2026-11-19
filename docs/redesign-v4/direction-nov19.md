# Direction, Nov 19, 2026: quiet pages, one line, no 3D

> **Withdrawn the same day (Nov 19, 2026).** Arav corrected this
> direction about half an hour after it was written: the 3D is not to
> be removed or cut. His complaint is the scene's quality and speed,
> and both are to be overhauled to the level of igloo.inc. Nothing in
> this note was built into the site. It is kept as a record only. The
> direction in force is in `PROGRESS.md` under "Correction: the 3D
> stays".

Arav's verdict on the latest preview (12:18 PM CT): "still very laggy
and nowhere near as clean + fluid + super fast and quick loading as
lando norris, lusion, or igloo"; the river, canyon and ice scene
reads as "the current ai slop blender animation"; build the site to
be phenomenal and "super clean + minimalist in many ways/pages", then
make it fast as a hard gate. This note is the new direction. It
replaces the flight.

## What goes

- **The whole 3D scene**: the WebGL engine and its shaders
  (`src/water/**`), the lake, the name in ice, the melt, the river,
  the eight scene stations, the canyon, the delta, the sea, the light
  and ice systems, the governor, the first-paint posters, the scene
  bands and stills on inner pages, the share cards made from them.
  No WebGL, no shader, no canvas anywhere on the site.
- **The sound** (`src/audio/**`) and its control: it scored the
  flight, and the flight is gone. It can come back later as a lazy
  extra if Arav wants it.
- Smooth-scroll and animation libraries (Lenis, Motion): native
  scroll, CSS transitions.
- Haptics, the scroll rail, the words' lee and every test that
  measured words against a moving picture.
- Photographic or rendered backgrounds of any kind. Glass, blur,
  gradients as decoration, drop shadows that float things.

## What stays

- The content and its rules: the eight projects and their real pages,
  the live numbers, the archive, the blog and its typed content seam,
  plain specific copy, public work only, no fleet names, no em
  dashes; "AI and developer tooling builder." on the first screen;
  the ending "This was the warm-up." / "The next station isn't built
  yet."; light and dark, following the system with a toggle.
- The three type families already licensed and self-hosted (TASA
  Orbiter for display and text, Spline Sans Mono for data, Newsreader
  for the two serif moments), subset to the weights used.
- `content/posts` and `blog-editor` untouched.

## The idea

**Type on a strict grid, and one line.**

The site is black type on a cool white page (and the reverse before
dawn), set on a twelve-column grid with generous space. There is one
accent colour and it means one thing: **the line**, and what is live
on it.

The line is the site's one signature. It is the river of the old
site with everything but its course taken away: a single stroke that
starts under the name, runs down the home page, and at each project
does the one thing that project is, drawn from that project's real
numbers:

| Station | What the line does |
| --- | --- |
| Infiniview | meets a wall and breaks through at one point |
| Upstream | seven tributaries join it, one for each repository, as wide as its merged pull requests |
| Kilo Bench | passes three marks set at the three models' scores |
| Agent Bridge | runs as two lines side by side with messages crossing between them |
| Open models | carries four strands, as wide as each model's share of the pulls |
| cc-switch | comes to a switch with three branches; the selector throws it |
| TensorPoW | passes through a four by four lattice and lights one node |
| RydAR | takes one tight bend, with the advised speed marked before it |
| Interests | fans into a delta, one distributary for each interest |
| Ending | ends; a dashed stroke goes on past the last word: the next station isn't built yet |

It is SVG. It draws with scroll where the browser can do that in CSS
alone and is simply there where it cannot. It costs nothing to load
and nothing to run. Every project's piece of the line is also its
mark everywhere else on the site (the work index, its own page, its
share card), so the site has one iconography and it is made of the
work's own data.

If the line cannot be made to look deliberate and precise, it is cut
and the home page stands on type alone.

## Page by page

- **Home.** First screen: the name set very large as text (it is the
  largest thing on the site and it paints with the first byte), the
  line "AI and developer tooling builder.", one sentence, the nav.
  Then the statement in the serif. Then the eight stations, one to a
  screen-high row: number, kind, name (a link to its page), one
  plain line, its live figure where it has one, and its piece of the
  line. Then the interests as the delta. Then the ending: the
  headline in the serif, the small line, Email as the one action,
  the other links as a quiet row. About 200 words.
- **Work.** A typographic index: the eight as rows (number, mark,
  name, one line, kind, year), then "Also", then the archive with its
  search. No pictures of scenery.
- **A project.** Name, one line, its mark drawn large, the facts
  (role, status, links) as a small table; then the page's own
  substance as it is now (how it works, real product media, real
  numbers), on the grid at reading sizes; then the next project as
  one line of type.
- **Writing.** With one post the page is that post's cover; with
  more, a list under a lead.
- **A post.** Title at display size, "Published" and the date,
  reading time, tags; the text at a reading measure with its contents
  beside it on wide screens.
- **Not found.** One line and two ways out.

## Type, colour, space

- Display: TASA Orbiter, weights 500 to 700 (nothing heavier), tight
  tracking at large sizes. Sizes from one scale with a real jump
  between steps: the name about a seventh of the viewport's width,
  station names large, running text 18 to 20 px, labels 13 px in the
  mono. Sentence case. `text-wrap: balance` on headings, `pretty` on
  running text, no orphans.
- Page `#f6f7f8`, ink `#0b0d0e`, a second ink for secondary text, a
  hairline for rules; before dawn the reverse. One accent (a cold
  water blue, checked for contrast in both themes) for the line, live
  figures and the current state of a control. Nothing else is
  coloured. Product media keeps its own colours.
- A twelve-column grid with one gutter, one margin and one spacing
  scale (4, 8, 12, 16, 24, 32, 48, 64, 96, 128). Corners square or
  nearly so. Rules are hairlines. No cards.

## Motion

- Nothing moves on load except the page arriving. No section fades
  up. Text is never animated in.
- The line draws with scroll (transform and stroke only, by the
  browser's scroll timeline; fully drawn where that is unsupported or
  motion is reduced).
- Controls: press feedback `scale(0.97)` at pointer-down, 120 ms;
  hover (fine pointers only) 180 ms; small layers about 200 ms,
  ease-out in and out, the exit a fifth faster, scaling from their
  trigger and never from `scale(0)`. One curve for arriving
  (`cubic-bezier(0.23, 1, 0.32, 1)`), one for moving, one for leaving.
- Between pages: an instant navigation with the title carried across
  (a view transition of about 300 ms; a plain swap where unsupported
  or motion is reduced). Routes are prefetched.
- cc-switch's selector is the one thing a visitor can throw: the
  line's branch changes with it.

## Performance is part of the design

No WebGL, no canvas, no animation library, no web font beyond the
three subset files; server-rendered pages with client code only for
the theme toggle, the archive's search, the selector and the film.
The gate (Lighthouse 95 or more on a throttled phone and 100 on a
desktop for every page; LCP under 1.2 s and 2.0 s; CLS under 0.02;
INP under 100 ms; under about 120 KB of JavaScript on the home
page's first load; 120 fps scrolling with no task over 50 ms) is
measured after this build and recorded in `docs/site-system/`.

## What becomes of the maintainer pack

The pack is rewritten for this site: a station is one typed
definition (its content, its figure of the line, its live number),
and "add a station" is one definition and one small SVG figure.
