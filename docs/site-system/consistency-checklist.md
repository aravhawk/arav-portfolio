# The consistency checklist

Run the lines that apply before a change is called done. Each is a
command or a look. A line you could not run is said in your report,
not skipped. Commands assume a production build on port 3189 and
`pw="$HOME/.t3/portfolio-redesign-v4/tools/node_modules"`.

## Every change

1. `pnpm lint` is clean.
2. `pnpm build` is clean, **then** `pnpm exec tsc --noEmit`, in
   that order (the build writes the route types the typecheck
   reads).
3. `pnpm exec vitest run` passes (14 files, 223 tests today).
4. `git status --short` shows only files you meant to change, and
   nothing staged that belongs to another change.
   `git diff 9a487fb -- content/posts blog-editor` is empty.
5. No console error on the pages you touched.
6. `NODE_PATH="$pw" node docs/site-system/measure/words.cjs
   http://localhost:3189`: 200 words on the home page, no dashes,
   no banned names.

## A change to the home page or a scene

7. Scroll the whole page, top to bottom and back, wide (1440 by
   900) and tall (390 by 844), in both themes. Nothing stretched,
   popped, half loaded or empty. Then look at 24 evenly spaced
   frames of each of the four as one sheet: the page reads as one
   world.
8. Every scene you touched, with its real words on, at the start
   and at the end of its push, wide and tall, day and night: the
   words stand on calm ground and can be read. At night look twice.
9. The whiteout into and out of it, forward and back. A reload in
   the middle of the page. A jump from the top to the end.
10. Scripts off, and reduced motion: twelve sections, each its
    still and its words, a readable page.
11. Keyboard: Tab through every link; each is visible when focused
    and its scene follows.
12. The nav's counter reads `NN / 12` (or the new count).
13. Sound on: no click on toggle, on a fast scroll or on a jump;
    `pnpm exec vitest run tests/sound` passes.
14. `docs/site-system/measure/first-load-js.sh
    http://localhost:3189 /` says ok.
15. GPU time and bytes for the scene are inside the budget
    ([performance.md](performance.md)); the scroll trace shows no
    task over 50 ms.

## A change to an inner page

16. The page at 1440, 390 and 320 wide, both themes: one `h1`, no
    horizontal scroll, nothing clipped, targets 44 px, focus
    visible.
17. No scene, canvas or audio code reaches it:
    `first-load-js.sh http://localhost:3189 <route>` says ok.
18. Its picture, if it has one, is AVIF or WebP with width and
    height; only the first screen's is eager.
19. Its share card at `<route>/opengraph-image` (a project's is
    `/work/<slug>/opengraph-image/card`): words clear of the
    subject.
20. Canonical, share image, feed and sitemap addresses are on
    `https://arav.pro`.

## The gate

21. `docs/site-system/measure/lighthouse.sh http://localhost:3189
    .tools/out/lh <routes you touched> /`: 95 or more on the phone,
    100 on the desktop; accessibility, best practices and SEO 100;
    LCP and CLS inside the limits. Compare with a run from before
    your change.

## The look

22. Nothing in [scenes.md](scenes.md) under "What fails, by name".
23. No glass, blur, gradient as decoration, shadow under words, or
    panel behind words. No new type size, spacing step or easing.
24. Motion follows [motion.md](motion.md): layers open from their
    trigger, press is `scale(0.97)`, nothing animates for the
    keyboard, nothing fades up on scroll.
25. Copy follows [copy.md](copy.md).

## Not checked by any tool here

Say which of these you did by eye, or did not do: WebKit and
Firefox; a real phone; a 120 Hz display; forced colours and print;
contrast of words over the night picture; INP.

Change log: 2026-11-19 rewritten for the baked scenes (M1).
