// Local, per-kiosk print queue. One kiosk owns exactly one physical printer
// and prints strictly one job at a time, so this is a small persisted array,
// not a distributed queue — see the plan's "why not server-side" rationale.
// A job is persisted BEFORE the native print call starts, so a crash/restart
// mid-print resumes it once (then fails-with-reprint) instead of losing it.
import { printImage } from '../native/print';
import { updatePrintJobStatus } from '../api/mockApi';

const STORAGE_KEY = 'ff_print_queue';
const BACKOFF_MS = [5000, 15000, 45000];

let processing = false;

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ponytail: full-res print bitmaps can push localStorage over quota with
    // several jobs queued at once; a lost persisted entry just means a crash
    // mid-print won't resume that one job (still recoverable via the failed
    // job's reprint affordance). Move to IndexedDB if this bites in practice.
  }
}

function removeJob(jobId) {
  writeQueue(readQueue().filter((j) => j.jobId !== jobId));
}

// The Download screen listens for this instead of polling — it already has
// the composed dataURL in memory, so a 'failed' event is all it needs to
// offer an instant reprint (no re-fetch of the job from the backend).
function notify(jobId, status, message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('printjob:done', { detail: { jobId, status, message } }));
  }
}

async function attemptPrint(job) {
  try {
    await printImage(job.printerName, job.dataUrl, job.copies);
    removeJob(job.jobId);
    await updatePrintJobStatus(job.jobId, { status: 'printed', printerName: job.printerName }).catch(() => {});
    notify(job.jobId, 'printed');
  } catch (err) {
    const attempt = job.attempt + 1;
    if (attempt >= BACKOFF_MS.length) {
      removeJob(job.jobId);
      const message = String(err.message ?? err);
      await updatePrintJobStatus(job.jobId, { status: 'failed', message }).catch(() => {});
      notify(job.jobId, 'failed', message);
      return;
    }
    const queue = readQueue();
    const idx = queue.findIndex((j) => j.jobId === job.jobId);
    if (idx >= 0) { queue[idx].attempt = attempt; writeQueue(queue); }
    setTimeout(() => attemptPrint({ ...job, attempt }), BACKOFF_MS[attempt - 1]);
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    // Sequential — matches the single-printer, one-at-a-time reality.
    for (const job of readQueue()) {
      await attemptPrint(job);
    }
  } finally {
    processing = false;
  }
}

// Enqueue and kick off processing. Never throws / never awaited by the
// caller — printing must not block the customer's flow (payment already
// succeeded; a failure here surfaces later as a "Reprint" affordance).
export function enqueuePrint({ jobId, printerName, dataUrl, copies }) {
  const queue = readQueue();
  if (queue.some((j) => j.jobId === jobId)) return; // already queued
  queue.push({ jobId, printerName, dataUrl, copies, attempt: 0 });
  writeQueue(queue);
  processQueue();
}

// Resume anything left over from a crash/restart, once, on app boot.
export function resumePrintQueue() {
  processQueue();
}
