// Gate for the kiosk's Settings screen and staff-granted free access. Shared
// by SettingsModal and StaffGrantModal so the two checks can't drift apart.
//
// Three paths, in order:
//   1. Online  — the backend verifies the 6-digit PIN (authoritative, and the
//      only place a bcrypt hash ever lives). Rate-limited server-side.
//   2. Offline — compared against a PBKDF2 value this kiosk derived itself on
//      the last successful online verification. A kiosk with a dead network
//      still has to let staff in to *fix* the network, and the alternative
//      (shipping the server's hash to the client) would put a brute-forceable
//      credential on every device.
//   3. No PIN configured for the outlet — falls back to the legacy
//      VITE_DEVICE_KEY so existing installs keep working until an admin sets
//      a PIN. That key is inlined in the shipped bundle in plaintext, which is
//      exactly what the PIN exists to replace.
//
// Every path goes through the same local lockout, because a 6-digit PIN is
// 10^6 combinations and the thing actually being defended against is someone
// standing at the touchscreen tapping.
import { verifyOutletPin } from '../api/mockApi';
import { readCachedBranding } from '../hooks/useBranding';

const LEGACY_DEVICE_KEY = import.meta.env.VITE_DEVICE_KEY ?? '';
const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-HMAC-SHA256
const CACHE_KEY = 'ff_pin_offline';

export const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

let attempts = 0;
let lockedUntil = 0;

/** Milliseconds remaining on the lockout, 0 when unlocked. */
export function lockoutRemainingMs() {
  return Math.max(0, lockedUntil - Date.now());
}

function registerFailure() {
  attempts += 1;
  if (attempts >= MAX_ATTEMPTS) {
    // Escalates: every further failed burst doubles the wait.
    lockedUntil = Date.now() + LOCKOUT_MS * 2 ** (Math.floor(attempts / MAX_ATTEMPTS) - 1);
  }
}

function registerSuccess() {
  attempts = 0;
  lockedUntil = 0;
}

// Registers the failure and reports it. The attempt that *trips* the lockout
// has to report 'locked', not 'wrong' — otherwise the UI invites a retry that
// every subsequent call will silently refuse.
function fail(reason) {
  registerFailure();
  const retryMs = lockoutRemainingMs();
  return { ok: false, reason: retryMs > 0 ? 'locked' : reason, retryMs };
}

// Salted with the outlet id so the cached value from one kiosk is useless on
// an outlet it wasn't derived for.
async function derive(pin, outletId) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(`ownize:${outletId}`), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCache(outletId) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return cached?.outletId === outletId ? cached.digest : null;
  } catch {
    return null;
  }
}

function writeCache(outletId, digest) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ outletId, digest }));
  } catch {
    // Non-fatal: the kiosk just can't authenticate offline until it next
    // succeeds online with room to store this.
  }
}

/** Wipe the offline credential — call when the kiosk is re-pointed at another outlet. */
export function clearPinCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* nothing to clear */ }
}

/**
 * @returns {Promise<{ok: boolean, reason?: 'locked'|'wrong'|'no-pin'|'unknown-outlet', retryMs?: number}>}
 */
export async function verifyDevicePin(pin, { outletId } = {}) {
  const retryMs = lockoutRemainingMs();
  if (retryMs > 0) return { ok: false, reason: 'locked', retryMs };

  // No PIN configured for this outlet (or no outlet yet, e.g. first-run setup)
  // — legacy key, so an install that hasn't been migrated still opens.
  if (!outletId || readCachedBranding(outletId)?.pin_set === false) {
    if (LEGACY_DEVICE_KEY !== '' && pin === LEGACY_DEVICE_KEY) {
      registerSuccess();
      return { ok: true };
    }
    return fail('no-pin');
  }

  try {
    await verifyOutletPin(outletId, pin);
    registerSuccess();
    writeCache(outletId, await derive(pin, outletId)); // earn the offline path
    return { ok: true };
  } catch (err) {
    // A wrong PIN is a definitive 401/429 from the server — only fall through
    // to the offline check when the server could not be reached at all.
    if (err?.status === 401 || err?.status === 429) {
      return fail(err.status === 429 ? 'locked' : 'wrong');
    }
    // 404 = this outlet does not exist on the server the kiosk is pointed at
    // (usually a deviceConfig saved against a different backend than
    // VITE_API_BASE_URL now targets). No PIN can ever match, so say that
    // rather than blaming the digits — reporting it as 'wrong' sends whoever
    // is standing at the kiosk into retry-and-lockout for a config problem.
    if (err?.status === 404) return fail('unknown-outlet');
  }

  const cached = readCache(outletId);
  if (cached && (await derive(pin, outletId)) === cached) {
    registerSuccess();
    return { ok: true };
  }
  return fail('wrong');
}

// ponytail: test seam — resets the module-level lockout between cases.
export function __resetLockoutForTest() {
  attempts = 0;
  lockedUntil = 0;
}
