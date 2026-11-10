import { Renderer67, VERSION } from '@codepawlhq/67js';
import { parseGltf } from '@codepawlhq/67js/addons/gltf';
import { createAgentAssetScene } from '@codepawlhq/67js/addons/agent-asset';

const geometry = document.getElementById('geometry');
const frame = document.getElementById('frame');
const ctx = frame.getContext('2d', { alpha: false });
const { width, height } = frame;
const tau = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
function cue(time, from, to) {
  const t = Math.max(0, Math.min(1, (time - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

const palettes = {
  cool: { key: [.53, .80, 1.26], rim: [.14, .54, 1], edge: [.38, .65, 1] },
  warm: { key: [1.31, .80, .39], rim: [1, .32, .075], edge: [1, .61, .26] },
};

const background = new OffscreenCanvas(width, height);
const back = background.getContext('2d', { alpha: false });
back.fillStyle = '#040611';
back.fillRect(0, 0, width, height);
function cloud(x, y, rx, ry, color) {
  back.save();
  back.translate(x, y);
  back.scale(rx, ry);
  const gradient = back.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');
  back.fillStyle = gradient;
  back.fillRect(-1, -1, 2, 2);
  back.restore();
}
cloud(825, 395, 735, 390, '#263866');
cloud(1040, 110, 520, 340, '#24345190');
cloud(130, 648, 440, 250, '#25304a8c');
let seed = 67317;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
for (let i = 0; i < 270; i++) {
  const x = random() * width;
  const y = random() * height;
  const size = random();
  back.fillStyle = `rgba(169,198,240,${.12 + size ** 3 * .56})`;
  back.fillRect(x, y, .5 + size, .5 + size);
}

// A distant ring structure gives the silhouette scale without distracting from the model.
back.save();
back.translate(836, 368);
back.rotate(-.29);
const ringLight = back.createLinearGradient(-530, -250, 520, 205);
ringLight.addColorStop(0, '#a3b8f308');
ringLight.addColorStop(.46, '#93c6ef2b');
ringLight.addColorStop(1, '#a3b8f30d');
back.strokeStyle = ringLight;
for (const [rx, ry, line] of [[521, 233, 1], [503, 225, 1], [491, 219, 3], [469, 209, 1]]) {
  back.lineWidth = line;
  back.beginPath();
  back.ellipse(0, 0, rx, ry, 0, 0, tau);
  back.stroke();
}
back.strokeStyle = '#bad8f91e';
for (let i = 0; i < 72; i++) {
  const a = i / 72 * tau;
  back.beginPath();
  back.moveTo(Math.cos(a) * 503, Math.sin(a) * 225);
  back.lineTo(Math.cos(a) * 519, Math.sin(a) * 232);
  back.stroke();
}
back.restore();

const source = await fetch('./assets/StarRing.glb');
if (!source.ok) throw new Error('StarRing.glb could not be loaded');
const bytes = await source.arrayBuffer();
const digest = await crypto.subtle.digest('SHA-256', bytes);
const assetId = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const asset = await parseGltf(bytes);
const scene = createAgentAssetScene(asset, { format: '67js.asset', schemaVersion: 1, assetId });
const parts = scene.parts.map(part => ({ ...part, castShadow: false, receiveShadow: false }));
const renderer = new Renderer67(geometry, parts, {
  ground: false, transparent: true, hdr: true, samples: 4, pixelRatio: 1,
  memoryBudgetMiB: 224,
});

const baseCamera = { eye: [-5.0, 13.6, 4.5], target: [-1.55, 0, .12], up: [0, 0, -1], fov: 34 };
const effects = { bloom: { strength: .31, threshold: 1.16, radius: 1.35 }, saturation: .95, contrast: 1.06 };
const corePosition = [-.82, 1.15, 0];

function wingRotation(fold, side) {
  const x = side * fold * 1.08 / 2;
  const y = side * fold * .50 / 2;
  return [Math.sin(x) * Math.cos(y), Math.cos(x) * Math.sin(y), -Math.sin(x) * Math.sin(y), Math.cos(x) * Math.cos(y)];
}

function project(world, camera) {
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const subtract = (a, b) => a.map((x, i) => x - b[i]);
  const normalize = a => a.map(x => x / Math.hypot(...a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const forward = normalize(subtract(camera.target, camera.eye));
  const right = normalize(cross(forward, camera.up));
  const up = cross(right, forward);
  const offset = subtract(world, camera.eye);
  const scale = (height / 2) / (Math.tan(camera.fov * Math.PI / 360) * dot(offset, forward));
  return [width / 2 + dot(offset, right) * scale, height / 2 - dot(offset, up) * scale];
}

function coreFlare(x, y, strength, flash) {
  if (strength < .01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const radius = 20 + strength * 55 + flash * 32;
  const light = ctx.createRadialGradient(x, y, 1, x, y, radius);
  light.addColorStop(0, `rgba(255,238,193,${Math.min(.77, strength * .52 + flash * .24)})`);
  light.addColorStop(.16, `rgba(255,150,41,${strength * .37})`);
  light.addColorStop(.48, `rgba(249,68,8,${strength * .13})`);
  light.addColorStop(1, 'transparent');
  ctx.fillStyle = light;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  const reach = 45 + flash * 148;
  const streak = ctx.createLinearGradient(x - reach, y, x + reach, y);
  streak.addColorStop(0, 'transparent');
  streak.addColorStop(.5, `rgba(255,205,125,${.35 * strength + .41 * flash})`);
  streak.addColorStop(1, 'transparent');
  ctx.fillStyle = streak;
  ctx.fillRect(x - reach, y - 1, reach * 2, 2);
  ctx.restore();
}

function title(time) {
  const alpha = cue(time, 4.65, 5.22);
  if (!alpha) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(76 - (1 - alpha) * 14, 344);
  ctx.fillStyle = '#ffac61';
  ctx.fillRect(0, 0, 42, 2);
  ctx.font = '600 13px ui-monospace, monospace';
  ctx.fillText('STARBREAK   /   INCOMING', 0, 27);
  ctx.font = '700 49px "PingFang SC", "Heiti SC", sans-serif';
  ctx.fillStyle = '#edf4ff';
  ctx.fillText('烬环守卫', 0, 87);
  ctx.font = '500 17px "PingFang SC", sans-serif';
  ctx.fillStyle = '#a6bad6';
  ctx.fillText('核心上线', 2, 121);
  ctx.restore();
}

function draw(time, look) {
  const still = look !== 'film';
  const reveal = still ? 1 : cue(time, .12, 1.82);
  const openTop = still ? 1 : cue(time, 1.66, 3.12);
  const openBottom = still ? 1 : cue(time, 1.92, 3.38);
  const ignition = still ? 1 : cue(time, 3.45, 4.51);
  const flash = !still && time >= 4.46 ? Math.exp(-(time - 4.46) * 8) : 0;
  const float = still ? 0 : Math.sin(time * 1.9) * .05 * reveal;
  const translation = [lerp(10.2, .03, reveal), float, lerp(-.65, 0, reveal)];
  const reactorColor = lit => lit.map((channel, index) => lerp(index === 0 ? .045 : .02, channel, ignition));
  scene.apply([
    { type: 'set-root', translation },
    { type: 'set-asset-node', id: 'node-5', rotation: wingRotation(1 - openTop, -1) },
    { type: 'set-asset-node', id: 'node-3', rotation: wingRotation(1 - openBottom, 1) },
    { type: 'set-material', id: 'material-7', emission: lerp(.015, .93, ignition) },
    { type: 'set-material', id: 'material-8', color: reactorColor([1, .30, .017]), emission: lerp(.005, 4.3, ignition) + flash * 5 },
    { type: 'set-material', id: 'material-9', color: reactorColor([.84, .074, .004]), emission: lerp(.01, 1.75, ignition) + flash * 2.6 },
  ], { expectedRevision: scene.revision });

  const warm = still ? Number(look === 'warm') : cue(time, 3.1, 5.25);
  const lightColor = field => palettes.cool[field].map((color, i) => lerp(color, palettes.warm[field][i], warm));
  const exposed = still ? 1 : cue(time, .78, 2.6);
  const push = still ? 0 : cue(time, 2.4, 5.8);
  const camera = {
    ...baseCamera,
    eye: [baseCamera.eye[0] + (still ? 0 : lerp(1.3, -.45, push)), baseCamera.eye[1] - push * .45, baseCamera.eye[2] - push * .5],
    fov: baseCamera.fov + (still ? 0 : lerp(2.8, -.4, push)),
  };
  const core = corePosition.map((value, i) => value + translation[i]);
  renderer.updateParts(parts, { shadows: false });
  renderer.render({
    ...camera, exposure: 1.13, effects, time,
    environment: {
      lightDirection: [-.67, 1, -.47],
      keyColor: lightColor('key'),
      keyIntensity: lerp(.025, 2.05, exposed),
      fillIntensity: lerp(.02, .51, exposed),
      ambientIntensity: lerp(.017, .39, exposed),
      pointLights: [
        { position: [translation[0] + 1.5, 1.8, -3.6], color: lightColor('rim'), intensity: lerp(17, 21, exposed), radius: .8, range: 9 },
        { position: [translation[0] + .7, 2.8, 4.2], color: lightColor('edge'), intensity: lerp(5, 14, exposed), radius: 1, range: 10 },
        { position: [core[0] - .25, core[1] + .75, core[2]], color: [1, .22, .038], intensity: ignition * 3.8 + flash * 6, radius: .25, range: 3.2 },
      ],
    },
  });
  ctx.drawImage(background, 0, 0);
  ctx.drawImage(geometry, 0, 0, width, height);
  coreFlare(...project(core, camera), ignition * (still ? .44 : .71), flash);
  if (!still) title(time);
}

window.starRing = {
  version: VERSION,
  assetId,
  warnings: asset.warnings,
  draw,
  capture(time, look, type = 'image/png') {
    draw(time, look);
    return frame.toDataURL(type, .94);
  },
};
draw(5.7, 'cool');
