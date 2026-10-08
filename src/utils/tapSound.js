// Audible tap feedback for the kiosk. A touchscreen gives no click feel, so
// without it customers tap twice ("did it register?") — the second tap often
// lands on whatever the first one opened.
//
// Synthesised with Web Audio rather than an audio file: nothing to load or
// cache, and no decode delay, so it plays on pointerdown with the finger.

const TAPPABLE = 'button, a[href], [role="button"], input, select, label, summary';
const VOLUME = 0.6; // ponytail: fixed level; Windows volume is the per-kiosk knob

let ctx;

// Created/resumed inside a tap: an AudioContext made outside a user gesture
// starts suspended and stays silent.
function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function playTap() {
  try {
    const ctx = audio();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // "Bubble": a quick rising sine, 500Hz up to 1.3kHz in 90ms. Picked from a
    // board of six — playful for a theme park, and short enough that fast
    // repeated taps don't pile up.
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(1300, t + 0.072);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(VOLUME, t + 0.005); // 5ms attack, no speaker click
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    // Not chained, in case a webview's connect() doesn't return the node.
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.11);
  } catch (err) {
    // No audio device / blocked autoplay: the tap itself still works.
    console.warn('tap sound failed', err);
  }
}

export function installTapSound() {
  addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.(TAPPABLE);
    // Disabled controls stay silent — a click sound would promise an action
    // that isn't going to happen.
    if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') playTap();
  }, { capture: true, passive: true });
  // WebKit (the macOS app's webview) may not count pointerdown as the gesture
  // that lets audio start, but always counts click. Unlocking here means at
  // worst the very first tap's sound arrives a beat late; later ones are on time.
  addEventListener('click', () => { try { audio(); } catch { /* no audio */ } }, { capture: true, passive: true });
}
