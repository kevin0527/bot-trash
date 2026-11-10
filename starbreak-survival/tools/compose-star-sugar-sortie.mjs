// Render the stereo loop: node tools/compose-star-sugar-sortie.mjs /tmp/star-sugar-sortie.wav
import { writeFileSync } from 'node:fs';

const output = process.argv[2];
if (!output) throw new Error('Pass a destination WAV path.');

const rate = 44100;
const bpm = 148;
const beat = 60 / bpm;
const length = Math.round(rate * beat * 4 * 32);
const left = new Float32Array(length);
const right = new Float32Array(length);
const tau = Math.PI * 2;
const hz = note => 440 * 2 ** ((note - 69) / 12);
let seed = 0x57ab105d;
const noise = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 31) - 1;

function mix(at, duration, gain, pan, synth, rise = .006, release = .07) {
  const samples = Math.floor(duration * rate);
  const a = gain * Math.sqrt((1 - pan) / 2);
  const b = gain * Math.sqrt((1 + pan) / 2);
  let index = Math.round(at * beat * rate) % length;
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const envelope = Math.min(1, t / rise, (duration - t) / release);
    const value = synth(t) * envelope;
    left[index] += value * a;
    right[index] += value * b;
    if (++index === length) index = 0;
  }
}

function lead(at, note, beats, gain, pan = 0, detune = 1) {
  const f = hz(note) * detune;
  mix(at, beats * beat + .08, gain, pan, t => {
    const glide = -.17 * (1 - Math.exp(-32 * t));
    const vibrato = .18 * Math.sin(tau * 5.2 * t) * Math.min(1, t * 4);
    const p = tau * (f * t + glide) + vibrato;
    return (Math.sin(p + Math.sin(2 * p) * (.20 + .16 * Math.exp(-t * 11))) +
      .25 * Math.sin(2 * p) + .12 * Math.sin(5 * p)) * (.57 + .43 * Math.exp(-t * 7));
  });
}

function pluck(at, note, gain, pan, length = .38) {
  const f = hz(note);
  mix(at, length, gain, pan, t => {
    const p = tau * f * t;
    return Math.exp(-t * 8.2) *
      (Math.sin(p + Math.sin(2.003 * p) * (1.14 * Math.exp(-t * 12))) +
        .16 * Math.sin(p * 3.012) * Math.exp(-t * 15));
  }, .003, .105);
}

function bass(at, note, beats, accent) {
  const f = hz(note);
  mix(at, beats * beat + .045, accent, 0, t => {
    const p = tau * (f * t + .13 * (1 - Math.exp(-t * 32)));
    return (.63 + .37 * Math.exp(-t * 9)) *
      (Math.sin(p) + .38 * Math.sin(2 * p) + .17 * Math.sin(3 * p) * Math.exp(-t * 7));
  }, .004, .055);
}

function chord(at, notes, amount, motion) {
  const duration = 4 * beat + .18;
  notes.forEach((note, i) => {
    const pan = (i - 1.5) * .31;
    for (const detune of [.9984, 1.0019]) {
      const f = hz(note) * detune;
      mix(at, duration, amount, pan, t => {
        const p = tau * f * t;
        const duck = .48 + .52 * (1 - Math.exp(-8 * (t % beat)));
        const tremolo = .87 + motion * .10 * Math.sin(tau * 1.12 * t + i);
        return duck * tremolo * (Math.sin(p) + .20 * Math.sin(2.01 * p) + .10 * Math.sin(3 * p));
      }, .1, .27);
    }
  });
}

function kick(at, gain = .20) {
  mix(at, .26, gain, 0, t => {
    const phase = tau * (53 * t + 3.3 * (1 - Math.exp(-37 * t)));
    return Math.sin(phase) * Math.exp(-16 * t) + .22 * noise() * Math.exp(-185 * t);
  }, .002, .075);
}

function clap(at, gain = .105) {
  let body = 0;
  mix(at, .22, gain, .10, t => {
    const n = noise();
    body += (n - body) * .19;
    const splash = [0, .011, .023].reduce((sum, start) =>
      sum + (t >= start ? Math.exp(-(t - start) * (start ? 47 : 73)) : 0), 0);
    const snap = Math.sin(tau * (184 * t + .51 * (1 - Math.exp(-19 * t)))) * Math.exp(-29 * t);
    return .67 * (n - body) * splash + .48 * snap;
  }, .002, .06);
}

function hat(at, gain, pan, open = false) {
  let body = 0;
  mix(at, open ? .17 : .068, gain, pan, t => {
    const n = noise();
    body += (n - body) * .61;
    const metallic = Math.sin(tau * 6223 * t) * Math.sin(tau * 4127 * t);
    return (n - body + .18 * metallic) * Math.exp(-t * (open ? 21 : 66));
  }, .0015, .018);
}

function bubble(at, note, pan) {
  const f = hz(note);
  mix(at, .18, .059, pan, t => {
    const p = tau * (f * t + .87 * (1 - Math.exp(-21 * t)));
    return Math.exp(-t * 19) * (Math.sin(p) + .32 * Math.sin(2 * p));
  }, .003, .045);
}

