/**
 * Measure completed scene draws on the owner's M4, against a production build.
 * NODE_PATH=<playwright modules> node scripts/ice-frame-cost.mjs <base> [screens] [themes]
 * Each JSON line is one independently initialized browser's mean and raw groups.
 * Exit 1 if any three-session range exceeds 0.3 ms.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const { chromium } = createRequire(import.meta.url)('playwright');
const [base, positions = '0,0.4,0.8,1,1.4,2,3.1,5.6,8.45,11.15,13.8,16.6,19.4,20.5,22.15,23.5,25.8,28.3,31.1', themes = 'light,dark'] = process.argv.slice(2);
if (!base || process.platform !== 'darwin') throw Error('Supply the production URL on the Metal benchmark Mac.');
const sessions = [];

function resume(session) {
  if (session.parked) {
    process.kill(-session.pid, 'SIGCONT');
    session.parked = false;
  }
}

function park(session) {
  // Chromium's compositor keeps submitting Metal work when only its page is
  // frozen. Suspend the dedicated process group created by this invocation.
  process.kill(-session.pid, 'SIGSTOP');
  session.parked = true;
}

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => {
    for (const session of sessions) resume(session);
    process.exit(code);
  });
}

async function open(theme) {
  const server = await chromium.launchServer({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const pid = server.process().pid;
  const session = { server, pid, parked: false };
  sessions.push(session);
  if (Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(pid)])) !== pid) {
    throw Error('Chromium needs its own process group for isolated measurements.');
  }
  const browser = await chromium.connect(server.wsEndpoint());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: theme });
  session.page = page;
  await page.goto(base);
  await page.waitForFunction(() => window.__flight && document.documentElement.dataset.flight === 'on', null, { timeout: 90000 });
  park(session);
}

async function prepare(page, stop) {
  await page.evaluate(s => {
    const f = window.__flight;
    f.engine.holdLean(0);
    f.engine.holdClock(8);
    f.holdEntrance(8);
    window.scrollTo(0, Math.round(s * f.state().unit));
    f.holdPose(f.poseAt(s));
  }, stop);
  await page.waitForTimeout(3000);
  await page.waitForFunction(s => {
    const f = window.__flight, e = f.engine, a = e.lastArgs;
    if (!a || Math.abs(f.state().s - s) > 0.002) return false;
    if (!e.standsReady(a.cam, a.aspect, e.needs(a.cam, a.aspect))) return false;
    e.draw(a.cam, a.aspect, a.at);
    return e.drawnTiles.every(tile => tile.by.mask === tile.mask);
  }, stop, { timeout: 90000, polling: 120 });

  return page.evaluate(() => {
    const e = window.__flight.engine, a = e.lastArgs, gl = e.gl;
    const gpu = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);
    const backing = [gl.drawingBufferWidth, gl.drawingBufferHeight];
    if (!gpu.includes('Apple M4') || backing[0] !== 2880 || backing[1] !== 1800 || e.info.tier !== 0) {
      throw Error(JSON.stringify({ gpu, backing, tier: e.info.tier }));
    }
    e.drawHeld(a.cam, a.aspect, a.at, a.top);
    const pixel = new Uint8Array(4);
    window.timeDraws = frames => {
      if (gl.isContextLost()) throw Error('WebGL context lost.');
      const start = performance.now();
      for (let i = 0; i < frames; i++) {
        e.draw(a.cam, a.aspect, a.at);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      }
      return (performance.now() - start) / frames;
    };
    const start = performance.now();
    while (performance.now() - start < 8000) window.timeDraws(16);
    return { gpu, backing, tiles: e.info.tiles, pose: a.cam.pos, clock: e.time };
  });
}

async function measure(theme, s) {
  const states = [], groups = sessions.map(() => []);
  for (const session of sessions) {
    resume(session);
    states.push(await prepare(session.page, s));
    park(session);
  }
  if (new Set(states.map(state => JSON.stringify(state))).size !== 1) {
    throw Error('Session state differs: ' + JSON.stringify(states));
  }
  for (let block = 0; block < 18; block++) {
    for (let slot = 0; slot < sessions.length; slot++) {
      const i = (block + slot) % sessions.length;
      const session = sessions[i];
      resume(session);
      const ms = await session.page.evaluate(() => {
        window.timeDraws(8);
        return window.timeDraws(40);
      });
      groups[i].push(ms);
      park(session);
    }
  }
  const means = groups.map(samples => samples.reduce((a, b) => a + b, 0) / samples.length);
  const range = Math.max(...means) - Math.min(...means);
  for (let i = 0; i < sessions.length; i++) {
    console.log(JSON.stringify({ theme, s, session: i + 1, ...states[i], groups: groups[i], mean: means[i], range }));
  }
  if (range > 0.3) process.exitCode = 1;
}

for (const theme of themes.split(',')) {
  try {
    for (let i = 0; i < 3; i++) await open(theme);
    for (const s of positions.split(',').map(Number)) await measure(theme, s);
  } finally {
    for (const session of sessions) resume(session);
    await Promise.all(sessions.splice(0).map(session => session.server.close()));
  }
}
