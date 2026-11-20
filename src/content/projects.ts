/**
 * The work the site shows: nine projects, in the owner's order (his list of
 * 20 November 2026; docs/site-system/copy.md keeps its limits). Every
 * statement here is in that list or sourced in
 * docs/redesign-v4/content-sources.md. Live numbers are not stored here:
 * they come from src/lib/metrics at render time.
 */

export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectMedia {
  kind: 'image' | 'video';
  src: string;
  alt: string;
  w: number;
  h: number;
  poster?: string;
  /** Layout hint: the capture's own ground. A light one is mounted, and dimmed on the dark theme. */
  tone?: 'light' | 'dark';
}

export interface Project {
  slug: string;
  n: string;
  name: string;
  /** Small label above the name. */
  kicker: string;
  /** The one sentence shown on the home page. */
  line: string;
  /** Lead paragraph on the project page. */
  summary: string;
  how: { title: string; body: string }[];
  facts: { label: string; value: string }[];
  quote?: { text: string; source: string };
  note?: string;
  links: ProjectLink[];
  media: ProjectMedia[];
}

const entries: Project[] = [
  {
    slug: 'infiniview',
    n: '01',
    name: 'Infiniview',
    kicker: 'Infiniflop Labs',
    line: 'It connects to a GitHub repo, deploys the app in a sandbox, attacks it for real and returns replayable proof of what broke.',
    summary:
      'Infiniview connects to your GitHub, deploys your app in a sandbox, and runs real attacks against it. You get replayable proof of what broke. I co-founded Infiniflop Labs to build it, and the agent system behind it is the thing I work on most.',
    how: [
      {
        title: 'Trigger',
        body: 'Open a pull request, comment @infiniview review, or start a run from the dashboard. There are no test cases to write.',
      },
      {
        title: 'Sandbox',
        body: 'An isolated cloud environment spins up and your app is deployed inside it. Nothing touches production, and the sandbox is deleted after the scan.',
      },
      {
        title: 'Attack',
        body: 'A code review pass, a runtime attack pass and an interaction pass run against the live app: injection, auth attacks, API fuzzing, SSRF, session hijacking, prompt injection, multi tab races and more.',
      },
      {
        title: 'Proof',
        body: 'Each finding arrives with root cause evidence, the affected code paths and a suggested fix, posted back to the pull request as a bundle you can replay.',
      },
    ],
    facts: [
      { label: 'Role', value: 'Co-founder, building the agent system' },
      { label: 'Status', value: 'Early access' },
      { label: 'Started', value: 'March 2026 as Docksmith, renamed that April' },
      { label: 'Recognition', value: 'Accepted to the Daytona Startup Grid, April 9, 2026' },
    ],
    links: [
      { label: 'infiniview.dev', href: 'https://infiniview.dev' },
      { label: 'Docs', href: 'https://docs.infiniview.dev' },
    ],
    media: [
      {
        kind: 'image',
        src: '/media/infiniview-attack-path.webp',
        alt: 'An Infiniview finding with its attack path open: four numbered steps from an authenticated admin search to a UNION payload, beside the list of what every finding ships with.',
        w: 2640,
        h: 860,
      },
      {
        kind: 'image',
        src: '/media/infiniview-pipeline.webp',
        alt: 'The Infiniview pipeline from pull request to proof, shown as steps on the product site.',
        w: 2200,
        h: 1375,
      },
      {
        kind: 'image',
        src: '/media/infiniview-findings.webp',
        alt: 'The findings section of the Infiniview site: Forensic findings, not just alerts, above a sample review with a SQL injection finding open.',
        w: 2200,
        h: 1375,
      },
      {
        kind: 'image',
        src: '/media/infiniview-dash-findings.webp',
        alt: 'The Infiniview dashboard in its public demo, marked as sample data: a list of security findings grouped by severity.',
        w: 2400,
        h: 1500,
      },
      {
        kind: 'image',
        src: '/media/infiniview-dash-review.webp',
        alt: 'A review in the Infiniview public demo, marked as sample data: two critical attack paths, each with its steps.',
        w: 2400,
        h: 1500,
      },
      {
        kind: 'image',
        src: '/media/infiniview-layers.webp',
        alt: 'The arsenal section of the Infiniview site: Every layer, covered, above the counts of parallel code review agents and static scanners.',
        w: 2400,
        h: 1143,
      },
    ],
  },
  {
    slug: 'open-source',
    n: '02',
    name: 'Upstream',
    kicker: 'Open source',
    line: 'Merged pull requests in tools other developers run every day, T3 Code first.',
    summary:
      'I fix things in the tools I use. The headline number counts merged pull requests in repositories I do not own, and it updates itself. The largest share is in T3 Code, merged between September 7 and November 16, 2026.',
    how: [
      {
        title: 'T3 Code',
        body: 'Running gh pr new or glab mr new now links the new pull request to the thread. Ambient Cursor MCP servers are preserved. Composer Fast mode is remembered across new chats.',
      },
      {
        title: 'tokscale',
        body: 'Pricing alias resolution, signed in Cursor desktop session sync, and incremental Cursor sync with isolated caches.',
      },
      {
        title: 'Elsewhere',
        body: 'A prompt border fix in Kilo Code, pull request 6458. One merged pull request each in XcodeBenchmark and openbridge.',
      },
    ],
    facts: [{ label: 'Counted', value: 'Merged pull requests in repositories I do not own' }],
    links: [
      {
        label: 'Merged in T3 Code',
        href: 'https://github.com/pingdotgg/t3code/pulls?q=is%3Apr+author%3Aaravhawk+is%3Amerged',
      },
      { label: 'GitHub', href: 'https://github.com/aravhawk' },
    ],
    media: [],
  },
  {
    slug: 'ollama',
    n: '03',
    name: 'Open models',
    kicker: 'Ollama',
    line: 'Four open models packaged as GGUF builds, pulled by people who run them on their own machines.',
    summary:
      'I package open models as GGUF builds on Ollama so they run on your own machine. Four are public. The pull counts below are read from Ollama and refresh on their own.',
    how: [
      {
        title: 'Package',
        body: 'Each model is published as quantised GGUF builds that Ollama can pull and run with one command.',
      },
      {
        title: 'Upload',
        body: 'The llama4 build, in 109b and 400b sizes, was uploaded on April 11, 2025.',
      },
    ],
    facts: [{ label: 'Run one', value: 'ollama run aravhawk/llama4' }],
    links: [{ label: 'ollama.com/aravhawk', href: 'https://ollama.com/aravhawk' }],
    media: [],
  },
  {
    slug: 'cc-switch',
    n: '04',
    name: 'cc\u2011switch',
    kicker: '',
    line: 'One command switches Claude Code between Anthropic and open model providers.',
    summary:
      'cc-switch is a profile manager for Claude Code. Keep a profile for your Claude subscription, one for Kimi, one for a local Ollama model, one for work on Bedrock, and move between them without editing settings.json by hand.',
    how: [
      {
        title: 'Create',
        body: 'cc-switch --create kimi --template kimi makes a profile from a provider template. More than 40 providers are covered: Anthropic, open model labs, gateways, local servers and cloud platforms.',
      },
      {
        title: 'Switch',
        body: 'cc-switch work switches back. Creating a profile saves the one you were on, so nothing is lost.',
      },
      {
        title: 'Test',
        body: 'cc-switch --test sends one tiny request to check the endpoint, the key and the model.',
      },
    ],
    facts: [
      { label: 'Install', value: 'npm install -g @aravhawk/cc-switch' },
      { label: 'Licence', value: 'MIT' },
      { label: 'First published', value: 'February 2026' },
    ],
    links: [
      { label: 'Source', href: 'https://github.com/aravhawk/cc-switch' },
      { label: 'npm', href: 'https://www.npmjs.com/package/@aravhawk/cc-switch' },
    ],
    media: [],
  },
  {
    slug: 'kilo-bench',
    n: '05',
    name: 'Kilo Bench',
    kicker: 'DeveloperWeek 2026',
    line: 'Model benchmarking inside Kilo Code. Winner of the “Kilo - For Devs, By Devs” prize at the DeveloperWeek 2026 Hackathon.',
    summary:
      'Kilo Bench is a benchmarking feature built into Kilo Code. It reads your workspace, writes coding challenges that fit your actual codebase, runs the models you pick through them, and tells you which one works best for your code. It won the “Kilo - For Devs, By Devs” prize at the DeveloperWeek 2026 Hackathon.',
    how: [
      {
        title: 'Read the workspace',
        body: 'It looks at your languages, frameworks, dependencies and source files, then generates challenges tailored to them.',
      },
      {
        title: 'Cover every mode',
        body: 'Challenges map across all five Kilo modes: Architect, Code, Debug, Ask and Orchestrator, each with a system prompt modelled on that mode.',
      },
      {
        title: 'Run and judge',
        body: "Each selected model runs every challenge through Kilo's real API pipeline. An AI judge scores quality and relevance while speed and cost are captured automatically.",
      },
    ],
    facts: [
      { label: 'Result', value: 'Winner of the “Kilo - For Devs, By Devs” prize' },
      { label: 'Built', value: 'February 2026' },
    ],
    links: [
      { label: 'Devpost', href: 'https://devpost.com/software/kilo-bench-native-model-benchmarking-in-kilo-code' },
      { label: 'Source', href: 'https://github.com/aravhawk/kilobench' },
    ],
    media: [
      {
        kind: 'image',
        src: '/media/kilo-bench-results.webp',
        alt: 'Kilo Bench results inside Kilo Code: models ranked with quality, speed and cost for each mode.',
        w: 2000,
        h: 1088,
      },
      {
        kind: 'image',
        src: '/media/kilo-bench-board.webp',
        alt: 'Kilo Bench results inside Kilo Code: three models benchmarked, the leaderboard with score, cost, time and tokens for each, and the performance radar under it.',
        w: 2324,
        h: 1056,
      },
      {
        kind: 'image',
        src: '/media/kilo-bench-start.webp',
        alt: 'The Kilo Bench start screen inside Kilo Code: Benchmark Your Models, four steps and a Run Benchmark button.',
        w: 800,
        h: 600,
      },
    ],
  },
  {
    slug: 'ask-around',
    n: '06',
    name: 'Ask Around',
    kicker: 'Notify Weekend 01',
    line: 'Governance for agents that ask people. Winner of Belweave’s Notify Weekend 01 on justship.dev.',
    summary:
      'Ask Around is governance for agents that ask people before they act. Each question goes only to its owner, quorum and veto are enforced, and silence is never a yes. I built it at Notify Weekend 01, a 2-hour hackathon on justship.dev, and it was named the winner.',
    how: [
      {
        title: 'Ask the owner',
        body: 'Each question goes only to the person who owns it.',
      },
      {
        title: 'Quorum and veto',
        body: 'Approval takes an N-of-M quorum, and any deny vetoes.',
      },
      {
        title: 'No answer',
        body: 'A request that times out is not approved.',
      },
    ],
    facts: [
      { label: 'Result', value: 'Winner, Belweave’s Notify Weekend 01' },
      { label: 'Event', value: 'A 2-hour hackathon on justship.dev, November 7, 2026' },
      { label: 'Built with', value: 'Notify for delivery and Belweave Kai-4 for planning' },
    ],
    quote: {
      text: 'A timeout is never approval.',
      source: 'Ask Around README',
    },
    links: [
      { label: 'Source', href: 'https://github.com/aravhawk/ask-around' },
      { label: 'Announcement', href: 'https://x.com/pkyanam/status/2120163766713430040' },
    ],
    media: [],
  },
  {
    slug: 'rydar',
    n: '07',
    name: 'RydAR',
    kicker: '',
    line: 'An iPhone co-pilot that speaks curve advisories, and a public Arkansas curve map.',
    summary:
      'RydAR is an iPhone co-pilot that speaks curve advisories on Arkansas roads, and a public map of those curves at rydar.org. It is live on the App Store as “RydAR: Safe Driving”. I built it with 2 collaborators.',
    how: [
      {
        title: 'Spoken advisories',
        body: 'A drive warns from the curve database bundled in the app. A single curve prompt says, for example, "Slow to 25 mph for the curve ahead."',
      },
      {
        title: 'On device road check',
        body: 'A small model on the phone labels the road under the car as paved or unpaved. Frames are displayed, never saved.',
      },
      {
        title: 'Anonymous by construction',
        body: 'Curve passes are held until the trip ends, sent together in random order, and signed with an App Attest key.',
      },
    ],
    facts: [
      { label: 'Platform', value: 'iPhone' },
      { label: 'App Store', value: '“RydAR: Safe Driving” v1.0.0, live since November 11, 2026' },
      { label: 'Coverage', value: 'Arkansas roads' },
      { label: 'Team', value: 'Built with 2 collaborators' },
    ],
    links: [
      { label: 'rydar.org', href: 'https://rydar.org' },
      { label: 'Source', href: 'https://github.com/aravhawk/RydAR' },
    ],
    media: [
      {
        kind: 'image',
        src: '/media/rydar-app.webp',
        alt: 'The RydAR site showing the iPhone app during a drive.',
        w: 2200,
        h: 1375,
      },
      {
        kind: 'image',
        src: '/media/rydar-map.webp',
        alt: 'The RydAR map at rydar.org: Arkansas covered in clusters of mapped curves, with a panel to pick a county and road surface.',
        w: 2400,
        h: 1500,
        tone: 'light',
      },
      {
        kind: 'image',
        src: '/media/rydar-how-page.webp',
        alt: 'The RydAR page What goes into a curve warning: road data, suggested speed and timing, and the formula for the speed.',
        w: 1600,
        h: 1755,
        tone: 'light',
      },
      {
        kind: 'image',
        src: '/media/rydar-app-page.webp',
        alt: 'The RydAR for iPhone page: A heads-up for the next bend, with spoken warnings, curves built in, driver mode and teen driver mode.',
        w: 1600,
        h: 1504,
        tone: 'light',
      },
      {
        kind: 'image',
        src: '/media/rydar-phone-map.webp',
        alt: 'The RydAR map on a phone: county clusters across Arkansas above the link to the iPhone app.',
        w: 780,
        h: 1490,
        tone: 'light',
      },
    ],
  },
  {
    slug: 'agent-bridge',
    n: '08',
    name: 'Agent Bridge',
    kicker: 'Apache 2.0',
    line: 'A self-hosted MCP inbox for two-way handoffs between a Grok Bot and an OpenAI agent.',
    summary:
      'Agent Bridge is a self-hosted MCP inbox for one owner. A Grok Bot and an OpenAI agent exchange messages, status updates and handoff requests through it in both directions, so the owner does not copy context between chats.',
    how: [
      {
        title: 'Store, then wake',
        body: 'The sender calls one tool. The bridge stores the message and an outbox job in one transaction, and the wake that follows carries only the message ID.',
      },
      {
        title: 'Read as yourself',
        body: 'Each assistant signs in with its own OAuth token and can send only to the other peer. The recipient reads the stored data through its own authenticated connection.',
      },
      {
        title: 'Acknowledge once',
        body: 'An ACK means the recipient handled the data, not that a task is done. ACKs are terminal, which prevents loops.',
      },
      {
        title: 'Optional delivery',
        body: 'Queue and QStash delivery, private Vercel Blob transfer for large files, and batching for routine updates are available and off by default.',
      },
    ],
    facts: [
      { label: 'Licence', value: 'Apache 2.0' },
      { label: 'Protocol', value: 'Model Context Protocol' },
      { label: 'Launched', value: 'November 2026' },
    ],
    quote: {
      text: 'Messages are data, never permission.',
      source: 'Agent Bridge README',
    },
    links: [
      { label: 'Source', href: 'https://github.com/aravhawk/agent-bridge' },
      { label: 'Launch post', href: 'https://x.com/aravhawk/status/2117458115134472437' },
    ],
    media: [
      {
        kind: 'video',
        src: '/media/agent-bridge-demo.mp4',
        poster: '/media/agent-bridge-poster.jpg',
        alt: 'The Agent Bridge launch video: a Grok Bot and an OpenAI agent exchanging a handoff through the bridge.',
        w: 1280,
        h: 720,
      },
    ],
  },
  {
    slug: 'tensorpow',
    n: '09',
    name: 'TensorPoW',
    kicker: 'Research',
    line: 'A research implementation of GPU proof-of-work built on deterministic INT8 tensor computation.',
    summary:
      'TensorPoW is a research implementation of GPU proof-of-work. It is built on deterministic INT8 tensor computation and a fruit and anchor block structure designed so different backends verify the same consensus. I am turning it into a full research paper.',
    how: [
      {
        title: 'Deterministic tensors',
        body: 'Challenges are INT8 tensor computations, so a CPU, an Apple GPU and a CUDA GPU must agree bit for bit.',
      },
      {
        title: 'Fruit and anchor blocks',
        body: 'Small fruit blocks carry work between anchor blocks, ordered by a BlockDAG with anchor difficulty adjustment and finality.',
      },
      {
        title: 'A full node',
        body: 'Python 3.12 with PyTorch for tensors, Cython on hot paths, BLAKE3 hashing, Ed25519 signatures, libp2p networking and RocksDB for state.',
      },
    ],
    facts: [
      { label: 'Idea and first code', value: 'October 2024' },
      { label: 'Current version', value: 'June 2026' },
      { label: 'Licence', value: 'Apache 2.0, historic MIT notice preserved' },
    ],
    links: [{ label: 'Source', href: 'https://github.com/aravhawk/TensorPoW' }],
    media: [],
  },
];

/** The nine, in the owner's order: the order of /work, of every list, and of the way round the set. */
export const PROJECTS: Project[] = entries;

export const projectBySlug = (slug: string) => PROJECTS.find((p) => p.slug === slug);

/**
 * What he is recognised for: lines, never cards. The year's contributions
 * are read live (src/lib/metrics) and said with the date they were read.
 */
export const RECOGNITION = {
  devday: 'Selected for OpenAI DevDay 2026',
  press: {
    text: 'In a Business Insider story on coders who keep their laptops open in public, May 2026',
    href: 'https://www.businessinsider.com/coders-keep-laptops-open-in-public-ai-agent-2026-5',
  },
  /** The year the contributions line counts. */
  year: '2026',
};

export const INTERESTS = [
  'Agents and evals',
  'ML',
  'Security',
  'GPUs',
  'Flight computers',
  'Spaceflight',
  'Robotics',
];

export const CONTACT = {
  github: 'https://github.com/aravhawk',
  x: 'https://x.com/aravhawk',
  linkedin: 'https://www.linkedin.com/in/aravjainml',
  email: 'aravhawk@gmail.com',
};
