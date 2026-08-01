// The Settings gate. Worth testing because the failure modes are asymmetric:
// letting the wrong person in is a security hole, and locking staff out of an
// offline kiosk means nobody can fix the thing that took it offline.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyOutletPin = vi.fn();
let cachedBranding = { pin_set: true };

vi.mock('../api/mockApi', () => ({ verifyOutletPin: (...a) => verifyOutletPin(...a) }));
vi.mock('../hooks/useBranding', () => ({ readCachedBranding: () => cachedBranding }));

const { verifyDevicePin, __resetLockoutForTest } = await import('./deviceAuth');

const OUTLET = 'outlet-abc';
const apiError = (status) => Object.assign(new Error(`API error ${status}`), { status });

beforeEach(() => {
  __resetLockoutForTest();
  cachedBranding = { pin_set: true };
  verifyOutletPin.mockReset().mockResolvedValue({ status: 'success' });
  let store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
});

describe('verifyDevicePin', () => {
  it('accepts a PIN the server confirms', async () => {
    expect(await verifyDevicePin('482913', { outletId: OUTLET })).toEqual({ ok: true });
    expect(verifyOutletPin).toHaveBeenCalledWith(OUTLET, '482913');
  });

  it('rejects a PIN the server rejects, without falling back offline', async () => {
    // A 401 is a definitive answer. If this fell through to the offline check
    // it would be a real hole: a previously-cached PIN would keep working
    // after an admin changed it server-side.
    verifyOutletPin.mockRejectedValue(apiError(401));

    expect(await verifyDevicePin('000001', { outletId: OUTLET })).toMatchObject({ ok: false, reason: 'wrong' });
  });

  it('locks out after 5 wrong attempts', async () => {
    verifyOutletPin.mockRejectedValue(apiError(401));
    for (let i = 0; i < 5; i++) await verifyDevicePin('000001', { outletId: OUTLET });

    const result = await verifyDevicePin('482913', { outletId: OUTLET });
    expect(result).toMatchObject({ ok: false, reason: 'locked' });
    expect(result.retryMs).toBeGreaterThan(0);
  });

  it('reports the attempt that trips the lockout as locked, not wrong', async () => {
    // Otherwise the UI shows "wrong PIN, try again" while the very next
    // attempt is already being refused — staff retype and nothing happens.
    verifyOutletPin.mockRejectedValue(apiError(401));
    let result;
    for (let i = 0; i < 5; i++) result = await verifyDevicePin('000001', { outletId: OUTLET });

    expect(result.reason).toBe('locked');
    expect(result.retryMs).toBeGreaterThan(0);
  });

  it('still lets staff in offline, using the credential earned online', async () => {
    // The kiosk that most needs Settings is the one whose network is down.
    await verifyDevicePin('482913', { outletId: OUTLET });   // online: earns the cache
    __resetLockoutForTest();
    verifyOutletPin.mockRejectedValue(new TypeError('Failed to fetch')); // no .status

    expect(await verifyDevicePin('482913', { outletId: OUTLET })).toEqual({ ok: true });
  });

  it('rejects a wrong PIN offline too', async () => {
    await verifyDevicePin('482913', { outletId: OUTLET });
    __resetLockoutForTest();
    verifyOutletPin.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await verifyDevicePin('999999', { outletId: OUTLET })).toMatchObject({ ok: false, reason: 'wrong' });
  });

  it('does not accept an offline credential derived for a different outlet', async () => {
    await verifyDevicePin('482913', { outletId: OUTLET });
    __resetLockoutForTest();
    verifyOutletPin.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await verifyDevicePin('482913', { outletId: 'other-outlet' })).toMatchObject({ ok: false });
  });

  it('falls back to the legacy device key when the outlet has no PIN yet', async () => {
    // Back-compat: installs that predate the PIN must still open, or a rollout
    // bricks Settings on every kiosk until an admin sets a PIN.
    cachedBranding = { pin_set: false };
    const result = await verifyDevicePin('anything', { outletId: OUTLET });

    expect(verifyOutletPin).not.toHaveBeenCalled();
    expect(result.ok).toBe(false); // VITE_DEVICE_KEY is unset in tests
    expect(result.reason).toBe('no-pin');
  });

  it('reports an outlet missing on this server without burning lockout budget', async () => {
    // A 404 means the kiosk points at a server that has no such outlet, so no
    // PIN can match. Counting those toward the lockout is how a config mistake
    // ends up refusing the correct PIN afterwards: fixing the outlet needs
    // Settings, and the lockout is exactly what keeps staff out of Settings.
    verifyOutletPin.mockRejectedValue(apiError(404));
    for (let i = 0; i < 8; i += 1) {
      const r = await verifyDevicePin('123123', { outletId: OUTLET });
      expect(r.reason).toBe('unknown-outlet');
    }

    // Point it at a server that does have the outlet: the right PIN works
    // immediately, with no leftover lockout from the misconfigured period.
    verifyOutletPin.mockResolvedValue({ status: 'success' });
    expect(await verifyDevicePin('123123', { outletId: OUTLET })).toEqual({ ok: true });
  });
});
