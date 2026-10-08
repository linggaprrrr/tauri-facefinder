// Kiosk sound cues. A touchscreen gives no click feel, so without a tap sound
// customers tap twice ("did it register?") and the second tap lands on
// whatever the first one opened; the event cues (found, paid, printing…) tell
// someone standing a step back what just happened without reading the screen.
//
// All synthesised with Web Audio rather than audio files: nothing to load or
// cache, no decode delay, and each cue is a few numbers to tune.

const TAPPABLE = 'button, a[href], [role="button"], input, select, label, summary';
const VOLUME = 0.6; // ponytail: fixed level; Windows volume is the per-kiosk knob

// Notes, so the recipes read as music rather than magic numbers.
const N = { G4: 392, B4: 494, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };

// A cue is a list of voices: tones { f0, f1?, at, dur, vol?, type? } or a
// noise burst { noise: true, f0, f1, at, dur, vol? } (band-pass swept f0→f1).
export const CUES = {
  // "Bubble" — picked from a board of six: playful, and short enough that fast
  // repeated taps don't pile up.
  tap: [{ f0: 500, f1: 1300, dur: 0.09 }],
  next: [{ f0: N.E5, dur: 0.08, vol: 0.7 }, { f0: N.A5, at: 0.06, dur: 0.12, vol: 0.7 }],
  back: [{ f0: N.A5, dur: 0.08, vol: 0.7 }, { f0: N.E5, at: 0.06, dur: 0.12, vol: 0.7 }],
  found: [
    { f0: N.C6, dur: 0.14, vol: 0.6, type: 'triangle' },
    { f0: N.E6, at: 0.08, dur: 0.14, vol: 0.6, type: 'triangle' },
    { f0: N.G6, at: 0.16, dur: 0.3, vol: 0.6, type: 'triangle' },
  ],
  // Soft and falling, not a buzzer: "nothing yet", not "you did it wrong".
  notFound: [{ f0: N.E5, dur: 0.18, vol: 0.6 }, { f0: N.C5, at: 0.15, dur: 0.32, vol: 0.6 }],
  paySuccess: [
    { f0: N.C5, dur: 0.16, vol: 0.55, type: 'triangle' },
    { f0: N.E5, at: 0.1, dur: 0.16, vol: 0.55, type: 'triangle' },
    { f0: N.G5, at: 0.2, dur: 0.16, vol: 0.55, type: 'triangle' },
    { f0: N.C6, at: 0.3, dur: 0.5, vol: 0.6, type: 'triangle' },
  ],
  payFailed: [{ f0: N.D5, dur: 0.18, vol: 0.7, type: 'triangle' }, { f0: N.G4, at: 0.16, dur: 0.4, vol: 0.7, type: 'triangle' }],
  // Paper-feed whoosh, then a ding when the job is with the printer.
  print: [{ noise: true, f0: 600, f1: 2400, dur: 0.45, vol: 1.2 }, { f0: N.G6, at: 0.48, dur: 0.35, vol: 0.45 }],
};
CUES.error = CUES.payFailed;

let ctx;
// Off until installSounds(): on a customer's own phone (mobile web) a page
// that makes noises at them is unwelcome, so cues fired from shared code are
// silent there.
let enabled = false;

// Created/resumed inside a tap: an AudioContext made outside a user gesture
// starts suspended and stays silent.
function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function voice(c, t0, v) {
  const t = t0 + (v.at ?? 0);
  const gain = c.createGain();
  const level = VOLUME * (v.vol ?? 1);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(level, t + 0.005); // 5ms attack, no speaker click
  gain.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
  // Not chained, in case a webview's connect() doesn't return the node.
  gain.connect(c.destination);

  if (v.noise) {
    const len = Math.ceil(c.sampleRate * v.dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(v.f0, t);
    band.frequency.exponentialRampToValueAtTime(v.f1, t + v.dur);
    src.connect(band);
    band.connect(gain);
    src.start(t);
    return;
  }

  const osc = c.createOscillator();
  osc.type = v.type ?? 'sine';
  osc.frequency.setValueAtTime(v.f0, t);
  if (v.f1) osc.frequency.exponentialRampToValueAtTime(v.f1, t + v.dur * 0.8);
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + v.dur + 0.02);
}

export function playSound(name) {
  if (!enabled || !CUES[name]) return;
  try {
    const c = audio();
    CUES[name].forEach((v) => voice(c, c.currentTime, v));
  } catch (err) {
    // No audio device / blocked autoplay: the action itself still works.
    console.warn(`sound "${name}" failed`, err);
  }
}

// Tap feedback for every control, plus enabling the event cues. A control can
// pick its own cue with data-sound="next" (the Back/Next bar does), or opt out
// with data-sound="none".
export function installSounds() {
  enabled = true;
  addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.(TAPPABLE);
    // Disabled controls stay silent — a sound would promise an action that
    // isn't going to happen.
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const name = el.dataset.sound ?? 'tap';
    if (name !== 'none') playSound(name);
  }, { capture: true, passive: true });
  // WebKit (the macOS app's webview) may not count pointerdown as the gesture
  // that lets audio start, but always counts click. Unlocking here means at
  // worst the very first tap's sound arrives a beat late; later ones are on time.
  addEventListener('click', () => { try { audio(); } catch { /* no audio */ } }, { capture: true, passive: true });
}
