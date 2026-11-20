import { Arrow } from '@/components/bits';
import { ProfileSwitch } from '@/components/home/ProfileSwitch';
import { LiveNumber } from '@/components/LiveNumber';
import type { Project, ProjectMedia } from '@/content/projects';
import { formatPostDate } from '@/lib/dates';
import { formatAsOf, formatCount, type Metric, type SiteMetrics } from '@/lib/metrics';
import { SHEET_COLS, SHEET_SRC } from '@/water/world';
import { HALF_SIZES, Note, Plate, Sec, Spec } from './blocks';
import {
  AROUND_RULES,
  BRIDGE_FLOW,
  BRIDGE_LIMITS,
  BRIDGE_MORE,
  BRIDGE_PEERS,
  INFINIVIEW_PASSES,
  KILO_MEASURES,
  KILO_MODES,
  KILO_QUOTE,
  KILO_VIEWS,
  MODEL_NOTES,
  RYDAR_CURVES,
  RYDAR_MORE,
  RYDAR_QUOTE,
  SWITCH_CARE,
  SWITCH_CAVEAT,
  SWITCH_GROUPS,
  SWITCH_INSTALL,
  SWITCH_INSTALL_NOTE,
  SWITCH_MORE,
  SWITCH_QUOTE,
  SWITCH_STATE_NOTE,
  SWITCH_WRITES,
  T3_PRS,
  TENSOR_BACKENDS,
  TENSOR_GATES,
  TENSOR_NODE,
  TENSOR_SPEC,
  TENSOR_STACK,
  TENSOR_TOOLS,
  TENSOR_TOOLS_MORE,
  type Peer,
} from './case-data';

/**
 * The nine project pages. No two share a skeleton: each is built from what
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

/* ---------- Infiniview: one run, drawn as the pipeline it is ---------- */

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
              <ul className="lanes" data-fill aria-label="The three passes">
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

/* ---------- Upstream: the ledger ---------- */

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
  // The record, grouped: the repositories in the order of their counts, each one's changes newest first as read.
  const order = m.mergedPrs.byRepo.map((r) => r.repo);
  const repos = [...order, ...m.mergedPrs.ledger.map((e) => e.repo).filter((r) => !order.includes(r))].filter((r, i, all) => all.indexOf(r) === i);
  const groups = repos.map((repo) => ({ repo, name: repo.split('/')[1], rows: m.mergedPrs.ledger.filter((e) => e.repo === repo) })).filter((g) => g.rows.length);
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
      <Sec className="sec-changes" title="In T3 Code, change by change" id="p-t3">
        <ol className="changes">
          {T3_PRS.map((x) => (
            <li key={x.n} className="change" data-row>
              <a className="change-n" href={`https://github.com/pingdotgg/t3code/pull/${x.n}`} target="_blank" rel="noopener noreferrer" aria-label={`Pull request ${x.n} in T3 Code`}>
                #{x.n}
              </a>
              <div className="change-main">
                <h3 className="change-title">{x.title}</h3>
                {x.what ? <p className="body">{x.what}</p> : null}
              </div>
              <p className="change-meta">
                <span>{formatPostDate(x.merged, 'short')}</span>
                {x.size ? <Diff size={x.size} /> : null}
              </p>
            </li>
          ))}
        </ol>
      </Sec>
      <Sec className="sec-bars sec-rest" title="The rest, by repository" id="p-rest">
        <ol className="bars" data-fill>
          {m.mergedPrs.byRepo.map((r) => {
            const [owner, name] = r.repo.split('/');
            return (
              <li key={r.repo} className="bar-row">
                <a className="bar-name" href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`${r.repo}: ${r.count} merged pull request${r.count === 1 ? '' : 's'}`}>
                  <span className="bar-owner">{owner}/</span>
                  <span className="bar-project">{name}</span>
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
      <Sec className="sec-ledger" title="Every merged pull request" id="p-ledger">
        <div className="table-scroll ledger-all">
          <table className="ledger">
            <thead>
              <tr className="label">
                <th scope="col">Repository</th>
                <th scope="col">Change</th>
                <th scope="col">Merged</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.repo}>
                {g.rows.map((e, k) => (
                  <tr key={e.url}>
                    <td>{k === 0 ? `${g.name} (${g.rows.length})` : <span className="sr-only">{g.name}</span>}</td>
                    <td>
                      <a href={e.url} target="_blank" rel="noopener noreferrer">
                        {e.title}
                      </a>
                    </td>
                    <td>{formatPostDate(e.mergedAt, 'short')}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Sec>
    </>
  );
}

/* ---------- Kilo Bench: the result, then the three things it does, each beside what it makes ---------- */

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
        <figure className="board">
          <div className="board-rows" data-fill role="img" aria-label="The leaderboard of one run: anthropic/claude-sonnet-4.6 scored 7.6, anthropic/claude-opus-4.6 scored 7.4, openai/gpt-5.2-codex scored 6.3, each with its cost, time and tokens.">
            {SHEET_COLS.map(([x, w]) => (
              <span key={x} className="board-col" style={{ '--x': x, '--w': w, '--y': SHEET_SRC.y, '--h': SHEET_SRC.rows } as React.CSSProperties} />
            ))}
          </div>
          <figcaption className="cap">The leaderboard of one run inside Kilo Code, cut from the capture in the project’s Devpost gallery.</figcaption>
        </figure>
      </Sec>
      <Sec className="kb-acts" label="How it works">
        <div className="acts">
          {/* The first thing it does, with the screen it starts from. */}
          <div className="act">
            <div className="act-copy">
              <h3 className="act-title">{read.title}</h3>
              <p className="body">{read.body}</p>
            </div>
            <Plate media={pic(p, 'kilo-bench-start.webp')} sizes="(max-width: 859px) 94vw, 560px" className="act-plate" caption="The Bench tab’s first screen." />
          </div>
          {/* The other two are one table: every mode, against what a run is judged on. */}
          <div className="act">
            <div className="act-pair">
              <div className="act-copy">
                <h3 className="act-title">{cover.title}</h3>
                <p className="body">{cover.body}</p>
              </div>
              <div className="act-copy">
                <h3 className="act-title">{judge.title}</h3>
                <p className="body">{judge.body}</p>
              </div>
            </div>
            <div className="matrix-wrap">
              <table className="matrix" data-fill>
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
          </div>
        </div>
      </Sec>
      <Sec className="kb-views" label="Dashboard views">
        <figure className="said">
          <blockquote className="say say-m">“{KILO_QUOTE.text}”</blockquote>
          <figcaption className="cap">{KILO_QUOTE.source}</figcaption>
        </figure>
        <div className="views">
          <h3 className="views-h">The dashboard, in five views</h3>
          <ul className="limits">
            {KILO_VIEWS.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
      </Sec>
    </>
  );
}

/* ---------- Agent Bridge: the film, then the message flow as a sequence diagram ---------- */

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
        <div className="seq" data-fill>
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
        <div className="notes">
          {BRIDGE_MORE.map((x) => (
            <Note key={x.title} title={x.title}>
              {x.body}
            </Note>
          ))}
          {optional ? <Note title={optional.title}>{optional.body}</Note> : null}
        </div>
      </Sec>
    </>
  );
}

