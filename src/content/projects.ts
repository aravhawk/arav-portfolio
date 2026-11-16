/**
 * Featured work. Every statement here is sourced in
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

export const PROJECTS: Project[] = [
  {
    slug: 'infiniview',
    n: '01',
    name: 'Infiniview',
    kicker: 'Infiniflop Labs',
    line: 'Agents attack your app in a sandbox and hand you replayable proof.',
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
      { label: 'Recognition', value: 'Daytona Startup Grid, April 2026' },
    ],
    links: [
      { label: 'infiniview.dev', href: 'https://infiniview.dev' },
      { label: 'Docs', href: 'https://docs.infiniview.dev' },
      { label: 'Infiniflop Labs', href: 'https://infiniflop.com' },
    ],
    media: [
      {
        kind: 'image',
        src: '/media/infiniview-finding.webp',
        alt: 'An Infiniview finding: SQL injection in an admin search filter, marked critical with a verified exploit and tabs for proof, attack path, code and fix.',
        w: 2200,
        h: 1375,
      },
      {
        kind: 'image',
        src: '/media/infiniview-pipeline.webp',
        alt: 'The Infiniview pipeline from pull request to proof, shown as steps on the product site.',
        w: 2200,
        h: 1375,
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
      'I fix things in the tools I use. The headline number counts merged pull requests in any repository I do not own, and it updates itself. The largest share is in T3 Code.',
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
        body: 'A prompt border fix in Kilo Code, a benchmark result for XcodeBenchmark, a licence for openbridge, and site work for friends.',
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
    slug: 'kilo-bench',
    n: '03',
    name: 'Kilo Bench',
    kicker: 'DeveloperWeek 2026',
    line: 'Model benchmarking in Kilo Code. Won "Kilo - For Devs, By Devs".',
    summary:
      'Kilo Bench is a benchmarking feature built into Kilo Code. It reads your workspace, writes coding challenges that fit your actual codebase, runs the models you pick through them, and tells you which one works best for your code. It won the prize category "Kilo - For Devs, By Devs" at the DeveloperWeek 2026 Hackathon.',
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
      { label: 'Result', value: 'Winner, prize category "Kilo - For Devs, By Devs"' },
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
        src: '/media/kilo-bench-generation.webp',
        alt: 'Kilo Bench generating coding challenges from the open workspace.',
        w: 2000,
        h: 1251,
      },
    ],
  },
  {
    slug: 'agent-bridge',
    n: '04',
    name: 'Agent Bridge',
    kicker: 'Apache 2.0',
    line: 'One inbox between an OpenAI Dot and a Grok Bot. Messages are data, never permission.',
    summary:
      'Agent Bridge connects an OpenAI Dot to a Grok Bot. It is a self hosted MCP inbox for one owner who wants the two to exchange messages, status updates and handoff requests in both directions without copying context between chats.',
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
        alt: 'The Agent Bridge launch video: an OpenAI Dot and a Grok Bot exchanging a handoff through the bridge.',
        w: 1280,
        h: 720,
      },
    ],
  },
  {
    slug: 'ollama',
    n: '05',
    name: 'Open models',
    kicker: 'Ollama',
    line: 'GGUF builds of open models, pulled by people running them locally.',
    summary:
      'I package open models as GGUF builds on Ollama so they run on your own machine. Four are public. The pull counts below are read from Ollama and refresh on their own.',
    how: [
      {
        title: 'Package',
        body: 'Each model is published as quantised GGUF builds that Ollama can pull and run with one command.',
      },
      {
        title: 'Publish early',
        body: 'The llama4 build, in 109b and 400b sizes, went up on April 11 2025.',
      },
    ],
    facts: [{ label: 'Run one', value: 'ollama run aravhawk/llama4' }],
    links: [{ label: 'ollama.com/aravhawk', href: 'https://ollama.com/aravhawk' }],
    media: [],
  },
  {
    slug: 'cc-switch',
    n: '06',
    name: 'cc\u2011switch',
    kicker: '',
    line: 'One command switches Claude Code between providers.',
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
    slug: 'tensorpow',
    n: '07',
    name: 'TensorPoW',
    kicker: 'Research',
    line: 'GPU native proof of work, becoming a research paper.',
    summary:
      'TensorPoW is the reference implementation of a GPU native proof of work protocol. It is built around deterministic INT8 tensor computation and a fruit and anchor block structure designed so different backends verify the same consensus. I am turning it into a full research paper.',
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
  {
    slug: 'rydar',
    n: '08',
    name: 'RydAR',
    kicker: '',
    line: 'An iPhone co-pilot for tight bends in Arkansas.',
    summary:
      'RydAR is an iPhone co-pilot for tight bends in Arkansas, and a public map of those bends at rydar.org. I built it with collaborators.',
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
      { label: 'Coverage', value: 'Arkansas roads' },
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
    ],
  },
];

export const projectBySlug = (slug: string) => PROJECTS.find((p) => p.slug === slug);

export interface More {
  name: string;
  line: string;
  href: string;
  /** Label for the main link when it is not source code. */
  hrefLabel?: string;
  tag: string;
  note?: string;
  also?: ProjectLink[];
}