// The verse skips upward. The response climbs across longer notes, then the hook doubles it.
const verse = [
  [[0,74,.42],[.5,78,.40],[1,81,.65],[1.75,86,.25],[2,85,.42],[2.5,81,.45],[3.25,78,.54]],
  [[0,76,.68],[.75,81,.27],[1,83,.42],[1.5,81,.60],[2.5,76,.40],[3,73,.72]],
  [[0,78,.43],[.5,81,.42],[1,83,.81],[2,86,.38],[2.5,85,.39],[3,81,.67]],
  [[0,79,.42],[.5,81,.43],[1,83,.62],[1.75,81,.22],[2,79,.55],[2.75,76,.42],[3.25,78,.58]],
  [[0,74,.45],[.5,78,.4],[1,81,.68],[1.75,86,.42],[2.25,88,.44],[2.75,86,.48],[3.25,81,.48]],
  [[0,79,.75],[1,83,.35],[1.5,81,.39],[2,79,.67],[2.75,78,.43],[3.25,76,.6]],
  [[0,78,.41],[.5,79,.43],[1,83,.53],[1.75,86,.28],[2.25,85,.41],[2.75,83,.44],[3.25,79,.64]],
  [[0,81,.61],[.75,85,.37],[1.25,83,.41],[1.75,81,.42],[2.25,79,.41],[2.75,76,.53],[3.5,73,.40]],
];
const bridge = [
  [[0,83,.95],[1.25,81,.62],[2,78,.8],[3,74,.62]],
  [[0,76,.63],[.75,79,.46],[1.25,83,.58],[2,86,.79],[3,83,.77]],
  [[0,81,.80],[1,78,.44],[1.5,81,.46],[2,86,.92],[3.25,85,.49]],
  [[0,83,.70],[.75,81,.44],[1.25,78,.40],[1.75,76,.90],[3,73,.68]],
  [[0,79,.60],[.75,83,.41],[1.25,86,.72],[2.25,88,.58],[3,86,.69]],
  [[0,85,.92],[1.25,83,.42],[1.75,81,.70],[2.75,78,.46],[3.25,76,.61]],
  [[0,79,.42],[.5,83,.45],[1,86,.64],[1.75,88,.44],[2.25,86,.42],[2.75,83,.44],[3.25,79,.60]],
  [[0,81,.45],[.5,83,.42],[1,85,.43],[1.5,88,.47],[2,90,.79],[3,88,.40],[3.5,85,.43]],
];
const verseChords = [
  [38, [62, 66, 69, 76]], [37, [61, 64, 69, 71]],
  [35, [59, 62, 66, 69]], [43, [59, 62, 67, 69]],
  [42, [62, 66, 69, 73]], [40, [59, 62, 64, 67]],
  [43, [59, 62, 67, 69]], [45, [61, 64, 67, 69]],
];
const bridgeChords = [
  [35, [59, 62, 66, 69]], [43, [59, 62, 67, 71]],
  [38, [62, 66, 69, 76]], [45, [61, 64, 69, 71]],
  [43, [59, 62, 67, 69]], [42, [62, 66, 69, 73]],
  [40, [59, 62, 64, 67]], [45, [61, 64, 67, 69]],
];

for (let bar = 0; bar < 32; bar++) {
  const at = bar * 4;
  const section = Math.floor(bar / 8);
  const phrase = bar % 8;
  const breakbeat = section === 1 && phrase < 3;
  const hook = section === 2;
  const [root, voicing] = (section === 1 ? bridgeChords : verseChords)[phrase];
  chord(at, voicing, hook ? .034 : .025, section > 0 ? 1 : .6);

  for (const [index, [step, note, duration]] of (section === 1 ? bridge : verse)[phrase].entries()) {
    const volume = (index % 3 === 0 ? .152 : .134) * (breakbeat ? .88 : 1);
    lead(at + step, note, duration, volume);
    if (hook && duration > .52) {
      lead(at + step, note, duration, .032, -.49, .9978);
      lead(at + step, note - 12, duration, .036, .40, 1.0017);
    }
    if (index % 2 === 0) {
      pluck(at + step + .75, note, .026, -.57);
      pluck(at + step + 1.5, note, .013, .53);
    }
  }

  const steps = phrase % 2 === 0 ? [0, .75, 1.5, 2, 2.75, 3.5] : [0, .75, 1.75, 2.5, 3, 3.5];
  for (const [i, step] of steps.entries()) {
    const shift = i === 2 ? 12 : i === 4 ? 7 : i === 5 && phrase === 7 ? 12 : 0;
    bass(at + step, root + shift, i === 0 ? .59 : .38, i === 0 ? .168 : .123);
  }

  for (let i = 0; i < 8; i++) {
    const selected = voicing[[0, 2, 1, 3, 2, 0, 3, 1][(i + (phrase % 2) * 2) % 8]];
    pluck(at + i * .5 + .245, selected + (i % 4 === 3 ? 12 : 0),
      hook ? .051 : .040, i % 2 ? .51 : -.51);
  }
  for (const step of breakbeat ? [0, 2.5] : phrase % 2 ? [0, 1.5, 2.5, 3.75] : [0, 1.5, 2, 3.5]) {
    kick(at + step, breakbeat ? .152 : .21);
  }
  for (const step of [1, 3]) clap(at + step, breakbeat ? .071 : .105);
  for (let i = 0; i < 8; i++) {
    hat(at + i * .5, i % 2 ? .066 : .031, i % 2 ? .34 : -.33, i === 5 && !breakbeat);
  }
  if (phrase % 4 === 3) {
    bubble(at + 3.23, voicing[0] + 12, -.46);
    bubble(at + 3.63, voicing[1] + 12, .45);
  }
  if (phrase === 7) for (const step of [2.75, 3.25, 3.53]) clap(at + step, .052);
}

const wav = Buffer.alloc(44 + length * 4);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(length * 4, 40);
for (let i = 0; i < length; i++) {
  wav.writeInt16LE(Math.round(Math.tanh(left[i] * 1.28) * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.tanh(right[i] * 1.28) * 32767), 46 + i * 4);
}
writeFileSync(output, wav);
