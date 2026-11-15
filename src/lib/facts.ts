/**
 * Every fact on the site. Each one traces to a public source read on Nov 14 2026.
 * Sources: docs/redesign-v2/content-sources.md
 */

export const person = {
  name: 'Arav Jain',
  role: 'Co-founder, Infiniflop Labs',
  email: 'aravhawk@gmail.com',
  links: [
    { label: 'GitHub', href: 'https://github.com/aravhawk' },
    { label: 'X', href: 'https://x.com/aravhawk' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/aravjainml' },
  ],
};

export type Callout = { at: [number, number, number]; text: string; side?: 'l' | 'r' };
export type BeatCopy = {
  n: number;
  id: string;
  /** short label for the HUD */
  label: string;
  kicker?: string;
  /** headline parts: thin (condensed light) and black (expanded heavy) */
  head: { t: string; w: 'thin' | 'black' }[][];
  line?: string;
  link?: { label: string; href: string };
  /** where the copy block sits on wide screens */
  place: 'bl' | 'br' | 'tl' | 'tr' | 'c';
  /** labels pinned to the 3D subject, local to its site */
  callouts?: Callout[];
};

export const beats: BeatCopy[] = [
  {
    n: 1, id: 'arav', label: 'Arav Jain', place: 'bl',
    head: [],
    line: 'I build AI agents and the tools around them.',
    callouts: [{ at: [40, 25.5, 3.5], text: '65,536 lights', side: 'r' }],
  },
  {
    n: 2, id: 'infiniview', label: 'Infiniview', place: 'bl', kicker: 'Now. Co-founder, Infiniflop Labs',
    head: [[{ t: 'Infini', w: 'thin' }, { t: 'view', w: 'black' }]],
    line: 'Agents that review, probe and stress-test your code in cloud sandboxes.',
    link: { label: 'infiniflop.com', href: 'https://infiniflop.com' },
    callouts: [{ at: [-16, 21.6, 0], text: 'Finding', side: 'l' }, { at: [20, 28, 15], text: 'Sandbox', side: 'r' }],
  },
  {
    n: 3, id: 'developerweek', label: 'DeveloperWeek 2026', place: 'br', kicker: 'DeveloperWeek 2026',
    head: [[{ t: '1st', w: 'black' }], [{ t: 'of 74', w: 'thin' }]],
    line: 'First place out of 74 submissions.',
    callouts: [{ at: [-30, 5, 22], text: '73 entries', side: 'l' }, { at: [0.5, 30, -4], text: '01', side: 'r' }],
  },
  {
    n: 4, id: 'agent-bridge', label: 'agent-bridge', place: 'bl', kicker: 'agent-bridge',
    head: [[{ t: 'Messages are data.', w: 'thin' }], [{ t: 'Never permission.', w: 'black' }]],
    line: 'A shared inbox between your OpenAI Dot and Grok Bot.',
    link: { label: 'GitHub', href: 'https://github.com/aravhawk/agent-bridge' },
    callouts: [{ at: [0, 35.5, 0], text: 'Inbox', side: 'r' }],
  },
  {
    n: 5, id: 'upstream', label: 'Upstream', place: 'bl', kicker: 'Open source',
    head: [[{ t: '20', w: 'black' }], [{ t: 'merged upstream', w: 'thin' }]],
    line: "Pull requests in other people's repos. 8 of them in T3 Code.",
    link: { label: 'Pull requests', href: 'https://github.com/pulls?q=is%3Apr+author%3Aaravhawk+is%3Amerged+-user%3Aaravhawk' },
    callouts: [{ at: [0, 7, -150], text: 'main', side: 'r' }],
  },
  {
    n: 6, id: 'markets', label: 'Markets', place: 'tl', kicker: 'Trading',
    head: [[{ t: 'The bot', w: 'thin' }, { t: 'trades.', w: 'black' }]],
    line: 'Equities and options, 14 strategies, on its own. Before it came AlphaPredict, a stock predictor.',
    callouts: [{ at: [84, 31, -6], text: '14 strategies', side: 'r' }],
  },
  {
    n: 7, id: 'merlin', label: 'Merlin 1D', place: 'br', kicker: 'merlin-control',
    head: [[{ t: 'Merlin 1D.', w: 'black' }], [{ t: 'Bare hands.', w: 'thin' }]],
    line: 'A SpaceX engine you spin through a webcam. Drag this one.',
    link: { label: 'merlin.aravhawk.com', href: 'https://merlin.aravhawk.com' },
    callouts: [{ at: [0, 36, 0], text: 'Gimbal', side: 'l' }, { at: [0, 3, 0], text: 'Nozzle', side: 'l' }],
  },
  {
    n: 8, id: 'early', label: 'First light', place: 'bl',
    head: [[{ t: "It's still", w: 'thin' }, { t: 'early.', w: 'black' }]],
  },
];

export type Entry = {
  name: string;
  year: string;
  kind: string;
  group: 'Companies' | 'Agents and tools' | 'Apps' | 'Markets' | 'Robots' | 'Upstream' | 'Earlier';
  line: string;
  href?: string;
  stage?: boolean;
};

const gh = (r: string) => `https://github.com/aravhawk/${r}`;
const merged = (repo: string) => `https://github.com/${repo}/pulls?q=is%3Apr+author%3Aaravhawk+is%3Amerged`;

export const entries: Entry[] = [
  { name: 'Infiniflop Labs', year: '2026', kind: 'Company', group: 'Companies', line: "Co-founder. We're building Infiniview: agents that review, probe and stress-test your code in cloud sandboxes.", href: 'https://infiniflop.com', stage: true },
  { name: 'DeveloperWeek 2026', year: '2026', kind: 'Win', group: 'Companies', line: 'First place out of 74 submissions.', stage: true },
  { name: 'NeuralBytes', year: '2024', kind: 'Company', group: 'Companies', line: 'AI tools and experiments. Home of IntergalacticPro and AlphaPredict.', href: 'https://neuralbytes.net' },
  { name: 'Master Coders', year: '2020', kind: 'Company', group: 'Companies', line: 'Free live coding lessons. Students built real projects from scratch.' },

  { name: 'agent-bridge', year: '2026', kind: 'MCP server', group: 'Agents and tools', line: 'A shared inbox between your OpenAI Dot and Grok Bot. Messages are data, never permission.', href: gh('agent-bridge'), stage: true },
  { name: 'cc-switch', year: '2026', kind: 'CLI', group: 'Agents and tools', line: 'Switch Claude Code between providers with one command. Templates for 40+ providers.', href: gh('cc-switch') },
  { name: 'ask-around', year: '2026', kind: 'Agent tool', group: 'Agents and tools', line: 'Governance for agents that ask people. Silence is never a yes.', href: gh('ask-around') },
  { name: 'claudeclaw', year: '2026', kind: 'Assistant', group: 'Agents and tools', line: 'A multi-platform AI assistant on the Claude Agents SDK.' },
  { name: 'fix-it-bot', year: '2026', kind: 'React component', group: 'Agents and tools', line: 'Drop-in bug reports that go straight to Kilo AI agents.', href: gh('fix-it-bot') },
  { name: 'kilobench', year: '2026', kind: 'Benchmark', group: 'Agents and tools', line: 'A model benchmarking feature for Kilo Code.', href: gh('kilobench') },
  { name: 'claude-code-utils', year: '2026', kind: 'Config', group: 'Agents and tools', line: 'Claude Code plugins and config I use daily.', href: gh('claude-code-utils') },
  { name: 'envfetch', year: '2026', kind: 'macOS CLI', group: 'Agents and tools', line: 'Environment variables behind Touch ID.', href: gh('envfetch') },
  { name: 'lite-stats', year: '2025', kind: 'macOS app', group: 'Agents and tools', line: 'A lightweight system monitor for the menu bar. Apple Silicon only.', href: gh('lite-stats') },

  { name: 'merlin-control', year: '2026', kind: 'Web', group: 'Apps', line: 'A wireframe SpaceX Merlin 1D you spin with your bare hands. Three.js and MediaPipe.', href: 'https://merlin.aravhawk.com', stage: true },
  { name: 'RydAR', year: '2026', kind: 'iPhone app', group: 'Apps', line: 'An iPhone co-pilot for tight bends in Arkansas, with a public map of them.', href: 'https://rydar.org' },
  { name: 'OxyDrop', year: '2026', kind: 'Prototype', group: 'Apps', line: 'A phone-camera check for a drop in blood oxygen from your own baseline. Not medical advice.', href: gh('oxydrop') },
  { name: 'passportphoto', year: '2026', kind: 'Web app', group: 'Apps', line: 'A US passport photo studio that runs in your browser.', href: gh('passportphoto') },
  { name: 'tempify', year: '2026', kind: 'Web app', group: 'Apps', line: 'Study music that follows what you are working on.', href: gh('tempify') },
  { name: 'ClarifAI', year: '2026', kind: 'Web app', group: 'Apps', line: 'Conflict mediation for couples and roommates.', href: gh('ClarifAI') },
  { name: 'typing-game', year: '2026', kind: 'Web game', group: 'Apps', line: 'A sleek, minimal typing game.', href: gh('typing-game') },
  { name: 'askrosie', year: '2026', kind: 'Study', group: 'Apps', line: "A local study clone of a museum's AI companion.", href: gh('askrosie') },
  { name: 'CryptoLab', year: '2025', kind: 'iPad app', group: 'Apps', line: "Submitted to Apple's 2025 Swift Student Challenge.", href: gh('CryptoLab.swiftpm') },
  { name: 'Macro-Guru', year: '2025', kind: 'Web app', group: 'Apps', line: 'TypeScript.', href: gh('Macro-Guru') },

  { name: 'Trading', year: '2026', kind: 'Trading bot', group: 'Markets', line: 'An autonomous equities and options bot on Claude Code and Alpaca. 14 strategies.', href: gh('Trading'), stage: true },
  { name: 'AlphaPredict', year: '2024', kind: 'NeuralBytes app', group: 'Markets', line: 'A stock market predictor with charts and company details.', href: gh('AlphaPredict'), stage: true },
  { name: 'TensorPoW', year: '2026', kind: 'Protocol', group: 'Markets', line: 'A proof-of-work blockchain that mines on GPUs. Reference implementation for Tensorcoin.', href: gh('TensorPoW') },

  { name: '99719T', year: '2025', kind: 'Robot code', group: 'Robots', line: 'Source for VEX Robotics Team 99719T, 2025 to 2026 season.', href: gh('99719T') },
  { name: '3400Z', year: '2025', kind: 'Robot code', group: 'Robots', line: 'Source for VEX Robotics Team 3400Z, 2024 to 2025 season.', href: gh('3400Z') },
  { name: 'Weather-Station-BMP280', year: '2023', kind: 'Hardware', group: 'Robots', line: 'A Raspberry Pi weather station that logs to an Excel workbook.', href: gh('Weather-Station-BMP280') },

  { name: 'pingdotgg/t3code', year: '2026', kind: '8 merged', group: 'Upstream', line: 'Server, web and git host fixes in T3 Code.', href: merged('pingdotgg/t3code'), stage: true },
  { name: 'junhoyeo/tokscale', year: '2026', kind: '3 merged', group: 'Upstream', line: 'Pull requests merged into tokscale.', href: merged('junhoyeo/tokscale') },
  { name: 'Kilo-Org/kilocode', year: '2026', kind: '1 merged', group: 'Upstream', line: 'A pull request merged into Kilo Code.', href: merged('Kilo-Org/kilocode') },
  { name: 'Kanishksasi/Investo', year: '2026', kind: '1 merged', group: 'Upstream', line: 'A pull request merged into Investo.', href: merged('Kanishksasi/Investo') },
  { name: 'fakerybakery/openbridge', year: '2025', kind: '1 merged', group: 'Upstream', line: 'A pull request merged into openbridge.', href: merged('fakerybakery/openbridge') },
  { name: 'AvinashDevineni/ThrasherAndChambersWebsite', year: '2025', kind: '5 merged', group: 'Upstream', line: 'Pull requests merged into a client site.', href: merged('AvinashDevineni/ThrasherAndChambersWebsite') },
  { name: 'devMEremenko/XcodeBenchmark', year: '2025', kind: '1 merged', group: 'Upstream', line: 'A benchmark result merged into XcodeBenchmark.', href: merged('devMEremenko/XcodeBenchmark') },
  { name: 'infiniflop', year: '2026', kind: '16 merged', group: 'Upstream', line: 'Pull requests across the public Infiniflop Labs repos: site, web frontend and docs.', href: 'https://github.com/infiniflop' },

  { name: 'neuralbytes.net', year: '2024', kind: 'Site', group: 'Earlier', line: 'Source for the NeuralBytes website.', href: gh('neuralbytes.net') },
  { name: 'IntergalacticPro', year: '2024', kind: 'NeuralBytes app', group: 'Earlier', line: 'A space and rockets expert.', href: gh('IntergalacticPro') },
  { name: 'SumQuick', year: '2024', kind: 'Tool', group: 'Earlier', line: 'AI summarization that runs locally with Ollama.', href: gh('SumQuick') },
  { name: 'ChatGPT-3.5-with-Vision', year: '2024', kind: 'Demo', group: 'Earlier', line: 'GPT-3.5 reading documents, PDFs, spreadsheets and code.', href: gh('ChatGPT-3.5-with-Vision') },
  { name: 'escaperoom', year: '2022', kind: 'Web', group: 'Earlier', line: 'HTML.', href: gh('escaperoom') },
  { name: 'workjet-ms', year: '2022', kind: 'Web', group: 'Earlier', line: 'HTML.', href: gh('workjet-ms') },
  { name: 'workjet-google', year: '2022', kind: 'Web', group: 'Earlier', line: 'HTML.', href: gh('workjet-google') },
  { name: 'wordle-clone', year: '2022', kind: 'Web', group: 'Earlier', line: 'Built from a freeCodeCamp article.', href: gh('wordle-clone') },
  { name: 'who-wants-to-be-a-billionaire', year: '2022', kind: 'Web', group: 'Earlier', line: 'HTML.', href: gh('who-wants-to-be-a-billionaire') },
  { name: 'teamastros', year: '2022', kind: 'Web', group: 'Earlier', line: 'HTML.', href: gh('teamastros') },
  { name: 'top10tipsforsurvival', year: '2021', kind: 'Web', group: 'Earlier', line: 'HTML. The oldest repo here.', href: gh('top10tipsforsurvival') },
];

export const groups = ['Companies', 'Agents and tools', 'Apps', 'Markets', 'Robots', 'Upstream', 'Earlier'] as const;

/** Post dates are shown in Central time, where they were written. */
export const POST_TZ = 'America/Chicago';
export const postDate = (iso: string, month: 'long' | 'short' = 'long') =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month, day: 'numeric', timeZone: POST_TZ });