/** Secondary work: one line each on /work. */
export const MORE: More[] = [
  {
    name: 'Ask Around',
    tag: 'Agents',
    line: "Governance for agents that ask people: quorum, veto, and silence is never a yes. Won Belweave's Notify Weekend 01 hackathon.",
    href: 'https://github.com/aravhawk/ask-around',
    also: [{ label: 'Announcement', href: 'https://x.com/pkyanam/status/2120163766713430040' }],
  },
  {
    name: 'ClarifAI',
    tag: 'Hackathon',
    line: 'AI assisted mediation for couples and roommates, built at United Hacks V6.',
    href: 'https://github.com/aravhawk/ClarifAI',
    also: [{ label: 'Devpost', href: 'https://devpost.com/software/clarifai-6pg03u' }],
  },
  {
    name: 'fix-it-bot',
    tag: 'Tooling',
    line: 'A drop in React component that turns a bug report into an agent generated pull request through Kilo.',
    href: 'https://github.com/aravhawk/fix-it-bot',
  },
  {
    name: 'OxyDrop',
    tag: 'Research prototype',
    line: 'A phone camera check for a drop in blood oxygen from your own baseline.',
    note: 'Not medical advice, not a medical device, validated on only 6 people.',
    href: 'https://github.com/aravhawk/oxydrop',
    also: [{ label: 'Demo', href: 'https://aravhawk.github.io/oxydrop/' }],
  },
  {
    name: 'goFoundr',
    tag: 'Agents',
    line: 'An AI founder agent that validates an idea, generates an MVP and deploys it.',
    href: 'https://github.com/2ALabz/goFoundr',
  },
  {
    name: 'VEX robotics',
    tag: 'Robotics',
    line: 'Drivetrain, autonomous routines and PID autotune for two competition robots. Design Award, November 2025.',
    href: 'https://github.com/aravhawk/99719T',
    also: [{ label: '3400Z', href: 'https://github.com/aravhawk/3400Z' }],
  },
  {
    name: 'Business Insider',
    tag: 'Press',
    line: '"I got agents running." A May 2026 story on coders who keep their laptops open in public.',
    href: 'https://www.businessinsider.com/coders-keep-laptops-open-in-public-ai-agent-2026-5',
    hrefLabel: 'Article',
  },
];

export interface ArchiveEntry {
  name: string;
  line: string;
  href?: string;
  group: 'Earlier' | 'Tools' | 'Small';
  year: string;
  also?: ProjectLink[];
}

const gh = (repo: string) => `https://github.com/aravhawk/${repo}`;

/** Everything else, one line each. */
export const ARCHIVE: ArchiveEntry[] = [
  {
    name: 'merlin-control',
    line: 'A wireframe rocket engine you steer with bare hands through the webcam.',
    href: gh('merlin-control'),
    group: 'Small',
    year: '2026',
    also: [{ label: 'Live', href: 'https://merlin.aravhawk.com' }],
  },
  { name: 'lite-stats', line: 'A lighter Apple Silicon menu bar monitor, forked from exelban/stats.', href: gh('lite-stats'), group: 'Tools', year: '2026', also: [{ label: 'Upstream', href: 'https://github.com/exelban/stats' }] },
  { name: 'envfetch', line: 'An environment variable vault unlocked with Touch ID.', href: gh('envfetch'), group: 'Tools', year: '2026' },
  { name: 'claude-code-utils', line: 'The Claude Code plugins and config I use daily.', href: gh('claude-code-utils'), group: 'Tools', year: '2026' },
  { name: 'passportphoto', line: 'A local studio for US passport photos.', href: gh('passportphoto'), group: 'Tools', year: '2026' },
  { name: 'typing-game', line: 'A minimal typing game.', href: gh('typing-game'), group: 'Tools', year: '2026' },
  { name: 'neuralbytes.net', line: 'The NeuralBytes site, 2023 to 2026.', href: gh('neuralbytes.net'), group: 'Earlier', year: '2023' },
  { name: 'SumQuick', line: 'Local summarisation with Ollama and Streamlit.', href: gh('SumQuick'), group: 'Earlier', year: '2024' },
  { name: 'ChatGPT-3.5-with-Vision', line: 'Image input for a text only chat model.', href: gh('ChatGPT-3.5-with-Vision'), group: 'Earlier', year: '2024' },
  { name: 'IntergalacticPro', line: 'A space and rockets expert chatbot.', href: gh('IntergalacticPro'), group: 'Earlier', year: '2025' },
  { name: 'Weather-Station-BMP280', line: 'A Raspberry Pi weather station that logs to a workbook.', href: gh('Weather-Station-BMP280'), group: 'Earlier', year: '2023' },
  { name: 'Master Coders', line: 'Free coding lessons, 2020.', group: 'Earlier', year: '2020' },
  { name: 'CryptoLab', line: 'A Swift Student Challenge 2025 entry on cryptography.', href: gh('CryptoLab.swiftpm'), group: 'Small', year: '2025' },
  { name: 'teamastros', line: 'A team site.', href: gh('teamastros'), group: 'Small', year: '2026' },
  { name: 'who-wants-to-be-a-billionaire', line: 'A quiz game.', href: gh('who-wants-to-be-a-billionaire'), group: 'Small', year: '2024' },
  { name: 'escaperoom', line: 'A browser escape room.', href: gh('escaperoom'), group: 'Small', year: '2022' },
  { name: 'workjet', line: 'Two early workspace launch pages.', href: gh('workjet-ms'), group: 'Small', year: '2022', also: [{ label: 'Google version', href: gh('workjet-google') }] },
  { name: 'top10tipsforsurvival', line: 'My first repository.', href: gh('top10tipsforsurvival'), group: 'Small', year: '2021' },
];

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
