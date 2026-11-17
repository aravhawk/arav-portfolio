import { Arrow } from '@/components/bits';
import { ProfileSwitch } from '@/components/home/ProfileSwitch';
import { LiveNumber } from '@/components/LiveNumber';
import type { Project, ProjectMedia } from '@/content/projects';
import { formatPostDate } from '@/lib/dates';
import { formatAsOf, formatCount, type Metric, type SiteMetrics } from '@/lib/metrics';
import { HALF_SIZES, Note, Outs, Plate, Sec, Spec } from './blocks';
import {
  BRIDGE_FLOW,
  BRIDGE_LIMITS,
  BRIDGE_PEERS,
  INFINIVIEW_PASSES,
  KILO_MEASURES,
  KILO_MODES,
  KILO_VIEWS,
  MODEL_NOTES,
  RYDAR_CURVES,
  RYDAR_MORE,
  RYDAR_QUOTE,
  SWITCH_GROUPS,
  SWITCH_INSTALL,
  SWITCH_MORE,
  SWITCH_QUOTE,
  T3_PRS,
  TENSOR_BACKENDS,
  TENSOR_GATES,
  TENSOR_STACK,
  type Peer,
} from './case-data';

/**
 * The eight project pages. No two share a skeleton: each is built from what
 * the project is. A pipeline is drawn as a pipeline, a message flow as a
 * sequence diagram, a command line tool as a terminal session, a ledger as
 * a ledger. Numerals stand for a sequence only where there is none to draw
 * (there is not one such place left); a figure is set large only where it
 * is a result, and never in more than one row on a page.
 */

const pic = (p: Project, name: string): ProjectMedia => p.media.find((x) => x.src === `/media/${name}`) ?? p.media[0];

function Live({ metric, what }: { metric: Metric; what: string }) {
  return <LiveNumber value={metric.value} from={metric.snapshotValue} source={metric.source} asOf={formatAsOf(metric.asOf)} what={what} />;
}

/* ---------- 01 Infiniview: one run, drawn as the pipeline it is ---------- */

const RUN_SIZES = '(max-width: 859px) 94vw, (max-width: 1720px) 70vw, 1200px';

function Infiniview({ p }: { p: Project }) {
  const [trigger, sandbox, attack, proof] = p.how;
  return (
    <>
      <Sec className="iv-open" label="What it is">
        <p className="sum">{p.summary}</p>
        <Spec facts={p.facts} />
      </Sec>
      <Sec className="iv-run" title="One run, from pull request to proof" id="p-run">
        <ol className="run">
          {/* The first two stages share one picture: the product's own drawing of them. */}
          <li className="run-stage">
            <div className="run-copy">
              <div className="run-block">
                <h3 className="run-title">{trigger.title}</h3>
                <p className="body">{trigger.body}</p>
              </div>
              <div className="run-block">
                <h3 className="run-title">{sandbox.title}</h3>
                <p className="body">{sandbox.body}</p>
              </div>
            </div>
            <div className="run-show">
              <Plate media={pic(p, 'infiniview-pipeline.webp')} sizes={RUN_SIZES} priority caption="The pipeline as infiniview.dev shows it. Its illustration uses sample data." />
            </div>
          </li>
          <li className="run-stage">
            <div className="run-copy">
              <div className="run-block run-block-fork">
                <h3 className="run-title">{attack.title}</h3>
                <p className="body">{attack.body}</p>
              </div>
            </div>
            <div className="run-show">
              <ul className="lanes" aria-label="The three passes">
                {INFINIVIEW_PASSES.map((x) => (
                  <li key={x.pass} className="lane">
                    <span className="lane-pass">{x.pass}</span>
                    <span className="lane-line" aria-hidden="true" />
                    <span className="lane-what">
                      <strong>{x.n}</strong> {x.what}
                    </span>
                  </li>
                ))}
              </ul>
              <Plate media={pic(p, 'infiniview-layers.webp')} sizes={RUN_SIZES} caption="Counts as published on infiniview.dev." />
            </div>
          </li>
          <li className="run-stage">
            <div className="run-copy">
              <div className="run-block run-block-end">
                <h3 className="run-title">{proof.title}</h3>
                <p className="body">{proof.body}</p>
              </div>
            </div>
            <div className="run-show">
              <Plate media={pic(p, 'infiniview-attack-path.webp')} sizes={RUN_SIZES} caption="A finding on infiniview.dev with its attack path open." />
              <Plate media={pic(p, 'infiniview-findings.webp')} sizes={RUN_SIZES} />
              <div className="run-pair">
                <Plate media={pic(p, 'infiniview-dash-findings.webp')} sizes={HALF_SIZES} />
                <Plate media={pic(p, 'infiniview-dash-review.webp')} sizes={HALF_SIZES} />
                <p className="cap">The dashboard in the public demo at infiniview.dev/preview. Sample data.</p>
              </div>
            </div>
          </li>
        </ol>
      </Sec>
    </>
  );
}

