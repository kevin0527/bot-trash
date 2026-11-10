// Render the stereo loop with: node tools/compose-deep-space-echo.mjs /tmp/deep-space-echo.wav
import { writeFileSync } from 'node:fs';

const output = process.argv[2];
if (!output) throw new Error('Pass a destination WAV path.');
const rate = 44100;
const bars = 24;
const beat = 60 / 94;
const length = Math.round(bars * 4 * beat * rate);
const tau = 2 * Math.PI;
const left = new Float32Array(length);
const right = new Float32Array(length);
const hz = note => 440 * 2 ** ((note - 69) / 12);
let seed = 0x36a2b829;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const envelope = (t, dur, rise, release) => Math.min(1, t / rise, (dur - t) / release) ** 1.35;

// Wrap tails around the boundary so the phrase can repeat without a hard cut.
function voice(at, dur, gain, pan, sound) {
  let index = Math.round(at * beat * rate) % length;
  const count = Math.floor(dur * rate);
  const leftGain = gain * Math.sqrt((1 - pan) / 2);
  const rightGain = gain * Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const sample = sound(t) * envelope(t, dur, Math.min(.023, dur * .16), Math.min(.14, dur * .32));
    left[index] += sample * leftGain;
    right[index] += sample * rightGain;
    if (++index === length) index = 0;
  }
}

const chords = [
  [38, 50, 57, 63, 69], [39, 51, 58, 62, 70], [34, 53, 62, 66, 72], [37, 49, 56, 62, 68],
  [38, 50, 57, 65, 75], [33, 48, 54, 63, 67], [41, 53, 60, 66, 74], [37, 49, 56, 62, 69],
];
for (const [i, [root, ...notes]] of chords.entries()) {
  const at = i * 12;
  // Detuned FM beds drift under the pulse, with a slow crossfade between chords.
  for (const [n, note] of notes.entries()) {
    const dur = 12 * beat + 2.4;
    for (const side of [-1, 1]) {
      const f = hz(note) * (1 + side * .00185);
      const phase = random() * tau;
      voice(at + 94, dur, [.061, .053, .025, .027][n], side * (.24 + n * .18), t => {
        const p = tau * f * t;
        const drift = Math.sin(tau * (.12 + n * .029) * t + phase);
        const mod = Math.sin(p * (1.49 + n * .007) + phase);
        return envelope(t, dur, 1.6, 2.15) * (.74 + drift * .24) *
          (Math.sin(p + mod * (.31 + .27 * drift)) + .25 * Math.sin(p * 2.001 + phase));
      });
    }
  }
  for (let bar = 0; bar < 3; bar++) {
    const offset = at + bar * 4;
    const pulses = bar === 2 ? [[0, 0], [1.75, 12], [2.5, 0], [3.25, 1]] :
      [[0, 0], [1.5, 0], [2.75, bar ? 12 : 0]];
    for (const [step, shift] of pulses) {
      const f = hz(root - 12 + shift);
      voice(offset + step, step === 0 ? .69 : .39, step === 0 ? .22 : .145, 0, t => {
        const p = tau * (f * t + .73 * (1 - Math.exp(-t * 14)));
        return Math.exp(-t * 4.9) * (Math.sin(p) + .49 * Math.sin(p * 2) + .22 * Math.sin(p * 3));
      });
    }
    // Sparse relay ticks instead of an acoustic drum kit.
    for (const [k, step] of (bar === 1 ? [.75, 2, 3.5] : [1, 2.375, 3.75]).entries()) {
      let slow = 0;
      voice(offset + step, .19, k === 1 ? .056 : .037, k === 1 ? -.29 : .27, t => {
        const noise = random() * 2 - 1;
        slow += .19 * (noise - slow);
        const ring = Math.sin(tau * 1092 * t + .6 * Math.sin(tau * 2310 * t));
        return Math.exp(-t * 27) * (ring * .43 + (noise - slow) * .57);
      });
    }
  }
}

// Fragments of a transmission alternate with a glassy answering motif.
function ping(at, note, pan, bend) {
  const f = hz(note);
  for (const [echo, gain] of [[0, .15], [.75, .048], [1.5, .025], [2.25, .013]]) {
    voice(at + echo, .81, gain, echo === .75 || echo === 2.25 ? -pan : pan, t => {
      const p = tau * (f * t + bend * (1 - Math.exp(-t * 7)));
      return Math.exp(-t * 4.8) * (Math.sin(p + Math.sin(p * 2.67) * (1.4 * Math.exp(-t * 7))) +
        .19 * Math.sin(p * 1.497));
    });
  }
}
const signals = [
  [[.38, 81], [.72, 75], [1.02, 74], [5.25, 69], [7.5, 75], [9.1, 81]],
  [[.9, 79], [2.5, 74], [3.1, 75], [6.5, 82], [8.75, 74]],
  [[.5, 78], [.85, 79], [1.55, 72], [4.75, 74], [6.25, 78], [10.2, 72]],
  [[2, 73], [4.5, 68], [5.25, 74], [8.5, 80], [9.25, 74], [10.6, 73]],
];
for (let i = 0; i < chords.length; i++) {
  for (const [j, [offset, note]] of signals[i % signals.length].entries()) {
    ping(i * 12 + offset + (i >= 4 && j > 1 ? .19 : 0), note, j % 2 ? -.46 : .50, j % 3 === 0 ? 3.9 : -1.9);
  }
  const start = i * 12 + (i % 2 ? 10.5 : 2.85);
  for (const [delay, pan, gain] of [[0, -.54, .051], [1.12, .52, .025]]) {
    const dur = 2.75;
    const from = i % 2 ? 510 : 94;
    const sweep = i % 2 ? -1.9 : 2.35;
    voice(start + delay, dur, gain, pan, t => {
      const p = tau * from * Math.expm1(sweep * t / dur) * dur / sweep;
      const flutter = .57 + .43 * Math.sin(tau * (5.5 * t + 1.25 * t * t));
      return Math.sin(Math.PI * t / dur) ** 2 * flutter *
        (Math.sin(p + Math.sin(p * .618) * 1.7) + .36 * Math.sin(p * 1.502));
    });
  }
}

const wav = Buffer.alloc(44 + length * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(length * 4, 40);
for (let i = 0; i < length; i++) {
  wav.writeInt16LE(Math.round(Math.tanh(left[i] * 1.27) * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.tanh(right[i] * 1.27) * 32767), 46 + i * 4);
}
writeFileSync(output, wav);
