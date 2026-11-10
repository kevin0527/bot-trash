import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const [mode = 'review', url = 'http://127.0.0.1:8817/render.html'] = process.argv.slice(2);
if (!['review', 'film'].includes(mode)) throw new Error('Choose review or film');
const profile = await mkdtemp(join(tmpdir(), 'star-ring-chrome-'));
const chrome = spawn(process.env.STAR_RING_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--no-first-run', '--disable-background-networking', '--disable-component-update',
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--remote-debugging-pipe', `--user-data-dir=${profile}`,
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
const terminated = once(chrome, 'exit');
let sessionId;
let buffer = '';
let nextId = 0;
const pending = new Map();
const errors = [];
chrome.stderr.resume();
chrome.stdio[4].setEncoding('utf8');
chrome.stdio[4].on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\0')) !== -1) {
    const event = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails);
    if (!pending.has(event.id)) continue;
    const { resolve, reject } = pending.get(event.id);
    pending.delete(event.id);
    if (event.error) reject(new Error(event.error.message));
    else resolve(event.result);
  }
});
chrome.on('exit', () => {
  for (const { reject } of pending.values()) reject(new Error('Chrome closed'));
  pending.clear();
});

function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}

async function evaluate(expression) {
  const { result, exceptionDetails } = await cdp('Runtime.evaluate', { expression, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

async function capture(time, look, format) {
  const uri = await evaluate(`window.starRing.capture(${time}, ${JSON.stringify(look)}, ${JSON.stringify(format)})`);
  return Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
}

let encoder;
try {
  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true }));
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Page.navigate', { url });
  let ready;
  for (let attempt = 0; attempt < 100 && !ready; attempt++) {
    await delay(100);
    if (errors.length) throw new Error(errors[0].exception?.description ?? errors[0].text);
    ready = await evaluate('window.starRing && { version: starRing.version, assetId: starRing.assetId, warnings: starRing.warnings }');
  }
  if (!ready) throw new Error('The 67.js stage did not initialize');
  console.log(ready);
  await mkdir('artifacts', { recursive: true });
  if (mode === 'review') {
    const shots = [
      ['cool', 5.7, 'cool'], ['warm', 5.7, 'warm'],
      ['arrival', 1.17, 'film'], ['unfold', 2.51, 'film'],
      ['ignition', 4.5, 'film'], ['hero', 5.67, 'film'],
    ];
    for (const [file, time, look] of shots) {
      await writeFile(`artifacts/${file}.png`, await capture(time, look, 'image/png'));
      console.log(`Rendered ${file}.png`);
    }
  } else {
    const fps = 30;
    const frameCount = 6 * fps;
    encoder = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
      '-an', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart',
      'artifacts/star-ring-intro.mp4',
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const encoded = once(encoder, 'exit');
    for (let i = 0; i < frameCount; i++) {
      const data = await capture(i / fps, 'film', 'image/jpeg');
      await new Promise((resolve, reject) => encoder.stdin.write(data, error => error ? reject(error) : resolve()));
      if ((i + 1) % fps === 0) console.log(`Rendered ${i + 1}/${frameCount} frames`);
    }
    encoder.stdin.end();
    const [code] = await encoded;
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
  }
} finally {
  if (encoder && encoder.exitCode === null) encoder.kill();
  chrome.kill();
  await terminated;
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
