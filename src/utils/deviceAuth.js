// Shared by SettingsModal and StaffGrantModal — one definition so the two
// checks can't drift apart.
//
// ponytail: VITE_-prefixed env vars are always inlined in plaintext into the
// shipped bundle, so this is not a secret in any real sense — anyone who
// inspects the kiosk's files can recover it. Acceptable for what it already
// gates (Settings config) and, per explicit call, for staff-granted free
// access too — same risk tier, not a new one. If that stops being
// acceptable, the upgrade path is a backend-verified per-outlet PIN
// (POST /outlets/{id}/staff-auth checking a hashed value server-side, not a
// build-time constant), not a client-side fix.
const DEVICE_KEY = import.meta.env.VITE_DEVICE_KEY ?? '';

export function verifyDeviceKey(input) {
  return input === DEVICE_KEY;
}