/* ---------- Open models: the chart ---------- */

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
        <ol className="cols" data-fill style={{ '--n': m.ollama.models.length } as React.CSSProperties}>
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
      <Sec className="sec-builds" title="The four, and how to run each" id="p-models">
        <ul className="builds">
          {m.ollama.models.map((x) => {
            const note = MODEL_NOTES[x.name];
            return (
              <li key={x.name} className="build">
                <div className="build-head">
                  <h3 className="build-title">
                    <a href={x.url} target="_blank" rel="noopener noreferrer">
                      {x.name} <Arrow out />
                    </a>
                  </h3>
                  <p className="build-pulls">{formatCount(x.pulls)} pulls</p>
                </div>
                {note?.what ? <p className="body">{note.what}</p> : null}
                {note ? (
                  <dl className="spec">
                    {note.facts.map(([k, v]) => (
                      <div key={k} className="spec-row" data-row>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <code className="mono build-run" data-fill>
                  <span className="term-p" aria-hidden="true">
                    ${' '}
                  </span>
                  {note?.run ?? `ollama run aravhawk/${x.name}`}
                </code>
              </li>
            );
          })}
        </ul>
      </Sec>
    </>
  );
}

/* ---------- cc-switch: a terminal session, each command with what it does beside it ---------- */

function CcSwitch({ p, m }: { p: Project; m: SiteMetrics }) {
  const [create, change, test] = p.how;
  // Every line of the session has what it does beside it, from the first line down.
  const rows: { cmds: string[]; note: { title: string; body: string } }[] = [
    { cmds: [SWITCH_INSTALL], note: SWITCH_INSTALL_NOTE },
    { cmds: ['cc-switch --create kimi --template kimi'], note: create },
    { cmds: ['cc-switch work'], note: change },
    { cmds: ['cc-switch --test'], note: test },
    { cmds: SWITCH_MORE, note: SWITCH_STATE_NOTE },
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
              <span className="fig-unit">npm downloads since February 1, 2026</span>
            </li>
            <li className="fig">
              <span className="fig-value">
                <Live metric={m.npm.lastMonth} what="npm downloads of cc-switch in the last 30 days" />
              </span>
              <span className="fig-unit">in the last 30 days</span>
            </li>
          </ul>
          <Spec facts={p.facts.filter((f) => f.label !== 'Install')} />
        </div>
      </Sec>
      <Sec className="cs-session" label="In the terminal">
        <div className="session" data-fill style={{ '--n': rows.length } as React.CSSProperties}>
          <div className="session-bar" aria-hidden="true">
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
                <Note title={r.note.title}>{r.note.body}</Note>
              </div>
            </div>
          ))}
        </div>
      </Sec>
      <Sec className="cs-writes" title="What cc-switch work writes" id="p-writes">
        <ol className="writes" data-fill>
          {SWITCH_WRITES.map((w) => (
            <li key={w.to} className="write">
              <span className="write-path mono">
                <span>{w.from}</span>
                <i className="write-to" aria-hidden="true" />
                <span className="sr-only">to</span>
                <span>{w.to}</span>
              </span>
              <span className="write-what">{w.what}</span>
            </li>
          ))}
        </ol>
        <div className="notes">
          {SWITCH_CARE.map((x) => (
            <Note key={x.title} title={x.title}>
              {x.body}
            </Note>
          ))}
        </div>
      </Sec>
      <Sec className="cs-prov" title="41 provider templates, in six groups" id="p-groups">
        <ul className="prov">
          {SWITCH_GROUPS.map((g) => (
            <li key={g.name} className="prov-group">
              <span className="prov-cells" data-fill aria-hidden="true">
                {Array.from({ length: g.n }, (_, k) => (
                  <i key={k} />
                ))}
              </span>
              <h3 className="prov-name">
                {g.name} <span className="prov-n">{g.n}</span>
              </h3>
              {g.who ? <p className="body">{g.who}</p> : null}
            </li>
          ))}
        </ul>
        <div className="said-pair">
          <figure className="said">
            <blockquote className="say say-s">“{SWITCH_QUOTE.text}”</blockquote>
            <figcaption className="cap">{SWITCH_QUOTE.source}</figcaption>
          </figure>
          <figure className="said">
            <blockquote className="say say-s">“{SWITCH_CAVEAT.text}”</blockquote>
            <figcaption className="cap">{SWITCH_CAVEAT.source}</figcaption>
          </figure>
        </div>
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

/* ---------- TensorPoW: set as the paper it is becoming, in three figures ---------- */

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
          <div className="dia-art dia-tensor" data-fill aria-hidden="true">
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
          <div className="dia-art dia-chain" data-fill aria-hidden="true">
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
          <ul className="dia-art dia-stack" data-fill aria-hidden="true">
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
      {/* What is built, and beside it what is still to do. */}
      <div className="sec wrap tp-pair">
        <section className="tp-node" aria-labelledby="p-node">
          <h2 className="sec-h" id="p-node">
            What the reference implementation holds
          </h2>
          <ul className="holds">
            {TENSOR_NODE.map((x) => (
              <li key={x.name} className="hold" data-row>
                <h3 className="hold-name">{x.name}</h3>
                <ul className="hold-items">
                  {x.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </li>
            ))}
            <li className="hold" data-row>
              <h3 className="hold-name">Operator tools</h3>
              <div>
                <ul className="hold-items hold-tools mono">
                  {TENSOR_TOOLS.map((t) => (
                    <li key={t}>
                      <span className="term-p" aria-hidden="true">
                        ${' '}
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="cap">{TENSOR_TOOLS_MORE}</p>
              </div>
            </li>
          </ul>
          <p className="cap">{TENSOR_SPEC}</p>
        </section>
        <section className="tp-status" aria-labelledby="p-gates">
          <h2 className="sec-h" id="p-gates">
            Not a live network yet
          </h2>
          <p className="lead">Before mainnet, per the README:</p>
          <ol className="gates" data-fill>
            {TENSOR_GATES.map((g) => (
              <li key={g} className="gate">
                <i className="gate-box" aria-hidden="true" />
                {g}
              </li>
            ))}
            <li className="gate gate-end">
              <i className="gate-box" aria-hidden="true" />
              Mainnet
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}

/* ---------- Ask Around: the result, what it is, and the rules a request has to clear ---------- */

function AskAround({ p }: { p: Project }) {
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
      <Sec className="ab-limits" label="The rules">
        <div>
          <ul className="limits">
            {AROUND_RULES.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="cap">The rules, from the README.</p>
        </div>
        <div className="notes">
          {p.how.map((h) => (
            <Note key={h.title} title={h.title}>
              {h.body}
            </Note>
          ))}
        </div>
      </Sec>
    </>
  );
}

/* ---------- RydAR: the map, the phone, the two pages ---------- */

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
  'ask-around': AskAround,
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
    </>
  );
}
