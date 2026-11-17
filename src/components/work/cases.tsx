import { Arrow } from '@/components/bits';
import { ProfileSwitch } from '@/components/home/ProfileSwitch';
import { LiveNumber } from '@/components/LiveNumber';
import type { Project, ProjectMedia } from '@/content/projects';
import { formatPostDate } from '@/lib/dates';
import { formatAsOf, formatCount, type Metric, type SiteMetrics } from '@/lib/metrics';
import { Facts, Figures, Intro, Outs, Pair, Plate, PlateRow, Quote, Sec, Steps } from './blocks';
import {
  BRIDGE_FLOW,
  BRIDGE_NUMBERS,
  INFINIVIEW_PUBLISHED,
  KILO_MODES,
  KILO_NUMBERS,
  KILO_VIEWS,
  MODEL_NOTES,
  RYDAR_NUMBERS,
  RYDAR_QUOTE,
  SWITCH_GROUPS,
  SWITCH_LINES,
  SWITCH_QUOTE,
  T3_PRS,
  TENSOR_BACKENDS,
  TENSOR_GATES,
  TENSOR_STACK,
} from './case-data';

/**
 * The eight project pages. Each is laid out for what the project has:
 * plates where there are pictures, a film where there is one, and where
 * there is no imagery a piece drawn from the project's own facts (a
 * terminal, a chart, a ledger, a diagram).
 */

const pic = (p: Project, name: string): ProjectMedia => p.media.find((x) => x.src === `/media/${name}`) ?? p.media[0];

function Live({ metric, what }: { metric: Metric; what: string }) {
  return <LiveNumber value={metric.value} from={metric.snapshotValue} source={metric.source} asOf={formatAsOf(metric.asOf)} what={what} />;
}

/* ---------- 01 Infiniview: plates ---------- */

function Infiniview({ p }: { p: Project }) {
  return (
    <>
      <Intro p={p} />
      <PlateRow media={pic(p, 'infiniview-finding.webp')} caption="A finding on infiniview.dev, with its attack path" priority />
      <Steps p={p} variant="row" />
      <Pair a={pic(p, 'infiniview-dash-findings.webp')} b={pic(p, 'infiniview-dash-review.webp')} caption="The public demo at infiniview.dev/preview. Sample data." />
      <PlateRow media={pic(p, 'infiniview-findings.webp')} />
      <Figures label="As published on infiniview.dev" id="p-figs" items={INFINIVIEW_PUBLISHED} />
      <Sec className="sec-quote" label="In its own words">
        <Quote text="Real exploits, not guesses" source="infiniview.dev" wide />
      </Sec>
      <Pair a={pic(p, 'infiniview-pipeline.webp')} b={pic(p, 'infiniview-arsenal.webp')} lean />
    </>
  );
}

/* ---------- 02 Upstream: the ledger ---------- */

