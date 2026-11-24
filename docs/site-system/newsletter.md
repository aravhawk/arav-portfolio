# The newsletter's signup

Status: **as built** (N1, 2026-11-21; set into yesterday's build and
recomposed by R1 the same day). The site makes its own table on the
first signup: see "The table".

**Nothing is sent to anyone.** There is no mail provider. An address is
stored, and that is all the signup does. No line of copy promises a
schedule.

## Where it lives

| What | Where |
| --- | --- |
| The field (one component, three places) | `src/components/subscribe/SubscribeForm.tsx`: the home page's ending (`EndingWords.tsx`, `compact`), `/blog` after the posts (`split`), and the answer pages |
| Its look | the last section of `src/app/home.css` (`.sub*`); its place in the ending: `.fl-end-foot` in `src/app/flight.css` |
| Every sentence, the address check, the trap's name | `src/lib/subscribe/messages.ts` |
| The decisions (limit, trap, check, store) | `src/lib/subscribe/core.ts`, with the database call and the limiter handed in |
| The limiter | `src/lib/subscribe/limiter.ts` |
| The one SQL statement | `src/lib/subscribe/db.ts` (Neon serverless driver, `DATABASE_URL`) |
| The route | `src/app/api/subscribe/route.ts` (POST only) |
| The pages a form post without scripts lands on | `src/app/newsletter/[state]/page.tsx` (five, static, not indexed, not in the sitemap) |
| The table | `db/subscribers.sql`. The site makes it itself if it is missing, once on each warm instance before its first insert (`src/lib/subscribe/schema.ts`, the same statement: a test holds the two equal). `pnpm db:apply` (`scripts/db-apply.mjs`) applies and describes it from a machine that has the connection string |
| Tests | `tests/subscribe/` (no network: the database call is replaced) |
| End to end, and every state photographed | `scripts/subscribe-e2e.mjs`, `scripts/subscribe-states.mjs`, `scripts/lib/neon-standin.mjs` |

## Where it stands

- **The home page's ending.** The foot is one block at one width
  (`.fl-end-foot`): the four ways to reach him; under them the field,
  from the row's first letter to its last; and one line of small print
  hung under the block (when the numbers were read at its left, the
  feed at its right, under the button). The row sets the block's
  width; the field asks for none. On a phone the block is the frame's
  width and the row's links are spread from edge to edge. The field's
  label and what a subscriber gets are said to assistive technology
  only: the field's own words ("Email for new posts") say what it is
  for. What went wrong is said in the small print's line, and the line
  about the numbers steps aside while it stands.
- **`/blog`.** A section of the page's own kind after the posts: its
  groove, its heading ("Newsletter"), and under them the page's two
  columns, the same two as the post over it. What a subscriber gets at
  the left, in the type the post's first sentence is set in; the field
  at the right, on the column the post's words and its way in stand
  on, a step larger than in the ending (a 56 px pill, the page's body
  size), as the page's other small things are.
- **The answer pages** (`/newsletter/<answer>`, scripts off only): the
  plain field under the answer when the reader should try again.

## How it behaves

It follows the owner's other signup (the waiting list at
infiniview.dev), reworded for a newsletter.

- **Idle.** A labelled field of the email type and a "Subscribe" button
  in one hairline pill. No panel, no shadow.
- **Sending.** The button says "Subscribing…" and is `aria-disabled`
  (not disabled: it keeps focus); the field is read-only; a second
  press does nothing; the request is given up after 10 s.
- **Subscribed / already subscribed.** Only once the server has said
  yes, the field is replaced, in the same place, by the sentence
  (`role="status"`), which takes focus. A duplicate is told "You're
  already subscribed" and nothing else is revealed.
- **Looks wrong / too many tries / something failed.** The reader stays
  in the field with what was typed; the reason stands under the field
  in a line that is always in the page (`aria-live="polite"`) and has
  its place kept (on a page), or takes the small print's place (in the
  ending), so nothing moves. Typing again takes it away. After a
  failure the button says "Try again".
- **Nothing is remembered in the browser.** After a reload the field is
  there again; the server is the one that knows.
- **Without scripts** the browser posts the form and is sent (303) to
  `/newsletter/<answer>`. The address is never in an address bar.
- **Motion.** The press is `scale(0.97)`; the confirmation comes from
  where the button was and the reason from the field, 180 ms, ease-out,
  transform and opacity only; a submit from the keys moves nothing
  (`data-instant`); reduced motion: a fade.

## The route

POST only (anything else: 405). A body of JSON or of a form post, at
most 2 kB, and not from another site (`Sec-Fetch-Site`). In order: the
limiter; the trap (a hidden field no reader fills: a filled one gets
the friendly answer and nothing is stored); the address, trimmed and
lower-cased, against a pattern and 254 characters; then
`INSERT ... ON CONFLICT (email) DO NOTHING RETURNING id`. Answers are
never cached. No address and no secret is logged. Without
`DATABASE_URL`, or without the table, it answers that something failed.

**The limiter's limits.** Five tries a minute and thirty a day for one
requester, counted in the memory of one warm function instance. Several
instances may run at once and each forgets when it goes cold, so this
blunts a loop from one address and is not a durable limit; sustained
abuse needs a rule at Vercel's edge. No network address is kept: the
key is a hash with a salt that lives only in that instance's memory.

## The table

```sql
CREATE TABLE IF NOT EXISTS subscribers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,          -- unique, lower case, 3 to 254 characters
  created_at  timestamptz NOT NULL DEFAULT now(),
  source      text,                          -- home, blog or page
  confirmed   boolean     NOT NULL DEFAULT false
);
```

To apply it (safe to run again), with the connection string in
`DATABASE_URL` or in `.env.local` (git-ignored):

    pnpm db:apply

It prints the database's own description of the table and the count of
rows. The Neon integration marks its variables sensitive in Vercel, so
`vercel env pull` returns them withheld: copy the connection string
from the Neon console into `.env.local` yourself. Never commit it.

## When it changes

- A new sentence: `messages.ts`. Each of the three reasons must set in
  one line in the ending's small print at 390 wide, clear of the feed
  at the line's right end; `scripts/subscribe-states.mjs` measures it.
- The home page shows one word of the field ("Subscribe"): the page's
  count is 301, 300 and that word (`copy.md`). Do not add a visible
  line to the ending: the block's height is what keeps the headline
  low in the frame on a phone.
- Anything added to the ending's foot needs the three rules the rest
  of it has in `flight.css`: its entrance with the block (`data-set`),
  its presses held until then, and both again for the page without
  scripts.
- Keep the field's rules in `home.css` and the component without a
  `'use client'` of its own (it rides in `Ending.tsx`'s module): as
  files of their own they are one more script and one more stylesheet
  before the first paint (`performance.md`).
- After any change: `scripts/subscribe-states.mjs` (add `--noscript`
  with the stand-in running) and `scripts/click-test.mjs` against a
  production build. To run the site with the stand-in for the
  database, see the head of `scripts/lib/neon-standin.mjs`.

Change log: 2026-11-21 N1 first version. 2026-11-21 R1: its place in the
ending and on /blog.