/* ---------- 02 Upstream: the ledger ---------- */

function Diff({ size }: { size: string }) {
  const [add = 0, del = 0] = (size.match(/\d+/g) ?? []).map(Number);
  // Five cells, as a pull request's own page shows it: how much was added, how much removed.
  const filled = del === 0 ? 5 : Math.max(1, Math.min(4, Math.round((add / (add + del)) * 5)));
  return (
    <span className="diff">
      <span className="diff-n">{size}</span>
      <span className="diff-cells" aria-hidden="true">
        {Array.from({ length: 5 }, (_, k) => (
          <i key={k} className={k < filled ? 'diff-add' : 'diff-del'} />
        ))}
      </span>
    </span>
  );
}

function Upstream({ p, m }: { p: Project; m: SiteMetrics }) {
  const max = Math.max(...m.mergedPrs.byRepo.map((r) => r.count), 1);
  return (
    <>
      <Sec className="up-figs" label="Counted live">
        <ul className="figs" style={{ '--n': 3 } as React.CSSProperties}>
          <li className="fig">
            <span className="fig-value">
              <Live metric={m.mergedPrs.upstream} what="merged pull requests in repositories I do not own" />
            </span>
            <span className="fig-unit">merged upstream, in {m.mergedPrs.upstreamRepoCount} repositories</span>
          </li>
          <li className="fig">
            <span className="fig-value">
              <Live metric={m.mergedPrs.total} what="merged pull requests in total" />
            </span>
            <span className="fig-unit">merged in all, public</span>
          </li>
          <li className="fig">
            <span className="fig-value">
              <Live metric={m.contributions.total} what={m.contributions.label} />
            </span>
            <span className="fig-unit">{m.contributions.label}</span>
          </li>
        </ul>
        <p className="cap">Read from GitHub {formatAsOf(m.mergedPrs.upstream.asOf)}.</p>
      </Sec>
      <Sec className="up-open" label="What it is">
        <p className="sum">{p.summary}</p>
        <div className="notes">
          {p.how.map((h) => (
            <Note key={h.title} title={h.title}>
              {h.body}
            </Note>
          ))}
        </div>
      </Sec>
      <Sec className="sec-bars" title="By repository" id="p-repos">
        <ol className="bars">
          {m.mergedPrs.byRepo.map((r) => {
            const [owner, name] = r.repo.split('/');
            return (
              <li key={r.repo} className="bar-row">
                <a className="bar-name" href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`${r.repo}: ${r.count} merged pull request${r.count === 1 ? '' : 's'}`}>
                  <span className="bar-owner">{owner}/</span>
                  <span className="bar-repo">{name}</span>
                </a>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ '--w': r.count / max } as React.CSSProperties} />
                </span>
                <span className="bar-n" aria-hidden="true">
                  {r.count}
                </span>
              </li>
            );
          })}
        </ol>
      </Sec>
      <Sec className="sec-changes" title="In T3 Code: eight of them, change by change" id="p-t3">
        <ol className="changes">
          {T3_PRS.map((x) => (
            <li key={x.n} className="change">
              <a className="change-n" href={`https://github.com/pingdotgg/t3code/pull/${x.n}`} target="_blank" rel="noopener noreferrer" aria-label={`Pull request ${x.n} in T3 Code`}>
                #{x.n}
              </a>
              <div className="change-main">
                <h3 className="change-title">{x.title}</h3>
                <p className="body">{x.what}</p>
              </div>
              <p className="change-meta">
                <span>{formatPostDate(x.merged, 'short')}</span>
                <Diff size={x.size} />
              </p>
            </li>
          ))}
        </ol>
      </Sec>
      <Sec className="sec-ledger" title="Every merged pull request" id="p-ledger">
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
                  <td>{e.repo.split('/')[1]}</td>
                  <td>
                    <a href={e.url} target="_blank" rel="noopener noreferrer">
                      {e.title}
                    </a>
                  </td>
                  <td>{formatPostDate(e.mergedAt, 'short')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>
    </>
  );
}

/* ---------- 03 Kilo Bench: the result, then the three things it does, each beside what it makes ---------- */