function Upstream({ p, m }: { p: Project; m: SiteMetrics }) {
  const max = Math.max(...m.mergedPrs.byRepo.map((r) => r.count), 1);
  return (
    <>
      <Figures
        label="Counted live"
        id="p-figs"
        items={[
          { value: <Live metric={m.mergedPrs.upstream} what="merged pull requests in repositories I do not own" />, unit: `merged upstream, in ${m.mergedPrs.upstreamRepoCount} repositories` },
          { value: <Live metric={m.mergedPrs.total} what="merged pull requests in total" />, unit: 'merged in all, public' },
          { value: <Live metric={m.contributions.total} what={m.contributions.label} />, unit: m.contributions.label },
        ]}
      />
      <Intro p={p} />
      <Sec className="sec-bars" label="By repository" id="p-repos">
        <ol className="bars">
          {m.mergedPrs.byRepo.map((r) => (
            <li key={r.repo} className="bar-row">
              <a className="bar-name mono" href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`${r.repo}: ${r.count} merged pull request${r.count === 1 ? '' : 's'}`}>
                {r.repo}
              </a>
              <span className="bar-track" aria-hidden="true">
                <span className="bar-fill" style={{ '--w': r.count / max } as React.CSSProperties} />
              </span>
              <span className="bar-n" aria-hidden="true">
                {r.count}
              </span>
            </li>
          ))}
        </ol>
      </Sec>
      <Sec className="sec-changes" label="In T3 Code: eight of them, change by change" id="p-t3">
        <ol className="changes">
          {T3_PRS.map((x) => (
            <li key={x.n} className="change">
              <a className="change-n mono" href={`https://github.com/pingdotgg/t3code/pull/${x.n}`} target="_blank" rel="noopener noreferrer" aria-label={`Pull request ${x.n} in T3 Code`}>
                #{x.n}
              </a>
              <div className="change-main">
                <h3 className="change-title">{x.title}</h3>
                <p className="body">{x.what}</p>
              </div>
              <p className="change-meta mono">
                <span>{formatPostDate(x.merged, 'short')}</span>
                <span>{x.size}</span>
              </p>
            </li>
          ))}
        </ol>
      </Sec>
      <Steps p={p} variant="row" label="Where" />
      <Sec className="sec-ledger" label="Every merged pull request" id="p-ledger">
        <div className="table-scroll">
          <table className="ledger">
            <thead>
              <tr className="label">
                <th scope="col">Repository</th>
                <th scope="col">Change</th>
                <th scope="col">Merged</th>
              </tr>
            </thead>
            <tbody>
              {m.mergedPrs.ledger.map((e) => (
                <tr key={e.url}>
                  <td className="mono">{e.repo.split('/')[1]}</td>
                  <td>
                    <a href={e.url} target="_blank" rel="noopener noreferrer">
                      {e.title}
                    </a>
                  </td>
                  <td className="mono">{formatPostDate(e.mergedAt, 'short')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>
    </>
  );
}

/* ---------- 03 Kilo Bench: the board ---------- */

function KiloBench({ p }: { p: Project }) {
  return (
    <>
      <PlateRow media={pic(p, 'kilo-bench-results.webp')} caption="Results inside Kilo Code: leaderboard, radar and a breakdown by mode" priority />
      <Intro p={p} />
      <Sec className="sec-modes" label="Every mode" id="p-modes">
        <ul className="modes">
          {KILO_MODES.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Sec>
      <Sec className="sec-trio" label="Details">
        <Plate media={pic(p, 'kilo-bench-start.webp')} sizes="(max-width: 859px) 94vw, 400px" className="plate-small" />
        <div className="trio-main">
          <Plate media={pic(p, 'kilo-bench-leaderboard.webp')} sizes="(max-width: 859px) 94vw, 1100px" />
          <div className="trio-under">
            <Plate media={pic(p, 'kilo-bench-radar.webp')} sizes="(max-width: 859px) 94vw, 500px" />
            <Quote text="Which model should I actually use for my project?" source="The question it answers, from the Devpost write-up" />
          </div>
        </div>
      </Sec>
      <Steps p={p} variant="list" />
      <Figures label="From the Devpost write-up" id="p-figs" items={KILO_NUMBERS} />
      <Sec className="sec-chips" label="Dashboard views" id="p-views">
        <ul className="chips-row">
          {KILO_VIEWS.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Sec>
    </>
  );
}

/* ---------- 04 Agent Bridge: the film ---------- */

function AgentBridge({ p }: { p: Project }) {
  const film = p.media.find((x) => x.kind === 'video');
  return (
    <>
      <Sec className="sec-film" label="The launch video">
        {film ? (
          <div className="film">
            <Plate media={film} />
            <p className="label plate-cap">The launch video. A dramatized example, not a screen recording.</p>
          </div>
        ) : null}
        {p.quote ? <Quote text={p.quote.text} source={p.quote.source} /> : null}
      </Sec>
      <Intro p={p} />
      <Sec className="sec-flow" label="One message, start to finish" id="p-flow">
        <ol className="flow">
          {BRIDGE_FLOW.map((x) => (
            <li key={x.title} className={`flow-step${x.ack ? ' flow-ack' : ''}`}>
              <span className="label flow-who">{x.who}</span>
              <h3 className="step-title">{x.title}</h3>
              <p className="flow-note">{x.note}</p>
            </li>
          ))}
        </ol>
      </Sec>
      <Figures label="Limits, from the README" id="p-figs" items={BRIDGE_NUMBERS} />
      <Steps p={p} variant="list" />
    </>
  );
}

/* ---------- 05 Open models: the chart ---------- */

function OpenModels({ p, m }: { p: Project; m: SiteMetrics }) {
  const max = Math.max(...m.ollama.models.map((x) => x.pulls), 1);
  return (
    <>
      <Sec className="sec-chart" label="Pulls by model" id="p-chart">
        <div className="chart-head">
          <p className="fig">
            <span className="fig-value">
              <Live metric={m.ollama.total} what="pulls of my open models on Ollama" />
            </span>
            <span className="fig-unit">
              pulls, {m.ollama.models.length} models, read from Ollama {formatAsOf(m.ollama.total.asOf)}
            </span>
          </p>
        </div>
        <ol className="cols" style={{ '--n': m.ollama.models.length } as React.CSSProperties}>
          {m.ollama.models.map((x) => (
            <li key={x.name} className="col" style={{ '--h': x.pulls / max } as React.CSSProperties}>
              <span className="col-n">{formatCount(x.pulls)}</span>
              <span className="col-bar" aria-hidden="true" />
              <a className="col-name mono" href={x.url} target="_blank" rel="noopener noreferrer" aria-label={`${x.name}: ${formatCount(x.pulls)} pulls`}>
                {x.name}
              </a>
            </li>
          ))}
        </ol>
      </Sec>
      <Intro p={p} />
      <Sec className="sec-models" label="Models" id="p-models">
        <ul className="models">
          {m.ollama.models.map((x) => {
            const note = MODEL_NOTES[x.name];
            return (
              <li key={x.name} className="model-row">
                <h3 className="model-title">
                  <a href={x.url} target="_blank" rel="noopener noreferrer">
                    {x.name} <Arrow out />
                  </a>
                </h3>
                <p className="body">
                  {note?.what ? `${note.what}. ` : ''}
                  {note?.sizes ?? ''}
                </p>
                <code className="mono model-run">{note?.run ?? `ollama run aravhawk/${x.name}`}</code>
                <span className="mono model-pulls">{formatCount(x.pulls)}</span>
              </li>
            );
          })}
        </ul>
      </Sec>
      <Steps p={p} variant="row" />
    </>
  );
}

/* ---------- 06 cc-switch: the terminal ---------- */

export function Terminal({ title, lines }: { title: string; lines: { cmd: string; note?: string }[] }) {
  return (
    <figure className="term" aria-label={`${title}: commands`}>
      <div className="term-bar" aria-hidden="true">
        <span className="term-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="term-title mono">{title}</span>
      </div>
      <pre className="term-body mono">
        {lines.map((l) => (
          <span key={l.cmd} className="term-line">
            {l.note ? <span className="term-note">{`# ${l.note}\n`}</span> : null}
            <span className="term-p" aria-hidden="true">
              ${' '}
            </span>
            <span className="term-cmd">{l.cmd}</span>
            {'\n'}
          </span>
        ))}
      </pre>
    </figure>
  );
}

function CcSwitch({ p, m }: { p: Project; m: SiteMetrics }) {
  return (
    <>
      <Sec className="sec-term" label="In the terminal">
        <div className="term-side">
          <p className="sum">{p.summary}</p>
          <ul className="figs figs-side">
            <li className="fig">
              <span className="fig-value">
                <Live metric={m.npm.allTime} what="npm downloads of cc-switch, all time" />
              </span>
              <span className="fig-unit">npm downloads, all time</span>
            </li>
            <li className="fig">
              <span className="fig-value">
                <Live metric={m.npm.lastMonth} what="npm downloads of cc-switch in the last month" />
              </span>
              <span className="fig-unit">in the last month</span>
            </li>
          </ul>
        </div>
        <Terminal title="cc-switch" lines={SWITCH_LINES} />
      </Sec>
      <Sec className="sec-groups" label="41 provider templates, in six groups" id="p-groups">
        <ul className="groups">
          {SWITCH_GROUPS.map((g) => (
            <li key={g.name} className="group">
              <span className="group-n">{g.n}</span>
              <h3 className="step-title">{g.name}</h3>
              {g.who ? <p className="body">{g.who}</p> : null}
            </li>
          ))}
        </ul>
      </Sec>
      <Sec className="sec-quote" label="In its own words">
        <Quote text={SWITCH_QUOTE.text} source={SWITCH_QUOTE.source} wide />
      </Sec>
      <Steps p={p} variant="list" />
      <Sec className="sec-facts" label="Facts" id="p-facts">
        <Facts facts={p.facts} />
      </Sec>
    </>
  );
}

/** The switch stands in the scene on the cc-switch page: it opens the dam's sluices, as on the home page. */
export function SwitchInScene() {
  return (
    <div className="band-fork" data-bed="feat:fork" data-active="0">
      <ProfileSwitch />
    </div>
  );
}

/* ---------- 07 TensorPoW: the diagram ---------- */

function TensorPoW({ p }: { p: Project }) {
  return (
    <>
      <Intro p={p} />
      <Sec className="sec-diagram" label="How it fits together" id="p-how">
        <ol className="dia">
          <li className="dia-row">
            <div className="dia-copy">
              <h3 className="step-title">{p.how[0].title}</h3>
              <p className="body">{p.how[0].body}</p>
            </div>
            <div className="dia-art dia-tensor" aria-hidden="true">
              <span className="dia-node dia-node-in mono">INT8 tensor challenge</span>
              <span className="dia-fan">
                {TENSOR_BACKENDS.map((b) => (
                  <span key={b} className="dia-node mono">
                    {b}
                  </span>
                ))}
              </span>
              <span className="dia-node dia-node-out mono">the same bits</span>
            </div>
          </li>
          <li className="dia-row">
            <div className="dia-copy">
              <h3 className="step-title">{p.how[1].title}</h3>
              <p className="body">{p.how[1].body}</p>
            </div>
            <div className="dia-art dia-chain" aria-hidden="true">
              {[3, 4, 2].map((n, i) => (
                <span key={i} className="dia-link">
                  <span className="dia-anchor" />
                  {Array.from({ length: n }, (_, k) => (
                    <span key={k} className="dia-fruit" />
                  ))}
                </span>
              ))}
              <span className="dia-anchor" />
              <span className="dia-key mono">
                <span>
                  <i className="dia-anchor" /> anchor block
                </span>
                <span>
                  <i className="dia-fruit" /> fruit block
                </span>
              </span>
            </div>
          </li>
          <li className="dia-row">
            <div className="dia-copy">
              <h3 className="step-title">{p.how[2].title}</h3>
              <p className="body">{p.how[2].body}</p>
            </div>
            <ul className="dia-art dia-stack" aria-hidden="true">
              {TENSOR_STACK.map((x) => (
                <li key={x.name} className="dia-part">
                  <span className="dia-part-name">{x.name}</span>
                  <span className="label">{x.does}</span>
                </li>
              ))}
            </ul>
          </li>
        </ol>
      </Sec>
      <Sec className="sec-gates" label="Not a live network yet. Before mainnet, per the README" id="p-gates">
        <ol className="gates">
          {TENSOR_GATES.map((g) => (
            <li key={g} className="gate">
              {g}
            </li>
          ))}
        </ol>
      </Sec>
    </>
  );
}

/* ---------- 08 RydAR: the map ---------- */

function RydAR({ p }: { p: Project }) {
  return (
    <>
      <PlateRow media={pic(p, 'rydar-map.webp')} caption="The public map at rydar.org" priority />
      <Figures label="From rydar.org and the README" id="p-figs" items={RYDAR_NUMBERS} />
      <Sec className="sec-phone" label="On the phone">
        <Plate media={pic(p, 'rydar-phone.webp')} sizes="(max-width: 859px) 70vw, 390px" className="plate-phone" />
        <div className="phone-side">
          <Quote text={RYDAR_QUOTE.text} source={RYDAR_QUOTE.source} />
          <p className="sum">{p.summary}</p>
          <Facts facts={p.facts} />
        </div>
      </Sec>
      <Steps p={p} variant="row" />
      <Pair a={pic(p, 'rydar-app.webp')} b={pic(p, 'rydar-how.webp')} caption="rydar.org: the iPhone app, and what goes into a curve warning" />
    </>
  );
}

const CASES: Record<string, (props: { p: Project; m: SiteMetrics }) => React.ReactNode> = {
  infiniview: Infiniview,
  'open-source': Upstream,
  'kilo-bench': KiloBench,
  'agent-bridge': AgentBridge,
  ollama: OpenModels,
  'cc-switch': CcSwitch,
  tensorpow: TensorPoW,
  rydar: RydAR,
};

/** A project's page, under its scene. */
export function Case({ p, m }: { p: Project; m: SiteMetrics }) {
  const Body = CASES[p.slug];
  return (
    <>
      {Body ? (
        <Body p={p} m={m} />
      ) : (
        <>
          <Intro p={p} />
          {p.media.map((x) => (
            <PlateRow key={x.src} media={x} />
          ))}
          <Steps p={p} />
        </>
      )}
      <Outs links={p.links} />
    </>
  );
}
