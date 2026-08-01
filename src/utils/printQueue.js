// Local, per-kiosk print queue. One kiosk owns exactly one physical printer
// and prints strictly one job at a time, so this is a small in-memory array,
// not a distributed queue — see the plan's "why not server-side" rationale.
//
// The queue lives in memory and is *mirrored* to localStorage so a crash or
// restart mid-print can resume it. The mirror is strictly best-effort: a
// full-res 4R@300dpi JPEG dataURL runs 1.5-3MB and localStorage caps around
// 5MB, so persistence fails routinely once a couple of jobs are in flight.
// It must never be the source of truth — an earlier version pushed the job,
// persisted, then re-read localStorage to decide what to print, so a swallowed
// QuotaExceededError silently dropped the job: nothing printed, nothing
// errored, and the UI sat on "queued" forever.
import { printImage } from '../native/print';
import { updatePrintJobStatus } from '../api/mockApi';

const STORAGE_KEY = 'ff_print_queue';
const BACKOFF_MS = [5000, 15000, 45000];

let queue = null; // in-memory source of truth; hydrated from the mirror on boot
let processing = false;

function hydrate() {
  if (queue) return queue;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    queue = raw ? JSON.parse(raw) : [];
  } catch {
    queue = [];
  }
  return queue;
}

// Best-effort crash-recovery mirror. Losing it costs resume-after-crash for
// the affected jobs, nothing more — the in-memory queue still prints them.
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ponytail: quota. Move the mirror to IndexedDB if resume-after-crash on
    // large jobs turns out to matter in practice.
  }
}

function removeJob(jobId) {
  queue = hydrate().filter((j) => j.jobId !== jobId);
  persist();
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// The Download screen listens for this instead of polling — it already has
// the composed dataURL in memory, so a 'failed' event is all it needs to
// offer an instant reprint (no re-fetch of the job from the backend).
function notify(jobId, status, message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('printjob:done', { detail: { jobId, status, message } }));
  }
}

// Runs a single job to completion — retries included — before resolving, so
// the caller's sequential loop really is sequential. The previous version
// scheduled retries with a bare setTimeout and returned immediately, letting a
// retry overlap the next job on a single-printer kiosk.
async function runJob(job) {
  for (let attempt = 0; ; attempt++) {
    try {
      await printImage(job.printerName, job.dataUrl, job.copies);
      removeJob(job.jobId);
      await updatePrintJobStatus(job.jobId, { status: 'printed', printerName: job.printerName }).catch(() => {});
      notify(job.jobId, 'printed');
      return;
    } catch (err) {
      if (attempt >= BACKOFF_MS.length - 1) {
        removeJob(job.jobId);
        const message = String(err?.message ?? err);
        await updatePrintJobStatus(job.jobId, { status: 'failed', message }).catch(() => {});
        notify(job.jobId, 'failed', message);
        return;
      }
      const entry = hydrate().find((j) => j.jobId === job.jobId);
      if (entry) { entry.attempt = attempt + 1; persist(); }
      await delay(BACKOFF_MS[attempt]);
    }
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    // Sequential — matches the single-printer, one-at-a-time reality. Re-reads
    // the head each turn so jobs enqueued mid-drain are picked up by this pass.
    let job;
    while ((job = hydrate()[0])) {
      await runJob(job);
    }
  } finally {
    processing = false;
  }
}

// Enqueue and kick off processing. Never throws / never awaited by the
// caller — printing must not block the customer's flow (payment already
// succeeded; a failure here surfaces later as a "Reprint" affordance).
export function enqueuePrint({ jobId, printerName, dataUrl, copies }) {
  const q = hydrate();
  if (q.some((j) => j.jobId === jobId)) return; // already queued
  // queuedAt is what makes a wedged spooler visible. Without it a job stuck
  // forever and an idle kiosk look identical from outside — which is how a
  // whole day's printing is lost with nobody noticing until a customer
  // complains. Recorded here, not at print time, because the wait we care
  // about starts the moment the customer has paid.
  q.push({ jobId, printerName, dataUrl, copies, attempt: 0, queuedAt: Date.now() });
  persist();
  processQueue();
}

// Age of the oldest job still waiting, in ms, or null when nothing is queued.
// Reported by the heartbeat so the fleet view can tell "idle" from "stuck".
export function getOldestQueuedAgeMs() {
  const q = hydrate();
  if (q.length === 0) return null;
  // Jobs mirrored by an older build have no queuedAt; treat them as just-queued
  // rather than as infinitely old, so an upgrade can't fire a false stall alert.
  const oldest = Math.min(...q.map((j) => j.queuedAt ?? Date.now()));
  return Math.max(0, Date.now() - oldest);
}

export function getQueuedCount() {
  return hydrate().length;
}

// Resume anything left over from a crash/restart, once, on app boot.
export function resumePrintQueue() {
  processQueue();
}

// ponytail: test seam only — resets module state between cases in
// printQueue.test.js. Nothing in the app calls this.
export function __resetQueueForTest() {
  queue = null;
  processing = false;
}
