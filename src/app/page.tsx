import type { Viewport } from 'next';
import Link from 'next/link';
import { Film } from '@/components/home/Film';
import { CopyEmail } from '@/components/inner/CopyEmail';
import { Arrow, Live } from '@/components/inner/bits';
import { KIND } from '@/content/kinds';
import { CONTACT, INTERESTS, PROJECTS, type Project } from '@/content/projects';
import { formatAsOf, getMetrics, type SiteMetrics } from '@/lib/metrics';
import { THEME_COLOR } from '@/lib/site';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { scenes, starts } from '@/scene/flight/scenes';
import { sceneStills } from '@/scene/stills';
import './home.css';

/**
 * The home page: twelve scenes, one after another down the page, and the
 * site's words in the document where they belong. Each section is as long
 * as its scene's scroll and holds that scene's words; the picture is one
 * canvas fixed behind them all (SceneCanvas), drawn by src/scene. Where the
 * canvas does not draw (scripts off, reduced motion, no WebGL2) each
 * section shows its scene's still and its words: a plain page.
 */

// Live numbers are read on the server and cached for an hour. A visitor's
// page view never reaches GitHub, npm or Ollama.
export const revalidate = 3600;

// The browser's chrome takes the colour of the first frame's sky.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.home.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.home.dark },
  ],
};

/**
 * The page's first script: does it fly? Decided before the first paint, so
 * nothing moves when the canvas arrives. (SceneCanvas decides again after a
 * route change, and falls back if the renderer cannot start.)
 */
const FLIGHT_BOOT = `(function(){try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&window.WebGL2RenderingContext)document.documentElement.dataset.flight=''}catch(e){}})()`;

/** Each scene: where it starts, its push and the whiteout after it, in screens of scroll. */
const PLAN = scenes.map((s, i) => [starts[i], s.screens, s.exit] as const);

const SAY = ['Agents that break', 'software before', 'attackers do.', 'Tools developers', 'run daily.'];

/**
 * The seven repositories, as each one's own page names it (its README's
 * heading, or where it has none the repository's name as GitHub shows it):
 * read 18 November 2026.
 */
const REPO_NAME: Record<string, string> = {
  'pingdotgg/t3code': 'T3 Code',
  'AvinashDevineni/ThrasherAndChambersWebsite': 'Thrasher & Chambers Website',
  'junhoyeo/tokscale': 'Tokscale',
  'Kanishksasi/Investo': 'Investo',
  'Kilo-Org/kilocode': 'Kilo Code',
  'devMEremenko/XcodeBenchmark': 'XcodeBenchmark',
  'fakerybakery/openbridge': 'OpenBridge',
};
/** The three profiles cc-switch ships with: the three branches of its scene. */
const PROFILES = ['claude', 'kimi', 'ollama'];

const project = (slug: string) => PROJECTS.find((p) => p.slug === slug)!;

/** What a station is, its name as the way into its page, and its one line. */
function Station({ p }: { p: Project }) {
  return (
    <>
      <p className="hm-kind">{KIND[p.slug]}</p>
      <h2 className="hm-name">
        <Link href={`/work/${p.slug}`} prefetch={false}>
          {p.name}
          <Arrow />
        </Link>
      </h2>
      <p className="hm-line">{p.line}</p>
    </>
  );
}