function KiloBench({ p }: { p: Project }) {
  const [read, cover, judge] = p.how;
  const [result, ...rest] = p.facts;
  return (
    <>
      <Sec className="kb-open" label="What it is">
        <p className="say">{result.value}</p>
        <div className="kb-side">
          <p className="sum sum-s">{p.summary}</p>
          <Spec facts={rest} />
        </div>
      </Sec>
      <Sec className="kb-board" label="Results">
        <Plate media={pic(p, 'kilo-bench-board.webp')} priority caption="Results inside Kilo Code: the leaderboard and the radar. From the project’s Devpost gallery." />
      </Sec>
      <Sec className="kb-acts" label="How it works">
        <ol className="acts">
          <li className="act">
            <div className="act-copy">
              <h3 className="act-title">{read.title}</h3>
              <p className="body">{read.body}</p>
            </div>
            <Plate media={pic(p, 'kilo-bench-start.webp')} sizes="(max-width: 859px) 94vw, 560px" className="act-plate" caption="The Bench tab’s first screen." />
          </li>
          <li className="act">
            <div className="act-copy">
              <h3 className="act-title">{cover.title}</h3>
              <p className="body">{cover.body}</p>
            </div>
            <ul className="modes" aria-label="The five Kilo modes">
              {KILO_MODES.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </li>
          <li className="act">
            <div className="act-copy">
              <h3 className="act-title">{judge.title}</h3>
              <p className="body">{judge.body}</p>
            </div>
            <div className="matrix-wrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <td />
                    {KILO_MEASURES.map((x) => (
                      <th key={x.name} scope="col">
                        {x.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {KILO_MODES.map((mode) => (
                    <tr key={mode}>
                      <th scope="row">{mode}</th>
                      {KILO_MEASURES.map((x) => (
                        <td key={x.name}>
                          <i className={x.judged ? 'mark mark-judge' : 'mark mark-meter'} aria-hidden="true" />
                          <span className="sr-only">{x.judged ? 'scored by the judge' : 'captured automatically'}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="cap matrix-key" aria-hidden="true">
                <span>
                  <i className="mark mark-judge" /> scored by an AI judge
                </span>
                <span>
                  <i className="mark mark-meter" /> captured automatically
                </span>
              </p>
            </div>
          </li>
        </ol>
      </Sec>
      <Sec className="kb-views" label="Dashboard views">
        <p className="views">
          <span className="views-h">The dashboard, in five views</span>
          {KILO_VIEWS.join(', ')}
        </p>
      </Sec>
    </>
  );
}

/* ---------- 04 Agent Bridge: the film, then the message flow as a sequence diagram ---------- */

const peerName = (id: Peer) => BRIDGE_PEERS.find((x) => x.id === id)?.name ?? id;
/** Which rows of the diagram each of the README's three rules speaks to. */
const SEQ_NOTES = [
  { rows: '2 / 5', how: 0 },
  { rows: '5 / 6', how: 1 },
  { rows: '6 / 8', how: 2 },
];

function AgentBridge({ p }: { p: Project }) {
  const film = p.media.find((x) => x.kind === 'video');
  const optional = p.how[3];
  return (
    <>
      <Sec className="ab-film" label="The launch video">
        {film ? (
          <div className="film">
            <Plate media={film} />
            <p className="cap">The launch video. A dramatized example, not a screen recording.</p>
          </div>
        ) : null}
        {p.quote ? (
          <figure className="said">
            <blockquote className="say">“{p.quote.text}”</blockquote>
            <figcaption className="cap">{p.quote.source}</figcaption>
          </figure>
        ) : null}
      </Sec>
      <Sec className="ab-open" label="What it is">
        <p className="sum">{p.summary}</p>
        <Spec facts={p.facts} />
      </Sec>
      <Sec className="ab-seq" title="One message, start to finish" id="p-flow">
        <div className="seq">
          {BRIDGE_PEERS.map((x) => (
            <span key={x.id} className={`seq-head seq-at-${x.id}`} aria-hidden="true">
              {x.name}
            </span>
          ))}
          {BRIDGE_PEERS.map((x) => (
            <span key={x.id} className={`seq-life seq-life-${x.id}`} aria-hidden="true" />
          ))}
          <ol className="seq-steps">
            {BRIDGE_FLOW.map((x, i) => (
              <li key={x.title} className={`seq-msg seq-${x.from}-${x.to}${x.ack ? ' seq-ack' : ''}`} style={{ gridRow: i + 2 }}>
                <span className="label seq-route">
                  {peerName(x.from)}
                  {x.from !== x.to ? ` to ${peerName(x.to)}` : ''}
                </span>
                <span className="seq-title">{x.title}</span>
                <span className="seq-line" aria-hidden="true" />
                <span className="seq-note mono">{x.note}</span>
              </li>
            ))}
          </ol>
          {SEQ_NOTES.map((n) => (
            <div key={n.how} className="seq-aside" style={{ gridRow: n.rows }}>
              <Note title={p.how[n.how].title}>{p.how[n.how].body}</Note>
            </div>
          ))}
        </div>
      </Sec>
      <Sec className="ab-limits" label="Limits">
        <div>
          <ul className="limits">
            {BRIDGE_LIMITS.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="cap">Limits, from the README.</p>
        </div>
        {optional ? <Note title={optional.title}>{optional.body}</Note> : null}
      </Sec>
    </>
  );
}

/* ---------- 05 Open models: the chart ---------- */

function OpenModels({ p, m }: { p: Project; m: SiteMetrics }) {
  const max = Math.max(...m.ollama.models.map((x) => x.pulls), 1);
  return (
    <>
      <Sec className="sec-chart" label="Pulls by model">
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
              <a className="col-name" href={x.url} target="_blank" rel="noopener noreferrer" aria-label={`${x.name}: ${formatCount(x.pulls)} pulls`}>
                {x.name}
              </a>
            </li>
          ))}
        </ol>
      </Sec>
      <Sec className="om-open" label="What it is">
        <p className="sum">{p.summary}</p>
        <div className="notes">
          {p.how.map((h) => (
            <Note key={h.title} title={h.title}>
              {h.body}
            </Note>
          ))}
        </div>
      </Sec>
      <Sec className="sec-models" title="The four, and how to run each" id="p-models">
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
                <code className="mono model-run">
                  <span className="term-p" aria-hidden="true">
                    ${' '}
                  </span>
                  {note?.run ?? `ollama run aravhawk/${x.name}`}
                </code>
                <span className="model-pulls">{formatCount(x.pulls)}</span>
              </li>
            );
          })}
        </ul>
      </Sec>
    </>
  );
}

/* ---------- 06 cc-switch: a terminal session, each command with what it does beside it ---------- */

function CcSwitch({ p, m }: { p: Project; m: SiteMetrics }) {
  const [create, change, test] = p.how;
  const rows: { cmds: string[]; note?: { title: string; body: string } }[] = [
    { cmds: [SWITCH_INSTALL] },
    { cmds: ['cc-switch --create kimi --template kimi'], note: create },
    { cmds: ['cc-switch work'], note: change },
    { cmds: ['cc-switch --test'], note: test },
    { cmds: SWITCH_MORE },
  ];
  return (
    <>
      <Sec className="cs-open" label="What it is">
        <p className="sum">{p.summary}</p>
        <div className="cs-side">
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
          <Spec facts={p.facts.filter((f) => f.label !== 'Install')} />
        </div>
      </Sec>
      <Sec className="cs-session" label="In the terminal">
        <div className="session" style={{ '--n': rows.length } as React.CSSProperties}>
          <div className="session-bar" aria-hidden="true">
            <span className="term-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="term-title mono">cc-switch</span>
          </div>
          {rows.map((r, i) => (
            <div key={r.cmds[0]} className="session-row">
              <pre className="session-cmd mono" style={{ gridRow: i + 2 }}>
                {r.cmds.map((c) => (
                  <span key={c} className="term-line">
                    <span className="term-p" aria-hidden="true">
                      ${' '}
                    </span>
                    <span className="term-cmd">{c}</span>
                    {'\n'}
                  </span>
                ))}
              </pre>
              <div className="session-note" style={{ gridRow: i + 2 }}>
                {r.note ? <Note title={r.note.title}>{r.note.body}</Note> : null}
              </div>
            </div>
          ))}
        </div>
      </Sec>
      <Sec className="cs-prov" title="41 provider templates, in six groups" id="p-groups">
        <div className="prov-strip" aria-hidden="true">
          {SWITCH_GROUPS.map((g) => (
            <span key={g.name} className="prov-group" style={{ '--k': g.n } as React.CSSProperties}>
              {Array.from({ length: g.n }, (_, k) => (
                <i key={k} />
              ))}
            </span>
          ))}
        </div>
        <ul className="prov">
          {SWITCH_GROUPS.map((g) => (
            <li key={g.name} className="prov-row">
              <h3 className="prov-name">
                {g.name} <span className="prov-n">{g.n}</span>
              </h3>
              <p className="body">{g.who}</p>
            </li>
          ))}
        </ul>
        <figure className="said said-s">
          <blockquote className="say say-s">“{SWITCH_QUOTE.text}”</blockquote>
          <figcaption className="cap">{SWITCH_QUOTE.source}</figcaption>
        </figure>
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

/* ---------- 07 TensorPoW: set as the paper it is becoming, in three figures ---------- */

function TensorPoW({ p }: { p: Project }) {
  const [tensors, blocks, node] = p.how;
  return (
    <>
      <Sec className="tp-abs" label="What it is">
        <p className="sum">{p.summary}</p>
        <Spec facts={p.facts} />
      </Sec>
      <Sec className="tp-figs" label="How it fits together">
        <figure className="paper-fig paper-fig-wide">
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
          <figcaption className="paper-cap">
            <h3 className="paper-h">{tensors.title}</h3>
            <p className="body">{tensors.body}</p>
          </figcaption>
        </figure>
        <figure className="paper-fig">
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
            <span className="dia-key">
              <span>
                <i className="dia-anchor" /> anchor block
              </span>
              <span>
                <i className="dia-fruit" /> fruit block
              </span>
            </span>
          </div>
          <figcaption className="paper-cap">
            <h3 className="paper-h">{blocks.title}</h3>
            <p className="body">{blocks.body}</p>
          </figcaption>
        </figure>
        <figure className="paper-fig">
          <ul className="dia-art dia-stack" aria-hidden="true">
            {TENSOR_STACK.map((x) => (
              <li key={x.name} className="dia-part">
                <span className="dia-part-name">{x.name}</span>
                <span className="dia-part-does">{x.does}</span>
              </li>
            ))}
          </ul>
          <figcaption className="paper-cap">
            <h3 className="paper-h">{node.title}</h3>
            <p className="body">{node.body}</p>
          </figcaption>
        </figure>
      </Sec>
      <Sec className="tp-status" title="Not a live network yet" id="p-gates">
        <p className="lead">Before mainnet, per the README:</p>
        <ul className="checks">
          {TENSOR_GATES.map((g) => (
            <li key={g} className="check">
              <i className="check-box" aria-hidden="true" />
              {g}
            </li>
          ))}
        </ul>
      </Sec>
    </>
  );
}

/* ---------- 08 RydAR: the map, the phone, the two pages ---------- */

function RydAR({ p }: { p: Project }) {
  return (
    <>
      <Sec className="ry-map" label="The map">
        <Plate media={pic(p, 'rydar-map.webp')} priority />
        <div className="ry-count">
          <p className="fig">
            <span className="fig-value">{RYDAR_CURVES.value}</span>
            <span className="fig-unit">{RYDAR_CURVES.unit}</span>
          </p>
          <div className="ry-more">
            <ul className="limits">
              {RYDAR_MORE.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="cap">The public map at rydar.org. Numbers from rydar.org and the README.</p>
          </div>
        </div>
      </Sec>
      <Sec className="ry-phone" label="On the phone">
        <Plate media={pic(p, 'rydar-phone-map.webp')} sizes="(max-width: 859px) 70vw, 390px" className="plate-phone" />
        <div className="phone-side">
          <figure className="said">
            <blockquote className="say">“{RYDAR_QUOTE.text}”</blockquote>
            <figcaption className="cap">{RYDAR_QUOTE.source}</figcaption>
          </figure>
          <p className="sum sum-s">{p.summary}</p>
          <div className="notes">
            {p.how.map((h) => (
              <Note key={h.title} title={h.title}>
                {h.body}
              </Note>
            ))}
          </div>
          <Spec facts={p.facts} />
        </div>
      </Sec>
      <Sec className="ry-pages" label="rydar.org">
        <Plate media={pic(p, 'rydar-app-page.webp')} sizes={HALF_SIZES} />
        <Plate media={pic(p, 'rydar-how-page.webp')} sizes={HALF_SIZES} />
        <p className="cap">rydar.org: the iPhone app, and what goes into a curve warning.</p>
      </Sec>
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
          <Sec className="iv-open" label="What it is">
            <p className="sum">{p.summary}</p>
            <Spec facts={p.facts} />
          </Sec>
          {p.media.map((x) => (
            <Sec key={x.src} className="kb-board" label="Picture">
              <Plate media={x} />
            </Sec>
          ))}
        </>
      )}
      <Outs links={p.links} />
    </>
  );
}
