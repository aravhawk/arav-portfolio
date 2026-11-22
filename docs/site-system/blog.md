# The blog

Status: the rules and the content seam are **as built**; the
redesign of the index and the post page is **in progress** (this
page is updated when it lands).

## Scope

The blog index (`/blog`) and post pages (`/blog/[slug]`) are full
parts of the site: the same motion system, light and materials,
transitions and frame budget as everything else
(`motion.md`, `light-and-materials.md`, `performance.md`). They are
designed states, not afterthoughts.

## What is not touched

- `content/posts/` (the owner's writing) and `blog-editor/` (his
  local editor) are never changed:
  `git diff 9a487fb -- content/posts blog-editor` must stay empty.
- No newsletter, CMS, MCP, backend or email work. Those are the
  owner's decisions, later.

## The content seam

The blog's UI must not know where a post comes from, so a backend or
CMS can replace the files without a redesign.

- **As built:** `src/lib/posts/` is the seam. `types.ts` defines
  `Post` and `PostSource` (`all()`, newest first; `get(slug)`);
  `mdx-files.ts` is the one source today (MDX files with front
  matter in `content/posts/`); `index.ts` sets the source in one
  line and exports what pages use (`getAllPosts`, `getPostBySlug`,
  `getAllPostSlugs`, `getAllTags`, `getAdjacentPosts`). Pages and
  components import only from `@/lib/posts`; nothing under
  `src/app/` or `src/components/` reads the file system, parses
  front matter or names `content/posts`.
- To take posts from a CMS or a backend: write another object of
  type `PostSource` and set it as `source` in
  `src/lib/posts/index.ts`. If the new source is asynchronous, make
  the two methods return promises and await them in the pages (they
  are server components); no layout or style changes.
- The feed (`src/app/feed.xml/route.ts`), the sitemap and the share
  images read posts through the same seam.

## Rules

- **Nothing covers a name or a heading.** No water, band or effect
  over the post's title or any heading; titles stand on calm ground.
  `scripts/overlap-test.mjs` measures every line against its ground
  on both blog pages at all widths.
- **Dates** are rendered in America/Chicago (`src/lib/dates.ts`).
  The date a post was published and the date of the work it
  describes are two different things: never show one as the other.
- **Addresses**: every post has a designed Open Graph image
  (`src/app/blog/[slug]/opengraph-image.tsx`); canonicals, the
  sitemap, robots, structured data and the feed's links all point to
  `https://arav.pro` (`src/lib/site.ts` is the one place the address
  lives).
- **The index works with one post and with many.** With one post the
  page is that post's cover; with a few it steps to a short list
  under a lead; with many, a list that can be scanned and searched.
  No empty index chrome at any count.
- **Checks**: a post page at 1440 and at 390 is part of the
  typography checks and of Lighthouse.
- **Copy**: the product-copy rule (`copy.md`); no em dashes in new
  UI copy (the post's own words are the owner's and stay as they
  are); no bot names on the public site.
- Not the hardened look of November 9 (rejected). The references are
  igloo.inc, landonorris.com and lusion.co.

## As built (2026-11-18)

- The index leads with the newest post as the page (its title at
  display size, when it was published, how long it reads, what it is
  about and how it opens, one action), and lists the rest under it
  when there are more. With one post there is no empty list.
- A post's page opens on the lake's band with the title at the size
  the index shows it (`.band-title-long` in `src/app/pages.css`), so
  the title arrives as the same line through the shared view
  transition (`post-<slug>`). The band's first line says "Published"
  with the date; the margin beside the text holds the date, the
  reading time, the tags and the post's own headings.
- Checked on 2026-11-18: the canonical, `og:url`, `og:image`, the
  feed's links, the sitemap, robots and the `BlogPosting` data all
  give `https://arav.pro` addresses.

Change log: 2026-11-18 first version; the seam and the post's title
as built (orchestrator).
