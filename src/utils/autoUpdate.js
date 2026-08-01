import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// Self-update, checked once at boot and never again during the session.
//
// Boot is the only safe moment on a kiosk: it is the one point where nobody is
// mid-transaction, no photos are selected, no payment is in flight and nothing
// is queued to print. A mid-session check that found an update would have to
// either interrupt a paying customer or sit on the result until the next
// restart anyway — so it may as well only ask when the answer is actionable.
//
// Entirely best-effort. A kiosk that cannot reach GitHub must keep selling
// photos, so every failure path here is a silent return: an unreachable
// endpoint, an unsigned artifact, a malformed manifest. The customer in front
// of the machine is not the person who can fix any of them.
export async function checkForUpdateAtBoot({ onStatus } = {}) {
  try {
    const update = await check();
    if (!update?.available) return false;

    onStatus?.('downloading');
    // downloadAndInstall verifies the minisign signature against the pubkey
    // baked into tauri.conf.json before it writes anything — a tampered or
    // unsigned artifact throws here rather than installing.
    await update.downloadAndInstall();

    onStatus?.('restarting');
    await relaunch();
    return true;
  } catch (err) {
    // Logged, not surfaced: "update failed" means nothing to a customer, and
    // the kiosk is still perfectly able to sell them their photos.
    console.warn('[updater] check/install failed:', err);
    onStatus?.('idle');
    return false;
  }
}