/** The words of each scene, by the scene's name in the registry. */
function words(id: string, m: SiteMetrics): React.ReactNode {
  switch (id) {
    case 'lake':
      return (
        <>
          {/* The name is the picture's: letters of ice on the lake. It stands here for readers and for search. */}
          <h1 id="name" className="sr-only">
            Arav Jain
          </h1>
          <p className="hm-role">
            <span>AI and developer</span> <span>tooling builder.</span>
          </p>
          <p className="hm-line">I co-founded Infiniflop Labs and build Infiniview: agents that attack your app to prove what breaks.</p>
        </>
      );
    case 'statement':
      return (
        <p className="hm-say">
          {SAY.map((line) => (
            <span key={line}>{line} </span>
          ))}
        </p>
      );
    case 'open-source': {
      const up = m.mergedPrs;
      return (
        <>
          <p className="hm-kind">Open source</p>
          <h2 className="hm-figure">
            <span className="hm-num">
              <Live value={up.upstream.value} source={up.upstream.source} asOf={formatAsOf(up.upstream.asOf)} what="merged pull requests in repositories I do not own" />
            </span>
            <span className="hm-line">merged pull requests in other people&apos;s projects</span>
          </h2>
          <p className="hm-meta">
            <Live value={up.total.value} source={up.total.source} asOf={formatAsOf(up.total.asOf)} what="merged pull requests in total" /> in all.{' '}
            <Live value={m.contributions.total.value} source={m.contributions.total.source} asOf={formatAsOf(m.contributions.total.asOf)} what={m.contributions.label} /> contributions.
          </p>
          <ul className="hm-names mono">
            {up.byRepo.slice(0, 7).map((r) => (
              <li key={r.repo}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`${r.repo}: ${r.count} merged pull request${r.count === 1 ? '' : 's'}`}>
                  {REPO_NAME[r.repo] ?? r.repo.split('/')[1]}
                </a>
              </li>
            ))}
          </ul>
          <Link className="hm-more" href="/work/open-source" prefetch={false}>
            Upstream <Arrow />
          </Link>
        </>
      );
    }
    case 'agent-bridge': {
      const p = project(id);
      const film = p.media[0];
      return (
        <>
          <Station p={p} />
          {film?.kind === 'video' ? <Film src={film.src} poster={film.poster} alt={film.alt} w={film.w} h={film.h} /> : null}
        </>
      );
    }
    case 'ollama':
      return (
        <>
          <p className="hm-kind">Models</p>
          <h2 className="hm-figure">
            <span className="hm-num hm-num-long">
              <Live value={m.ollama.total.value} source={m.ollama.total.source} asOf={formatAsOf(m.ollama.total.asOf)} what="pulls of my open models on Ollama" />
            </span>
            <span className="hm-line">pulls, four open models</span>
          </h2>
          <ul className="hm-names mono">
            {m.ollama.models.slice(0, 4).map((x) => (
              <li key={x.name}>
                <a href={x.url} target="_blank" rel="noopener noreferrer">
                  {x.name}
                </a>
              </li>
            ))}
          </ul>
          <Link className="hm-more" href="/work/ollama" prefetch={false}>
            Ollama <Arrow />
          </Link>
        </>
      );
    case 'cc-switch':
      return (
        <>
          <Station p={project(id)} />
          <p className="hm-meta">
            <Live value={m.npm.allTime.value} source={m.npm.allTime.source} asOf={formatAsOf(m.npm.allTime.asOf)} what="npm downloads of cc-switch, all time" /> npm downloads.
          </p>
          <ul className="hm-names mono" aria-label="Profiles">
            {PROFILES.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      );
    case 'interests':
      return (
        <>
          <p className="hm-kind" id="into">
            Interests
          </p>
          <ul className="hm-into">
            {INTERESTS.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="hm-line">Next: a company, a research paper, and code in tools you open daily.</p>
          <Link className="btn hm-btn" href="/work">
            All work <Arrow />
          </Link>
        </>
      );
    case 'ending':
      return (
        <>
          <h2 className="hm-name hm-end">This was the warm-up.</h2>
          <p className="hm-kind hm-end-kicker">The next station isn&apos;t built yet.</p>
          {/* Email is the one action; the rest is a quiet row. */}
          <ul className="hm-reach">
            <li className="hm-email">
              <a className="btn hm-btn" href={`mailto:${CONTACT.email}`}>
                Email
              </a>
              <CopyEmail email={CONTACT.email} />
            </li>
            <li>
              <a href={CONTACT.github} target="_blank" rel="noopener noreferrer">
                GitHub <Arrow out />
              </a>
            </li>
            <li>
              <a href={CONTACT.x} target="_blank" rel="noopener noreferrer">
                X <Arrow out />
              </a>
            </li>
            <li>
              <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn <Arrow out />
              </a>
            </li>
            <li>
              <a href="/feed.xml">RSS</a>
            </li>
          </ul>
        </>
      );
    default:
      return <Station p={project(id)} />;
  }
}

/** How each section is named for a reader who moves by landmark. */
const LABEL: Record<string, React.AriaAttributes> = {
  lake: { 'aria-labelledby': 'name' },
  statement: { 'aria-label': 'What I do' },
  'open-source': { 'aria-label': 'Open source' },
  ollama: { 'aria-label': 'Open models' },
  interests: { 'aria-labelledby': 'into' },
  ending: { 'aria-label': 'Contact' },
};

export default async function Home() {
  const m = await getMetrics();
  return (
    <main id="main" className="hm">
      <script dangerouslySetInnerHTML={{ __html: FLIGHT_BOOT }} />
      <SceneCanvas plan={PLAN} />
      {scenes.map((scene, i) => {
        const last = i + 1 === scenes.length;
        const still = sceneStills(scene.id);
        const style = {
          '--len': scene.screens + (last ? 1 : scene.exit),
          '--d': `url(${still.day})`,
          '--n': `url(${still.night})`,
          '--dt': `url(${still.dayTall})`,
          '--nt': `url(${still.nightTall})`,
        } as React.CSSProperties;
        const label = LABEL[scene.id] ?? { 'aria-label': project(scene.id).name.replace('‑', '-') };
        return (
          <section key={scene.id} className="sc" data-scene={scene.id} style={style} {...label}>
            <div className="sc-still" aria-hidden="true" />
            <div className="sc-words" data-copy={scene.id} data-placement={scene.words} data-on={i === 0 ? '' : undefined}>
              {words(scene.id, m)}
            </div>
          </section>
        );
      })}
    </main>
  );
}
