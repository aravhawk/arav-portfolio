# The blog

The index (`/blog`) and a post (`/blog/[slug]`) are inner pages
like the others: `InnerPage`, `src/app/inner.css`, no scene code.
See "Inner pages" in [architecture.md](architecture.md).

## What is not touched

- `content/posts/` (the owner's writing) and `blog-editor/` (his
  local editor) are never changed:
  `git diff 9a487fb -- content/posts blog-editor` must stay empty.
- No newsletter, CMS, backend or email work. Those are the owner's
  decisions, later.

## The content seam

The blog's pages do not know where a post comes from, so a backend
or a CMS can replace the files without a redesign.

- `src/lib/posts/` is the seam. `types.ts` defines `Post` and
  `PostSource` (`all()`, newest first; `get(slug)`).
  `mdx-files.ts` is the one source today: MDX files with front
  matter in `content/posts/`. `index.ts` sets the source and
  exports what pages use: `getAllPosts`, `getPostBySlug`,
  `getAllPostSlugs`, `getAllTags`, `getAdjacentPosts`.
- Pages and components import only from `@/lib/posts`. Nothing
  under `src/app/` or `src/components/` reads the file system,
  parses front matter or names `content/posts`.
- To take posts from elsewhere: write another object of type
  `PostSource` and set it as the source in
  `src/lib/posts/index.ts`. If it is asynchronous, make the two
  methods return promises and await them in the pages, which are
  server components. No layout or style changes.
- The feed (`src/app/feed.xml/route.ts`), the sitemap
  (`src/app/sitemap.ts`) and the share cards read posts through the
  same seam.

## The pages as built

- **The index** (`src/app/blog/page.tsx`). The newest post is the
  page: its date, reading time and tags, its title, its
  description, how it opens
  (`src/components/blog/opening.ts`), and "Read it". Older posts
  are a list under it. With one post there is no empty list; with
  none there is one line.
- **A post** (`src/app/blog/[slug]/page.tsx`). The head has the
  title a step smaller than a name (`long`), "Published" and the
  date, the reading time, the description as the lead, and the
  tags. The text is set at a reading measure (`.prose`) with its
  contents beside it on a wide screen and folded above it on a
  narrow one (`src/components/blog/contents.ts`,
  `tests/blog/contents.test.ts`). The date and the reading time
  appear once. Code is highlighted on the server.
- **Share cards**: type on the page's ground, no scene
  (`src/app/blog/opengraph-image.tsx`,
  `src/app/blog/[slug]/opengraph-image.tsx`).

## Rules

- **Dates** render in America/Chicago (`src/lib/dates.ts`). The
  date a post was published and the date of the work it describes
  are two things: never show one as the other.
- **Addresses**: canonicals, the sitemap, robots, structured data
  and the feed's links all point to `https://arav.pro`
  (`src/lib/site.ts`).
- **The index works with one post and with many.** No empty chrome
  at any count.
- **Copy**: [copy.md](copy.md) applies to the interface's words.
  The post's own words are the owner's and stay as they are.
- **Mono** loads only where a page shows code. Do not put a mono
  label in the shared head.

## Check

`pnpm exec vitest run tests/blog`; the index and a post at 1440,
390 and 320 in both themes; Lighthouse on `/blog` and the post
([performance.md](performance.md)).

Change log: 2026-11-18 first version; 2026-11-19 revised for the
rebuilt inner pages (M1).
